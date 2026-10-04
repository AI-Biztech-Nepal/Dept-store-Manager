// app/(auth)/verify-email.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { AuthScreen } from '../../lib/components/auth/AuthScreen';
import { OtpField } from '../../lib/components/auth/OtpField';
import { ResendCode } from '../../lib/components/auth/ResendCode';
import { resendSignupCode } from '../../lib/utils/authEmail';
import { OTP_LENGTH, authErrorMessage, normalizeEmail } from '../../lib/utils/authFlow';
import { showAlert } from '../../lib/utils/alert';

// Reached from register (new account) and from login (account whose email
// was never confirmed). Confirming the code is what signs the person in.
export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = normalizeEmail(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Opened without an address (a refreshed or hand-typed URL) - nothing to verify.
  if (!email) return <Redirect href="/(auth)/register" />;

  async function handleVerify() {
    if (code.length !== OTP_LENGTH) {
      showAlert('Enter the code', `Type the ${OTP_LENGTH}-digit code we emailed to ${email}.`);
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    setIsSubmitting(false);
    if (error) {
      showAlert('Couldn’t verify the code', authErrorMessage(error));
      return;
    }
    // Verified: Supabase has signed this device in, and the root layout picks
    // the session up. Home decides where a signed-in person goes.
    router.replace('/');
  }

  return (
    <AuthScreen>
      <Text className="text-center text-2xl font-extrabold text-gray-900">Check your email</Text>
      <Text className="mb-7 mt-1.5 text-center text-sm text-gray-500">
        We sent a {OTP_LENGTH}-digit code to{'\n'}
        <Text className="font-semibold text-gray-700">{email}</Text>
      </Text>

      <View className="mb-6">
        <OtpField value={code} onChange={setCode} autoFocus />
      </View>

      <Pressable
        onPress={handleVerify}
        disabled={isSubmitting}
        className="mb-2 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
      >
        <Text className="text-[15px] font-bold text-white">{isSubmitting ? 'Verifying…' : 'Verify email'}</Text>
      </Pressable>

      <ResendCode email={email} send={() => resendSignupCode(email)} />

      <Link href="/(auth)/login" className="mt-3 text-center text-[12.5px] text-gray-500">
        Wrong address? <Text className="font-bold text-orange-600">Back to sign in</Text>
      </Link>
    </AuthScreen>
  );
}
