// lib/components/auth/OtpField.tsx
import { TextInput } from 'react-native';
import { OTP_LENGTH, cleanOtp } from '../../utils/authFlow';

/** The box for the 6-digit code from the email. Strips spaces and dashes so a
 * pasted "123 456" still works, and tells the phone it's a one-time code so
 * the keyboard can offer it from the Mail app. */
export function OtpField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(cleanOtp(text))}
      keyboardType="number-pad"
      inputMode="numeric"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={OTP_LENGTH + 4}
      autoFocus={autoFocus}
      placeholder={'•'.repeat(OTP_LENGTH)}
      placeholderTextColor="#D1D5DB"
      accessibilityLabel={`${OTP_LENGTH}-digit code`}
      style={{ letterSpacing: 10 }}
      className="rounded-xl border-[1.5px] border-gray-200 px-4 py-3.5 text-center text-2xl font-bold text-gray-900"
    />
  );
}
