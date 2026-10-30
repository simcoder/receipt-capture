import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type AppTab = "home" | "capture" | "profile";

const GREEN = "#3DDC84";
const BAR = "#121820";
const MUTED = "#9aa3ad";

export function AppMenu(props: {
  tab: AppTab;
  onHome: () => void;
  onCapture: () => void;
  onProfile: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityLabel="Home" style={styles.item} onPress={props.onHome}>
        <Ionicons name={props.tab === "home" ? "home" : "home-outline"} size={22} color={props.tab === "home" ? GREEN : MUTED} />
        <Text style={[styles.label, props.tab === "home" ? styles.labelOn : null]}>Home</Text>
      </Pressable>
      <Pressable accessibilityLabel="Capture" style={styles.captureHit} onPress={props.onCapture}>
        <View style={styles.capture}>
          <Ionicons name="camera" size={26} color="#102117" />
        </View>
        <Text style={[styles.label, props.tab === "capture" ? styles.labelOn : null]}>Capture</Text>
      </Pressable>
      <Pressable accessibilityLabel="Profile" style={styles.item} onPress={props.onProfile}>
        <Ionicons name={props.tab === "profile" ? "person" : "person-outline"} size={22} color={props.tab === "profile" ? GREEN : MUTED} />
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
    backgroundColor: BAR,
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
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: BAR,
  },
  label: { color: MUTED, fontSize: 11, fontWeight: "600" },
  labelOn: { color: GREEN },
});
