import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SYNTHETIC_IMAGES, type SyntheticImageId } from "../receipts/receiptDraft";
import { showFakeReceipts } from "../receipts/showFakeReceipts";

export function CaptureScreen(props: {
  error: string | null;
  onUpload: () => void;
  onFakeReceipt: (imageId: SyntheticImageId) => void;
}) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Capture</Text>
      <Text style={styles.hint}>Camera opens when you tap Capture. Or choose a photo from your library below.</Text>
      <Pressable accessibilityLabel="Choose from library" style={styles.library} onPress={props.onUpload}>
        <Ionicons name="images-outline" size={42} color="#616b66" />
        <Text style={styles.libraryText}>Tap to choose from library</Text>
      </Pressable>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      {showFakeReceipts() ? (
        <>
          <Text style={styles.label}>Use a fake receipt</Text>
          <View style={styles.fakes}>
            {SYNTHETIC_IMAGES.map((image) => (
              <Pressable key={image.id} style={styles.fake} onPress={() => props.onFakeReceipt(image.id)}>
                <Text>{image.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600" },
  hint: { color: "#333", lineHeight: 20 },
  library: {
    flex: 1,
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c9c9c4",
    backgroundColor: "#e7e9e4",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  libraryText: { color: "#5c6560", fontWeight: "600" },
  error: { color: "#8a1f1f" },
  label: { fontSize: 13, color: "#555", marginTop: 4 },
  fakes: { flexDirection: "row", gap: 8 },
  fake: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#0f381f",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
