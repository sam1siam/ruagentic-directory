import test from 'node:test';
import assert from 'node:assert/strict';
import { findContact, publishedContacts } from '../lib/discovery/contacts.ts';
import { ProviderError } from '../lib/discovery/http.ts';
import type { Candidate } from '../lib/discovery/policy.ts';

const item: Candidate = {
  source: 'github',
  id: 'example/mcp',
  name: 'Example',
  description: 'An MCP server',
  sourceUrl: 'https://github.com/example/mcp',
  homepage: 'https://example.com',
};
const founder = (name: string, id: string, email?: string) => ({
  company: { domain: 'example.com' },
  person: {
    person_id: id,
    full_name: name,
    first_name: name.split(' ')[0],
    current_job_title: 'Co-founder',
    email: email ? { email, status: 'VERIFIED', revealed: true } : null,
  },
});
async function withProviders(findymail: boolean, run: () => Promise<void>) {
  const previous = {
    PROSPEO_API_KEY: process.env.PROSPEO_API_KEY,
    FINDYMAIL_API_KEY: process.env.FINDYMAIL_API_KEY,
  };
  process.env.PROSPEO_API_KEY = 'fixture';
  if (findymail) process.env.FINDYMAIL_API_KEY = 'fixture';
  else delete process.env.FINDYMAIL_API_KEY;
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
const noPage = async () => {
  throw new Error('Unexpected public page read');
};

await test('Prospeo can return a verified founder without a Findymail key', async () => {
  await withProviders(false, async () => {
    const calls: string[] = [];
    const contact = await findContact(
      item,
      Date.now() + 60_000,
      async () => true,
      async (url) => {
        const path = new URL(url).pathname;
        calls.push(path);
        if (path === '/search-person')
          return { results: [founder('Alice Example', 'alice')] };
        if (path === '/enrich-person')
          return founder('Alice Example', 'alice', 'alice@example.com');
        throw new Error('Unexpected API request ' + url);
      },
      noPage,
    );
    assert.equal(contact?.email, 'alice@example.com');
    assert.equal(contact?.provider, 'Prospeo verified founder');
    assert.deepEqual(calls, ['/search-person', '/enrich-person']);
  });
});

await test('Without Findymail, no match stays empty and provider failures still throw', async () => {
  await withProviders(false, async () => {
    let calls = 0;
    assert.equal(
      await findContact(
        item,
        Date.now() + 60_000,
        async () => true,
        async () => {
          calls++;
          throw new ProviderError('api.prospeo.io', 400, 'NO_RESULTS');
        },
        noPage,
      ),
      null,
    );
    assert.equal(calls, 1);
    for (const failure of [
      new ProviderError('api.prospeo.io', 500),
      new ProviderError('api.prospeo.io', 429),
      new ProviderError('api.prospeo.io', 400, 'INVALID_API_KEY'),
      new Error('Connection interrupted'),
    ]) {
      calls = 0;
      await assert.rejects(
        findContact(
          item,
          Date.now() + 60_000,
          async () => true,
          async () => {
            calls++;
            throw failure;
          },
          noPage,
        ),
        (error) => error === failure,
      );
      assert.equal(calls, 1);
    }
    calls = 0;
    await assert.rejects(
      findContact(
        item,
        Date.now() + 60_000,
        async () => false,
        async () => {
          calls++;
          return { results: [] };
        },
        noPage,
      ),
      /budget reached/,
    );
    assert.equal(calls, 0);
  });
});

await test('Findymail tries both known cofounders in order before employee search', async () => {
  await withProviders(true, async () => {
    for (const available of ['Alice Example', 'Bob Example']) {
      const lookedUp: string[] = [];
      const contact = await findContact(
        item,
        Date.now() + 60_000,
        async () => true,
        async (url, init) => {
          const path = new URL(url).pathname;
          if (path === '/search-person')
            return {
              results: [
                founder('Alice Example', 'alice'),
                founder('Bob Example', 'bob'),
              ],
            };
          if (path === '/enrich-person')
            throw new ProviderError('api.prospeo.io', 400, 'NO_MATCH');
          if (path === '/api/search/name') {
            assert.ok(typeof init?.body === 'string');
            const { name } = JSON.parse(init.body);
            lookedUp.push(name);
            if (name !== available)
              throw new ProviderError('app.findymail.com', 404);
            return {
              contact: {
                name,
                email: name.split(' ')[0].toLowerCase() + '@example.com',
                domain: 'example.com',
              },
            };
          }
          throw new Error('Unexpected API request ' + url);
        },
        noPage,
      );
      assert.equal(contact?.fullName, available);
      assert.deepEqual(
        lookedUp,
        available === 'Alice Example'
          ? ['Alice Example']
          : ['Alice Example', 'Bob Example'],
      );
    }
  });
});

await test('A failed reveal still preserves every founder returned by the search', async () => {
  await withProviders(true, async () => {
    const lookedUp: string[] = [];
    const contact = await findContact(
      item,
      Date.now() + 60_000,
      async () => true,
      async (url, init) => {
        const path = new URL(url).pathname;
        if (path === '/search-person')
          return {
            results: [
              founder('Alice Example', 'alice'),
              founder('Bob Example', 'bob'),
            ],
          };
        if (path === '/enrich-person')
          throw new ProviderError('api.prospeo.io', 500);
        if (path === '/api/search/name') {
          assert.ok(typeof init?.body === 'string');
          const { name } = JSON.parse(init.body);
          lookedUp.push(name);
          if (name === 'Alice Example')
            throw new ProviderError('app.findymail.com', 404);
          return {
            contact: { name, email: 'bob@example.com', domain: 'example.com' },
          };
        }
        throw new Error('Unexpected API request ' + url);
      },
      noPage,
    );
    assert.equal(contact?.email, 'bob@example.com');
    assert.deepEqual(lookedUp, ['Alice Example', 'Bob Example']);
  });
});

await test('Published contacts respect direct opt-outs and whitespace variants', () => {
  for (const refusal of [
    'Please do not email this address with marketing offers:',
    'Please do not contact us about sales.',
    'Please do\nnot\temail for marketing.',
    "Please don't email us with sales offers.",
    'Please don’t e-mail this mailbox.',
    'No unsolicited messages.',
    'This mailbox is not for marketing.',
  ]) {
    assert.deepEqual(
      publishedContacts(
        `<body><div>${refusal} <a href="mailto:hello@example.com">hello@example.com</a></div></body>`,
        item.homepage!,
        'example.com',
      ),
      [],
      refusal,
    );
  }
  assert.deepEqual(
    publishedContacts(
      '<body>Please email hello@example.com for product information.</body>',
      item.homepage!,
      'example.com',
    ).map((contact) => contact.email),
    ['hello@example.com'],
  );
});

await test('Plain-text contacts are complete published mailboxes, never suffix guesses', () => {
  const html =
    '<body>jane+hello@example.com, jane.support@example.com, jane-hello@example.com, jane/hello@example.com; <a href="mailto:other+support@example.com">other+support@example.com</a>; hello@other.com; (support@example.com), HELLO@example.com.</body>';
  assert.deepEqual(
    publishedContacts(html, item.homepage!, 'example.com').map(
      (contact) => contact.email,
    ),
    ['hello@example.com', 'support@example.com'],
  );
  assert.deepEqual(
    publishedContacts(
      '<body>Only jane+hello@example.com or jane.support@example.com</body>',
      item.homepage!,
      'example.com',
    ),
    [],
  );
});
