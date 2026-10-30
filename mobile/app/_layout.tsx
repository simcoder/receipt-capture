import "react-native-gesture-handler";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConnectivityProvider } from "../src/providers/connectivity-provider";
import { SessionProvider } from "../src/providers/session-provider";
import { ConnectivityBanner } from "../src/screens/ConnectivityBanner";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <ConnectivityProvider>
          <View style={{ flex: 1 }}>
            <StatusBar style="light" />
            <ConnectivityBanner />
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </ConnectivityProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
