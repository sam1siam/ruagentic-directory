import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { boundedBody, BodyLimitError } from '../lib/bounded-body.ts';

function streaming(chunks: Uint8Array[], contentLength?: string) {
  let cancelled = false;
  let reads = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const next = chunks[reads++];
        if (next) controller.enqueue(next);
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request('https://ruagentic.com/api/webhooks/stripe', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: contentLength ? { 'content-length': contentLength } : {},
  } as RequestInit & { duplex: 'half' });
  return { request, cancelled: () => cancelled, reads: () => reads };
}

await test('bounded reader preserves exact signed bytes across chunk boundaries', async () => {
  const payload =
    '{ "id": "evt_test", "object": "event", "data": { "object": {} } }\n';
  const original = Buffer.from(payload);
  const input = streaming([original.subarray(0, 13), original.subarray(13)]);
  const bytes = await boundedBody(input.request, original.length);
  assert.deepEqual(bytes, original);
  const stripe = new Stripe('sk_test_local_validation');
  const secret = 'whsec_local_validation';
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(
    stripe.webhooks.constructEvent(bytes, header, secret).id,
    'evt_test',
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(
      Buffer.concat([bytes, Buffer.from(' ')]),
      header,
      secret,
    ),
  );
});

await test('oversized chunked bodies cancel before draining even with a false content length', async () => {
  for (const length of [undefined, '1']) {
    const input = streaming(
      [Buffer.alloc(8), Buffer.alloc(1), Buffer.alloc(100)],
      length,
    );
    await assert.rejects(boundedBody(input.request, 8), BodyLimitError);
    assert.equal(input.cancelled(), true);
    assert.equal(input.reads(), 2);
  }
});
