// lib/utils/authEmail.ts
// The two emails the app asks Supabase to send. Every caller goes through
// here so the return address (see authRedirectUrl) is set the same way
// everywhere.
import { supabase } from '../supabase';
import { authRedirectUrl } from './authFlow';

/** Mails the 6-digit password-reset code. Used by "Forgot password?" and by
 * Profile -> Change password. Supabase answers success even for an address
 * with no account, so callers can't tell whether one exists. */
export function sendRecoveryCode(email: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
}

/** Mails the sign-up confirmation code again. */
export function resendSignupCode(email: string) {
  return supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } });
}
