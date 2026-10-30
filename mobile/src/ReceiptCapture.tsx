import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  captureDraft,
  formatMoney,
  RECEIPT_STATUSES,
  SYNTHETIC_IMAGES,
  syntheticImageLabel,
  type LocalReceipt,
  type SyntheticImageId,
} from "./receiptDraft";

const IMAGE_COLORS: Record<SyntheticImageId, string> = {
  "cafe-receipt": "#8a5a44",
  "fuel-receipt": "#3d5a40",
  "office-receipt": "#2f4f6f",
};

export function ReceiptCapture(props: {
  companyId: string;
  offline: boolean;
  queueError: string | null;
  receipts: readonly LocalReceipt[];
  onChange: (receipts: LocalReceipt[]) => void;
  onOfflineChange: (offline: boolean) => void;
  onQueue: (localId: string) => void;
  onLogout: () => void;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState("");
  const [imageId, setImageId] = useState<SyntheticImageId | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    try {
      const draft = captureDraft({
        localId: `local-${props.receipts.length + 1}`,
        companyId: props.companyId,
        merchant,
        amount,
        currency,
        date,
        imageId: imageId ?? "",
      });
      props.onChange([...props.receipts, draft]);
      setMerchant("");
      setAmount("");
      setCurrency("USD");
      setDate("");
      setImageId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the receipt");
    }
  }

  function onQueue(localId: string) {
    setError(null);
    props.onQueue(localId);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Receipt capture</Text>
      <Text style={styles.label}>Company</Text>
      <Text>{props.companyId}</Text>
      <View style={styles.offlineRow}>
        <Text>Offline</Text>
        <Switch
          value={props.offline}
          onValueChange={props.onOfflineChange}
          trackColor={{ true: "#1f3a2e", false: "#ccc" }}
        />
      </View>
      <Text style={styles.note}>
        {props.offline
          ? "Offline. The queue is saved on this device and comes back after relaunch."
          : "The queue is saved on this device and comes back after relaunch."}
      </Text>
      {props.queueError ? <Text style={styles.error}>{props.queueError}</Text> : null}

      <Text style={styles.label}>Merchant</Text>
      <TextInput
        autoCapitalize="words"
        autoCorrect={false}
        onChangeText={setMerchant}
        placeholder="Northwind Cafe"
        style={styles.input}
        value={merchant}
      />
      <Text style={styles.label}>Amount</Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={setAmount}
        placeholder="12.34"
        style={styles.input}
        value={amount}
      />
      <Text style={styles.label}>Currency</Text>
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={setCurrency}
        placeholder="USD"
        style={styles.input}
        value={currency}
      />
      <Text style={styles.label}>Date</Text>
      <TextInput
        autoCorrect={false}
        onChangeText={setDate}
        placeholder="MM-DD-YYYY"
        style={styles.input}
        value={date}
      />

      <Text style={styles.label}>Synthetic image</Text>
      <View style={styles.images}>
        {SYNTHETIC_IMAGES.map((image) => {
          const selected = image.id === imageId;
          return (
            <Pressable
              key={image.id}
              onPress={() => setImageId(image.id)}
              style={[styles.imageCard, selected ? styles.imageCardSelected : null]}
            >
              <View style={[styles.swatch, { backgroundColor: IMAGE_COLORS[image.id] }]}>
                <View style={styles.line} />
                <View style={[styles.line, styles.lineShort]} />
                <View style={styles.line} />
              </View>
              <Text style={styles.imageLabel}>{image.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={onSave}>
        <Text style={styles.primaryText}>Save draft</Text>
      </Pressable>

      <Text style={styles.section}>Receipts</Text>
      {props.receipts.length === 0 ? <Text>No receipts yet</Text> : null}
      {props.receipts.map((receipt) => (
        <View key={receipt.localId} style={styles.receipt}>
          <Text style={styles.merchant}>{receipt.merchant}</Text>
          <Text style={styles.receiptId}>
            {receipt.receiptId
              ? `Receipt id ${receipt.receiptId}`
              : receipt.status === "Draft"
                ? "Receipt id appears after you queue"
                : "Receipt id appears when submit succeeds"}
          </Text>
          {!receipt.receiptId && props.queueError ? <Text style={styles.error}>{props.queueError}</Text> : null}
          {receipt.replayed ? <Text style={styles.receiptId}>Same receipt</Text> : null}
          {receipt.submitSource === "local-fake" ? <Text style={styles.receiptId}>Local fake</Text> : null}
          <Text>
            {formatMoney(receipt.amountMinor, receipt.currency)} · {receipt.amountMinor} minor units
          </Text>
          <Text>{receipt.date}</Text>
          <Text>{syntheticImageLabel(receipt.imageId)}</Text>
          {receipt.status === "Draft" ? (
            <Pressable style={styles.secondary} onPress={() => onQueue(receipt.localId)}>
              <Text>Queue receipt</Text>
            </Pressable>
          ) : null}
          <Text style={styles.label}>Status</Text>
          <View style={styles.rail}>
            {RECEIPT_STATUSES.map((status) => {
              const current = status === receipt.status;
              return (
                <Text key={status} style={[styles.status, current ? styles.statusCurrent : null]}>
                  {status}
                </Text>
              );
            })}
          </View>
          <Text style={styles.note}>Confirmed is set by the server or by a review correction.</Text>
        </View>
      ))}

      <Pressable style={styles.primary} onPress={props.onLogout}>
        <Text style={styles.primaryText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, gap: 8, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  offlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  section: { fontSize: 20, fontWeight: "600", marginTop: 16 },
  label: { fontSize: 13, color: "#555", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  images: { flexDirection: "row", gap: 8 },
  imageCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#fff",
    gap: 8,
  },
  imageCardSelected: { borderColor: "#1f3a2e", borderWidth: 2 },
  swatch: { height: 72, borderRadius: 4, padding: 8, justifyContent: "center", gap: 6 },
  line: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.85)" },
  lineShort: { width: "60%" },
  imageLabel: { fontSize: 12 },
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
  receiptId: { fontSize: 15, fontWeight: "600", color: "#1f3a2e" },
  rail: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  status: {
    fontSize: 12,
    color: "#555",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  statusCurrent: { backgroundColor: "#1f3a2e", borderColor: "#1f3a2e", color: "#fff" },
  note: { color: "#555", fontSize: 12, marginTop: 4 },
  primary: {
    backgroundColor: "#1f3a2e",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  secondary: {
    borderWidth: 1,
    borderColor: "#1f3a2e",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  error: { color: "#8a1f1f" },
});
