import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export type AppTab = "home" | "capture" | "profile";

export function AppMenu(props: {
  tab: AppTab;
  onHome: () => void;
  onCapture: () => void;
  onProfile: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityLabel="Home" style={styles.item} onPress={props.onHome}>
        <Ionicons name={props.tab === "home" ? "home" : "home-outline"} size={22} color={props.tab === "home" ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.label, props.tab === "home" ? styles.labelOn : null]}>Home</Text>
      </Pressable>
      <Pressable accessibilityLabel="Capture" style={styles.captureHit} onPress={props.onCapture}>
        <View style={styles.capture}>
          <Ionicons name="camera" size={26} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.label, props.tab === "capture" ? styles.labelOn : null]}>Capture</Text>
      </Pressable>
      <Pressable accessibilityLabel="Profile" style={styles.item} onPress={props.onProfile}>
        <Ionicons name={props.tab === "profile" ? "person" : "person-outline"} size={22} color={props.tab === "profile" ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.label, props.tab === "profile" ? styles.labelOn : null]}>Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  item: { flex: 1, alignItems: "center", gap: 4, paddingBottom: 2 },
  captureHit: { flex: 1, alignItems: "center", marginTop: -28, gap: 4 },
  capture: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.card,
  },
  label: { color: colors.mutedForeground, fontSize: 11, fontWeight: "600" },
  labelOn: { color: colors.primary },
});
