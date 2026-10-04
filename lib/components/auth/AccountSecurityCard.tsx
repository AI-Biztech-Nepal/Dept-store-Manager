// lib/components/auth/AccountSecurityCard.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { sendRecoveryCode } from '../../utils/authEmail';
import { OTP_LENGTH, authErrorMessage } from '../../utils/authFlow';
import { showAlert } from '../../utils/alert';
import { ResetPasswordForm } from './ResetPasswordForm';

/** Who this device is signed in as, and Change password. Changing it asks for
 * a code emailed to the account address - the same proof the forgot-password
 * screen asks for - so a phone left unlocked can't quietly take the account. */
export function AccountSecurityCard({ email }: { email: string }) {
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function sendCode() {
    setIsSending(true);
    const { error } = await sendRecoveryCode(email);
    setIsSending(false);
    if (error) {
      showAlert('Couldn’t send the code', authErrorMessage(error));
      return;
    }
    setCodeSent(true);
  }

  return (
    <View className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-semibold text-gray-500">Signed in as</Text>
      <Text className="mb-4 mt-0.5 text-sm font-semibold text-gray-900">{email}</Text>

      {codeSent ? (
        <>
          <Text className="mb-4 text-[12.5px] text-gray-500">
            We emailed a {OTP_LENGTH}-digit code to {email}. Enter it below with your new password.
          </Text>
          <ResetPasswordForm email={email} resend={() => sendRecoveryCode(email)} onSuccess={() => setCodeSent(false)} />
          <Pressable onPress={() => setCodeSent(false)} className="items-center py-2">
            <Text className="text-[12.5px] font-bold text-gray-500">Cancel</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="mb-3 text-[12.5px] text-gray-500">
            To change your password we’ll email a code to this address first.
          </Text>
          <Pressable
            onPress={sendCode}
            disabled={isSending}
            className="items-center rounded-xl border border-gray-300 py-3 disabled:opacity-50"
          >
            <Text className="text-sm font-bold text-gray-700">{isSending ? 'Sending code…' : 'Change password'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
