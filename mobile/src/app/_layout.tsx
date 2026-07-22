import Ionicons from '@expo/vector-icons/Ionicons';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { loading } = useAuth();
  const ready = fontsReady && !loading;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // O Stack fica sempre montado (o expo-router precisa do navigator); enquanto
  // fontes/sessão resolvem, um overlay com spinner cobre a tela em vez de ficar branca.
  // O redirect entre login/tabs é feito no AuthProvider (useProtectedRoute).
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="live/[matchId]" />
        <Stack.Screen name="financeiro" />
      </Stack>
      {!ready && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.dark} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  // Carrega as fontes da marca + ícones. Se falhar, `fontError` libera a UI mesmo assim.
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    BebasNeue_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator fontsReady={fontsReady} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
