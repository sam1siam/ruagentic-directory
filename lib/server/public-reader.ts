import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import type { LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';
import { cleanUrl } from '../listing.ts';
export const publicAddress = (address: string) =>
  ipaddr.isValid(address) && ipaddr.process(address).range() === 'unicast';
/** Resolve every address, reject mixed private/public DNS, pin the connection and never forward credentials. */
export async function readPublic(
  value: string,
  limit = 262144,
  deadline = Date.now() + 13000,
  options: { allowQuery?: boolean; timeoutMs?: number } = {},
) {
  if (Date.now() >= deadline)
    throw new Error('The import time limit was reached.');
  const validationUrl = new URL(value);
  const search = validationUrl.search;
  if (options.allowQuery) validationUrl.search = '';
  const url = new URL(cleanUrl(validationUrl.href));
  if (options.allowQuery) url.search = search;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = ipaddr.isValid(hostname)
    ? [
        {
          address: hostname,
          family: ipaddr.parse(hostname).kind() === 'ipv6' ? 6 : 4,
        },
      ]
    : await Promise.race([
        lookup(hostname, { all: true, order: 'verbatim' }),
        new Promise<never>((_, reject) => {
          const t = setTimeout(
            () => reject(new Error('DNS lookup timed out.')),
            Math.max(1, Math.min(5000, deadline - Date.now())),
          );
          t.unref();
        }),
      ]);
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error(
      'Use a hostname that resolves only to public IP addresses.',
    );
  const pinned = addresses[0];
  return new Promise<{
    url: string;
    status: number;
    text: string;
    contentType: string;
  }>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        agent: false,
        headers: {
          Accept: 'text/html, application/json;q=0.9, text/plain;q=0.8',
          'Accept-Encoding': 'identity',
          'User-Agent':
            'RUAGENTIC-Directory/1.0 (+https://ruagentic.com/about)',
        },
        lookup: ((
          _host: string,
          options: { all?: boolean },
          callback: (
            error: Error | null,
            address: string | { address: string; family: number }[],
            family?: number,
          ) => void,
        ) =>
          options.all
            ? callback(null, [pinned])
            : callback(null, pinned.address, pinned.family)) as LookupFunction,
      },
      (res) => {
        if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
          res.destroy();
          reject(new Error('The URL redirects. Enter the final public URL.'));
          return;
        }
        if (
          res.headers['content-encoding'] &&
          res.headers['content-encoding'] !== 'identity'
        ) {
          res.destroy();
          reject(
            new Error(
              'This page requires compression. Enter the project details manually.',
            ),
          );
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit)
            req.destroy(new Error('The page exceeds the import size limit.'));
          else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () =>
          resolve({
            url: url.href,
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf8'),
            contentType: String(res.headers['content-type'] ?? ''),
          }),
        );
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error('The page took too long to respond.')),
      Math.max(1, Math.min(options.timeoutMs ?? 8000, deadline - Date.now())),
    );
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
}
