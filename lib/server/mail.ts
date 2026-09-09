import 'server-only';
/** One transactional message through the mail provider. The idempotency key
 *  makes retries and webhook/thank-you races safe. Returns false when mail
 *  is not configured; throws on provider errors so callers decide. */
export async function sendMail(
  to: string,
  message: { subject: string; text: string; html: string },
  idempotencyKey: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      ...(process.env.SUPPORT_EMAIL
        ? { reply_to: process.env.SUPPORT_EMAIL }
        : {}),
      to,
      ...message,
    }),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('email_provider_error');
  return true;
}
