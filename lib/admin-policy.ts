/** Who may open /admin. Configured with ADMIN_EMAILS (comma separated); the
 *  default is the directory's own mailbox. Pure so it can be unit tested. */
export function adminEmails(env = process.env.ADMIN_EMAILS) {
  return (env ?? 'hello@ruagentic.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
export function isAdminEmail(
  email: string | null | undefined,
  env = process.env.ADMIN_EMAILS,
) {
  return (
    Boolean(email) && adminEmails(env).includes(email!.trim().toLowerCase())
  );
}
/** Review window promised to sponsors on the advertise page and in email. */
export const reviewWindow = '24–48 hours';
