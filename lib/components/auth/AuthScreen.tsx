// lib/components/auth/AuthScreen.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { AppLogo } from '../AppLogo';

/** The frame the pre-login screens share: logo on top, content centred, and
 * the keyboard never covering a field. login.tsx and register.tsx carry their
 * own copy of this; the Android measurement fix below is the same one. */
export function AuthScreen({ children, logoSize = 100 }: { children: ReactNode; logoSize?: number }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // On some Android devices KeyboardAvoidingView's automatic resize doesn't
  // kick in (edge-to-edge layouts), so pad by the keyboard's real height.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24, paddingBottom: 24 + keyboardHeight }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5 items-center">
          <AppLogo size={logoSize} />
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
