// lib/components/auth/ResendCode.tsx
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { AuthError } from '@supabase/supabase-js';
import { useCooldown } from '../../hooks/useCooldown';
import { RESEND_COOLDOWN_SECONDS, authErrorMessage, isRateLimited } from '../../utils/authFlow';
import { showAlert } from '../../utils/alert';

/** "Didn't get it? Resend code". Mounted right after a code was sent, so it
 * starts already counting down. */
export function ResendCode({ email, send }: { email: string; send: () => Promise<{ error: AuthError | null }> }) {
  const { secondsLeft, start } = useCooldown(RESEND_COOLDOWN_SECONDS);
  const [busy, setBusy] = useState(false);
  const disabled = busy || secondsLeft > 0;

  async function handlePress() {
    if (disabled) return;
    setBusy(true);
    const { error } = await send();
    setBusy(false);
    if (error) {
      // The server's own 60s rule fired - match it rather than let the
      // button invite another doomed tap.
      if (isRateLimited(error)) start(RESEND_COOLDOWN_SECONDS);
      showAlert('Couldn’t send the code', authErrorMessage(error));
      return;
    }
    start(RESEND_COOLDOWN_SECONDS);
    showAlert('Code sent', `We emailed a new code to ${email}. Use the newest one.`);
  }

  return (
    <Pressable onPress={handlePress} disabled={disabled} className="items-center py-2 disabled:opacity-60">
      <Text className="text-[12.5px] text-gray-500">
        Didn’t get it?{' '}
        <Text className="font-bold text-orange-600">
          {busy ? 'Sending…' : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
        </Text>
      </Text>
    </Pressable>
  );
}
