import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectivity } from "../providers/connectivity-provider";
import { colors } from "../theme/colors";

export function ConnectivityBanner() {
  const insets = useSafeAreaInsets();
  const { online } = useConnectivity();
  return (
    <View style={[styles.banner, online ? styles.online : styles.offline, { paddingTop: insets.top }]}>
      <Text style={styles.label}>{online ? "Online" : "Offline"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingBottom: 8, alignItems: "center" },
  online: { backgroundColor: colors.primary },
  offline: { backgroundColor: colors.destructive },
  label: { color: "#fff", fontWeight: "600" },
});
