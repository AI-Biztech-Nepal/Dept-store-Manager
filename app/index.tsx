// app/index.tsx
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/hooks/useAuth';

export default function Index() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  if (!session) return <Redirect href="/(auth)/login" />;

  // Session is restored a tick before the profile row arrives; showing a
  // spinner (instead of redirecting to login) is what keeps a page refresh
  // from forcing a fresh sign-in.
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return <Redirect href="/(store)/finance" />;
}
