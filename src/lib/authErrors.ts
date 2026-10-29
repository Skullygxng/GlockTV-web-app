/*
 * Supabase reports auth failures as terse server strings - "Error sending
 * confirmation email", "email rate limit exceeded" - and they were being shown
 * to people verbatim, which reads as a broken site rather than a fixable
 * situation. This maps the ones a visitor can actually hit into a sentence that
 * says what happened and what to do. Anything unrecognised is passed through
 * unchanged, so a genuinely new failure is still visible rather than masked.
 */
export function authErrorMessage(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason ?? '');
  const text = raw.toLowerCase().trim();

  /* Network first: an unreachable or paused project looks exactly like this. */
  if (/failed to fetch|load failed|networkerror|network request failed|timed? ?out|abort/.test(text)) {
    return 'We could not reach the account server. Check your connection and try again in a moment.';
  }

  if (text.includes('rate limit')) {
    return 'Too many emails have gone out in the last hour. Wait a few minutes and try again.';
  }

  /*
   * GoTrue reports a failed send with several different strings depending on
   * version and provider; all of them mean the same thing to the person.
   */
  if (/error sending|unable to send|smtp|failed to send|email.{0,20}not.{0,10}sent/.test(text)) {
    return 'We could not send the confirmation email. Try again in a few minutes - if it keeps happening, the site owner needs to check the email settings.';
  }

  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'That email already has an account. Sign in instead, or use Forgot password?';
  }

  if (text.includes('invalid login credentials')) {
    return 'That email and password do not match an account.';
  }

  if (text.includes('email not confirmed')) {
    return 'Check your inbox and confirm the email before signing in.';
  }

  if (text.includes('signups not allowed') || text.includes('signup is disabled')) {
    return 'New accounts are turned off on this site right now.';
  }

  if (/password should be|password is too short|weak password|at least 6 characters/.test(text)) {
    return 'Choose a longer password - at least eight characters.';
  }

  if (text.includes('invalid email') || text.includes('unable to validate email')) {
    return 'That email address does not look valid. Check it and try again.';
  }

  if (text.includes('email link is invalid') || text.includes('expired')) {
    return 'That link has expired. Request a new one and open it on this device.';
  }

  return raw.trim() || 'That did not work. Try again.';
}
