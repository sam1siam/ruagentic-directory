import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAddress, readPublic } from '../lib/server/public-reader.ts';

await test('public address validation allows public IPv4 and IPv6, including mapped public IPv4', () => {
  for (const address of [
    '8.8.8.8',
    '1.1.1.1',
    '2001:4860:4860::8888',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ]) {
    assert.equal(publicAddress(address), true, address);
  }
});

await test('private, metadata, loopback, reserved, and multicast addresses cannot be imported', () => {
  const rejected = [
    '',
    'example.com',
    '999.1.2.3',
    '0.0.0.0',
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.255',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
  ];
  for (const address of rejected)
    assert.equal(publicAddress(address), false, address);
});

await test('reader rejects unsafe literal URLs before a request can reach a local service', async () => {
  for (const url of [
    'https://127.0.0.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]',
    'https://[::ffff:127.0.0.1]',
    'http://8.8.8.8',
    'https://user:secret@8.8.8.8',
    'https://8.8.8.8?token=secret',
  ])
    await assert.rejects(readPublic(url), /public HTTPS URL/, url);
});
