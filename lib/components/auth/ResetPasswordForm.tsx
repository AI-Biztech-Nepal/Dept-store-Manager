// lib/components/auth/ResetPasswordForm.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../../supabase';
import { useAuthStore } from '../../hooks/useAuth';
import { OTP_LENGTH, authErrorMessage, passwordIssue } from '../../utils/authFlow';
import { updateBiometricPasswordIfSaved } from '../../utils/biometricLogin';
import { showAlert } from '../../utils/alert';
import { OtpField } from './OtpField';
import { PasswordInput } from './PasswordInput';
import { ResendCode } from './ResendCode';

/** Second half of "forgot password" and of "change password": the emailed code
 * plus the new password, in one step. Used signed out (forgot password) and
 * signed in (profile -> Change password); `email` is where the code went. */
export function ResetPasswordForm({
  email,
  resend,
  onSuccess,
}: {
  email: string;
  resend: () => Promise<{ error: AuthError | null }>;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (code.length !== OTP_LENGTH) {
      showAlert('Enter the code', `Type the ${OTP_LENGTH}-digit code we emailed to ${email}.`);
      return;
    }
    const issue = passwordIssue(password);
    if (issue) {
      showAlert('Choose a stronger password', issue);
      return;
    }
    if (password !== confirm) {
      showAlert('Passwords don’t match', 'Type the same new password in both boxes.');
      return;
    }

    // Verifying the code signs this device in. When that happens from the
    // signed-out forgot-password screen, the app swaps its whole pre-login
    // frame for the signed-in one, so this screen's own state is gone by the
    // next line - everything after this point only uses values captured here.
    const wasSignedIn = !!useAuthStore.getState().session;

    setIsSubmitting(true);
    const { error: codeError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (codeError) {
      setIsSubmitting(false);
      showAlert('Couldn’t verify the code', authErrorMessage(codeError));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setIsSubmitting(false);
      // The code is spent and checking it signed this device in. Someone who
      // came here signed out must not be left signed in without having
      // finished - undo that, and they request a fresh code.
      if (!wasSignedIn) await supabase.auth.signOut({ scope: 'local' });
      showAlert(
        'Couldn’t set the new password',
        `${authErrorMessage(updateError)}${wasSignedIn ? '' : ' Request a new code and try again.'}`
      );
      return;
    }

    // A reset is usually "someone else may have my password" - end every
    // other session. Best-effort; the password itself is already changed.
    try {
      await supabase.auth.signOut({ scope: 'others' });
    } catch {}
    await updateBiometricPasswordIfSaved(email, password);

    setIsSubmitting(false);
    showAlert('Password updated', 'Your new password is set. Any other devices were signed out.');
    onSuccess();
  }

  return (
    <View>
      <Text className="mb-1.5 text-xs font-semibold text-gray-500">Code from your email</Text>
      <View className="mb-3.5">
        <OtpField value={code} onChange={setCode} autoFocus />
      </View>

      <Text className="mb-1.5 text-xs font-semibold text-gray-500">New password</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        containerClassName="mb-1.5"
      />
      <Text className="mb-3.5 text-[11px] text-gray-400">At least 8 characters, with letters and numbers.</Text>

      <Text className="mb-1.5 text-xs font-semibold text-gray-500">Confirm new password</Text>
      <PasswordInput
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        containerClassName="mb-6"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        className="mb-2 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
      >
        <Text className="text-[15px] font-bold text-white">{isSubmitting ? 'Updating…' : 'Update password'}</Text>
      </Pressable>

      <ResendCode email={email} send={resend} />
    </View>
  );
}
