// lib/components/auth/NewPasswordForm.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../supabase';
import { useAuthStore } from '../../hooks/useAuth';
import { authErrorMessage, passwordIssue } from '../../utils/authFlow';
import { updateBiometricPasswordIfSaved } from '../../utils/biometricLogin';
import { showAlert } from '../../utils/alert';
import { PasswordInput } from './PasswordInput';

/** "Choose a new password" + "Confirm new password". Shown to someone who is
 * signed in only because they opened the link in a reset-password email, so
 * no old password or code is asked for - the email link was the proof. */
export function NewPasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const issue = passwordIssue(password);
    if (issue) {
      showAlert('Choose a stronger password', issue);
      return;
    }
    if (password !== confirm) {
      showAlert('Passwords don’t match', 'Type the same new password in both boxes.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsSubmitting(false);
      showAlert('Couldn’t set the new password', authErrorMessage(error));
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
    // Ends the reset and sends them home, signed in. Done as an explicit
    // replace('/'): a <Redirect href="/"> from inside the (auth) group would
    // resolve to that group's first screen, the sign-in form. Clearing the
    // flag swaps the page frame, so nothing after these two lines may rely on
    // this component still being mounted.
    useAuthStore.getState().setRecovering(false);
    router.replace('/');
  }

  return (
    <View>
      <Text className="mb-1.5 text-xs font-semibold text-gray-500">New password</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
        containerClassName="mb-1.5"
      />
      <Text className="mb-3.5 text-[11px] text-gray-400">At least 8 characters, with letters and numbers.</Text>

      <Text className="mb-1.5 text-xs font-semibold text-gray-500">Confirm new password</Text>
      <PasswordInput
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        containerClassName="mb-6"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        className="mb-2 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
      >
        <Text className="text-[15px] font-bold text-white">{isSubmitting ? 'Updating…' : 'Update password'}</Text>
      </Pressable>
    </View>
  );
}
