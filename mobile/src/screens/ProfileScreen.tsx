import { Pressable, StyleSheet, Text, View } from "react-native";

export function ProfileScreen(props: { companyId: string; onLogout: () => void }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.label}>Company</Text>
      <Text style={styles.company}>{props.companyId}</Text>
      <Pressable style={styles.logout} onPress={props.onLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  label: { fontSize: 13, color: "#555", marginTop: 8 },
  company: { fontSize: 22, fontWeight: "600" },
  logout: {
    marginTop: 24,
    backgroundColor: "#0f381f",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: { color: "#fff", fontWeight: "600" },
});
