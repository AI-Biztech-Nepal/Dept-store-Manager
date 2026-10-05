// lib/utils/authFlow.ts
// Shared by every screen that signs a person in or proves they own an email
// (login, register, verify-email, forgot-password, the profile's password
// card), so the rules and the wording can't drift between them.
import { Platform } from 'react-native';

/** Digits in the emailed code. Must match Supabase -> Authentication ->
 * Sign In / Providers -> Email -> "Email OTP length" (its default is 6). */
export const OTP_LENGTH = 6;

/** Supabase itself refuses a second email to the same address inside 60s, so
 * the "Resend" buttons wait that long instead of firing a request that is
 * certain to be rejected. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Where a link in an auth email should bring the person back to: the site
 * they are on right now, so someone who signs up on the live site is sent
 * back to the live site (and one testing on localhost to localhost) instead
 * of to whatever Supabase's single "Site URL" happens to be. Phones have no
 * page to return to and use the Site URL.
 *
 * Supabase only honours this if the address is in Authentication -> URL
 * Configuration -> Redirect URLs; otherwise it quietly uses the Site URL. */
export function authRedirectUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return window.location.origin;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Supabase's own server-side minimum is just 6 characters with no
// complexity requirement. This is the app's floor, checked before a request
// goes out.
export function passwordIssue(value: string): string | null {
  if (value.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return 'Mix letters and numbers.';
  return null;
}

/** Keeps only the digits of whatever was typed or pasted ("123 456" ->
 * "123456"), capped at the code length. */
export function cleanOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match. Check them and try again.',
  email_not_confirmed: 'Confirm your email first - we’ll send you a code.',
  over_email_send_rate_limit: 'Too many emails were requested. Wait a minute, then try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  otp_expired: 'That code is wrong or has expired. Check it, or request a new one.',
  same_password: 'Choose a password you haven’t used before.',
  weak_password: 'That password is too weak. Use at least 8 characters with letters and numbers.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  email_address_invalid: 'That email address doesn’t look right.',
  email_address_not_authorized: 'We can’t send email to this address right now. Please try again later.',
  signup_disabled: 'New sign-ups are switched off right now.',
};

/** Plain-language text for a Supabase auth error, falling back to the
 * server's own message for anything not listed above. */
export function authErrorMessage(error: { code?: string; message: string }): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  // updateUser with no session: the reset link was used up or timed out.
  if (/auth session missing/i.test(error.message)) {
    return 'This reset link has expired. Request a new one from the sign-in screen.';
  }
  // verifyOtp reports a wrong code as a bare 403 whose message is this text.
  if (/token has expired or is invalid/i.test(error.message)) return MESSAGES.otp_expired;
  return error.message;
}

export function isRateLimited(error: { code?: string }): boolean {
  return error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit';
}
