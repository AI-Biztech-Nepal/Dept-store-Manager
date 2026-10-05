// lib/components/auth/AccountSecurityCard.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { sendRecoveryLink } from '../../utils/authEmail';
import { authErrorMessage } from '../../utils/authFlow';
import { showAlert } from '../../utils/alert';
import { ResendCode } from './ResendCode';

/** Who this device is signed in as, and Change password. Changing it goes
 * through a link emailed to the account address - the same proof the
 * forgot-password screen uses - so a phone left unlocked can't quietly take
 * the account. The link opens "choose a new password". */
export function AccountSecurityCard({ email }: { email: string }) {
  const [linkSent, setLinkSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function sendLink() {
    setIsSending(true);
    const { error } = await sendRecoveryLink(email);
    setIsSending(false);
    if (error) {
      showAlert('Couldn’t send the link', authErrorMessage(error));
      return;
    }
    setLinkSent(true);
  }

  return (
    <View className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs font-semibold text-gray-500">Signed in as</Text>
      <Text className="mb-4 mt-0.5 text-sm font-semibold text-gray-900">{email}</Text>

      {linkSent ? (
        <>
          <Text className="mb-2 text-[12.5px] text-gray-500">
            We emailed a link to {email}. Open it to choose your new password.
          </Text>
          <ResendCode email={email} send={() => sendRecoveryLink(email)} noun="link" />
          <Pressable onPress={() => setLinkSent(false)} className="items-center py-2">
            <Text className="text-[12.5px] font-bold text-gray-500">Done</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="mb-3 text-[12.5px] text-gray-500">
            To change your password we’ll email a link to this address first.
          </Text>
          <Pressable
            onPress={sendLink}
            disabled={isSending}
            className="items-center rounded-xl border border-gray-300 py-3 disabled:opacity-50"
          >
            <Text className="text-sm font-bold text-gray-700">{isSending ? 'Sending link…' : 'Change password'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
