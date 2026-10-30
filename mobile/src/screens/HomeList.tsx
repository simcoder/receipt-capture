import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatMoney, SYNTHETIC_IMAGES, type SyntheticImageId } from "../receipts/receiptDraft";
import type { CompanyReceipt } from "../receipts/receiptList";

export function HomeList(props: {
  companyId: string;
  receipts: readonly CompanyReceipt[];
  error: string | null;
  captureError: string | null;
  onLogout: () => void;
  onOpenCamera: () => void;
  onUpload: () => void;
  onFakeReceipt: (imageId: SyntheticImageId) => void;
}) {
  const [showFakes, setShowFakes] = useState(false);
  return (
    <View style={styles.screen}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Receipts</Text>
      <Text style={styles.label}>Company</Text>
      <Text>{props.companyId}</Text>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      {props.receipts.length === 0 && !props.error ? <Text>No receipts yet</Text> : null}
      {props.receipts.map((receipt) => (
        <View key={receipt.receiptId} style={styles.receipt}>
          <Text style={styles.merchant}>{receipt.merchant}</Text>
          <Text>{formatMoney(receipt.amountMinor, receipt.currency)}</Text>
          <Text>{receipt.date}</Text>
          <Text style={styles.status}>{receipt.status}</Text>
        </View>
      ))}
      <Pressable style={styles.primary} onPress={props.onLogout}>
        <Text style={styles.primaryText}>Log out</Text>
      </Pressable>
    </ScrollView>
    {showFakes ? (
      <View style={styles.fakes}>
        {SYNTHETIC_IMAGES.map((image) => (
          <Pressable key={image.id} style={styles.fake} onPress={() => props.onFakeReceipt(image.id)}>
            <Text>{image.label}</Text>
          </Pressable>
        ))}
      </View>
    ) : null}
    {props.captureError ? <Text style={styles.error}>{props.captureError}</Text> : null}
    <View style={styles.bar}>
      <Pressable style={styles.side} onPress={props.onUpload}>
        <Text style={styles.sideText}>Upload a picture</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Open camera"
        style={styles.camera}
        onPress={props.onOpenCamera}
      >
        <View style={styles.cameraLens} />
      </Pressable>
      <Pressable style={styles.side} onPress={() => setShowFakes((open) => !open)}>
        <Text style={styles.sideText}>Use a fake receipt</Text>
      </Pressable>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 8, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  label: { fontSize: 13, color: "#555", marginTop: 8 },
  receipt: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    gap: 4,
    marginTop: 8,
  },
  merchant: { fontSize: 16, fontWeight: "600" },
  status: {
    alignSelf: "flex-start",
    marginTop: 4,
    fontSize: 12,
    color: "#fff",
    backgroundColor: "#1f3a2e",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  primary: {
    backgroundColor: "#1f3a2e",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  error: { color: "#8a1f1f", paddingHorizontal: 24 },
  fakes: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  fake: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1f3a2e",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    backgroundColor: "#f7f7f5",
  },
  side: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  sideText: { textAlign: "center", color: "#1f3a2e", fontWeight: "600" },
  camera: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1f3a2e",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  cameraLens: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: "#fff",
  },
});
