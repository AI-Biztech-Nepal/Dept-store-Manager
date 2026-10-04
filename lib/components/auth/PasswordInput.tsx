// lib/components/auth/PasswordInput.tsx
import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'className'> & {
  /** Spacing around the whole field, e.g. "mb-3.5". */
  containerClassName?: string;
};

/** The sign-in / sign-up password box, with the eye that shows what was
 * typed (typing a new password blind is how people lock themselves out). */
export function PasswordInput({ containerClassName, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View className={containerClassName}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="••••••••"
        placeholderTextColor="#9CA3AF"
        {...props}
        secureTextEntry={!visible}
        className="rounded-xl border-[1.5px] border-gray-200 py-3.5 pl-4 pr-12 text-sm text-gray-900"
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-3.5 justify-center"
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
      </Pressable>
    </View>
  );
}
