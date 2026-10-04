// app/(auth)/forgot-password.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { AuthScreen } from '../../lib/components/auth/AuthScreen';
import { ResetPasswordForm } from '../../lib/components/auth/ResetPasswordForm';
import { sendRecoveryCode } from '../../lib/utils/authEmail';
import { OTP_LENGTH, authErrorMessage, isValidEmail, normalizeEmail } from '../../lib/utils/authFlow';
import { showAlert } from '../../lib/utils/alert';

// Step 1 asks for the email and has Supabase mail a code; step 2 takes the
// code and the new password together (see ResetPasswordForm for why they're
// one step). Supabase answers "sent" whether or not the address has an
// account, so this screen never reveals which emails are registered.
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendCode() {
    const trimmedEmail = normalizeEmail(email);
    if (!isValidEmail(trimmedEmail)) {
      showAlert('Check your email', 'Enter the email address you signed up with, e.g. you@example.com.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await sendRecoveryCode(trimmedEmail);
    setIsSubmitting(false);
    if (error) {
      showAlert('Couldn’t send the code', authErrorMessage(error));
      return;
    }
    setEmail(trimmedEmail);
    setStep('reset');
  }

  if (step === 'reset') {
    const sentTo = normalizeEmail(email);
    return (
      <AuthScreen>
        <Text className="text-center text-2xl font-extrabold text-gray-900">Reset your password</Text>
        <Text className="mb-7 mt-1.5 text-center text-sm text-gray-500">
          If an account exists for{'\n'}
          <Text className="font-semibold text-gray-700">{sentTo}</Text>
          {'\n'}we’ve sent it a {OTP_LENGTH}-digit code.
        </Text>

        <ResetPasswordForm
          email={sentTo}
          resend={() => sendRecoveryCode(sentTo)}
          onSuccess={() => router.replace('/')}
        />

        <Pressable onPress={() => setStep('email')} className="mt-3 items-center py-2">
          <Text className="text-[12.5px] text-gray-500">
            Wrong address? <Text className="font-bold text-orange-600">Use a different email</Text>
          </Text>
        </Pressable>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Text className="text-center text-2xl font-extrabold text-gray-900">Forgot password?</Text>
      <Text className="mb-7 mt-1.5 text-center text-sm text-gray-500">
        Enter your email and we’ll send you a code to set a new one.
      </Text>

      <Text className="mb-1.5 text-xs font-semibold text-gray-500">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#9CA3AF"
        className="mb-6 rounded-xl border-[1.5px] border-gray-200 px-4 py-3.5 text-sm text-gray-900"
      />

      <Pressable
        onPress={handleSendCode}
        disabled={isSubmitting}
        className="mb-4 items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-50"
      >
        <Text className="text-[15px] font-bold text-white">{isSubmitting ? 'Sending…' : 'Send code'}</Text>
      </Pressable>

      <Link href="/(auth)/login" className="text-center text-[12.5px] text-gray-500">
        Remembered it? <Text className="font-bold text-orange-600">Back to sign in</Text>
      </Link>
    </AuthScreen>
  );
}
