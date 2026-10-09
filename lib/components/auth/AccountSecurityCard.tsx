// lib/components/auth/AccountSecurityCard.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { sendRecoveryLink } from '../../utils/authEmail';
import { authErrorMessage } from '../../utils/authFlow';
import { showAlert } from '../../utils/alert';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Who this device is signed in as, and Change password (current + new + confirm).
 * For someone who has forgotten the current password there is still the emailed
 * reset link - the same one the sign-in screen's "Forgot password" sends. */
export function AccountSecurityCard({ email }: { email: string }) {
  const [isSending, setIsSending] = useState(false);

  async function sendLink() {
    setIsSending(true);
    const { error } = await sendRecoveryLink(email);
    setIsSending(false);
    if (error) {
      showAlert('Couldn’t send the link', authErrorMessage(error));
      return;
    }
    showAlert('Check your email', `We emailed a link to ${email}. Open it to choose a new password.`);
  }

  return (
    <View className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-semibold text-gray-500">Signed in as</Text>
      <Text className="mt-0.5 text-sm font-semibold text-gray-900">{email}</Text>

      <View className="my-4 border-t border-gray-100" />

      <Text className="mb-3.5 text-base font-bold text-gray-900">Change password</Text>
      <ChangePasswordForm email={email} />

      <Pressable onPress={sendLink} disabled={isSending} className="mt-3 items-center py-2 disabled:opacity-50">
        <Text className="text-[12.5px] font-bold text-gray-500">
          {isSending ? 'Sending link…' : 'Forgot your current password? Email me a reset link'}
        </Text>
      </Pressable>
    </View>
  );
}
