const required = [
  'APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'SUPPORT_EMAIL',
  'BUSINESS_NAME',
  'CRON_SECRET',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error('Missing configuration names: ' + missing.join(', '));
  process.exitCode = 1;
} else {
  if (process.env.APP_URL !== 'https://ruagentic.com')
    throw new Error('Production APP_URL must use the canonical domain.');
  if (!/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY!))
    throw new Error('Production requires a live Stripe key.');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL!.endsWith('.supabase.co'))
    throw new Error('Check the Supabase project URL.');
  console.log(
    'Required production variables are present. Provider verification and transaction checks are still required.',
  );
}
