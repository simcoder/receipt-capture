import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { openMatches } from "../receipts/matchReceipt";
import {
  captureDraft,
  formatMoney,
  RECEIPT_STATUSES,
  SYNTHETIC_IMAGES,
  syntheticImageLabel,
  type LocalReceipt,
  type ReceiptImageId,
  type SyntheticImageId,
} from "../receipts/receiptDraft";

const IMAGE_COLORS: Record<SyntheticImageId, string> = {
  "cafe-receipt": "#8a5a44",
  "fuel-receipt": "#3d5a40",
  "office-receipt": "#2f4f6f",
};

export function ReceiptCapture(props: {
  companyId: string;
  queueError: string | null;
  receipts: readonly LocalReceipt[];
  onChange: (receipts: LocalReceipt[]) => void;
  onQueue: (localId: string) => void;
  onConfirm: (localId: string, transactionId: string) => void;
  matchError: string | null;
  onLogout: () => void;
  initialImageId?: ReceiptImageId;
  photoBase64?: string;
  onBack?: () => void;
  onSubmit?: (draft: LocalReceipt) => Promise<void>;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState("");
  const [imageId, setImageId] = useState<ReceiptImageId | null>(props.initialImageId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave() {
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
      if (props.onSubmit) {
        setSaving(true);
        try {
          await props.onSubmit(draft);
        } finally {
          setSaving(false);
        }
        return;
      }
      props.onChange([...props.receipts, draft]);
      setMerchant("");
      setAmount("");
      setCurrency("USD");
      setDate("");
      setImageId(props.initialImageId ?? null);
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
      {props.onBack ? (
        <Pressable onPress={props.onBack}>
          <Text style={styles.back}>Back to receipts</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>Receipt capture</Text>
      <Text style={styles.label}>Company</Text>
      <Text>{props.companyId}</Text>
      <Text style={styles.note}>The queue is saved on this device and comes back after relaunch.</Text>
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

      <Text style={styles.label}>{props.photoBase64 ? "Photo" : "Synthetic image"}</Text>
      {props.photoBase64 ? (
        <Image
          accessibilityLabel="Receipt photo"
          source={{ uri: `data:image/jpeg;base64,${props.photoBase64}` }}
          style={styles.photo}
        />
      ) : (
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
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={() => void onSave()} disabled={saving}>
        <Text style={styles.primaryText}>{props.onSubmit ? "Queue receipt" : "Save draft"}</Text>
      </Pressable>

      {props.onBack ? null : (
        <>
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
              {receipt.matchedTransactionId ? (
                <Text style={styles.receiptId}>Matched {receipt.matchedTransactionId}</Text>
              ) : null}
              {receipt.userCorrected ? <Text style={styles.receiptId}>You confirmed this match</Text> : null}
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
              {receipt.status === "NeedsReview" && receipt.receiptId ? (
                <MatchChoices
                  receipt={receipt}
                  siblings={props.receipts}
                  error={props.matchError}
                  onConfirm={(transactionId) => props.onConfirm(receipt.localId, transactionId)}
                />
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
        </>
      )}
    </ScrollView>
  );
}

function MatchChoices(props: {
  receipt: LocalReceipt;
  siblings: readonly LocalReceipt[];
  error: string | null;
  onConfirm: (transactionId: string) => void;
}) {
  if (!props.receipt.receiptId) return null;
  const choices = openMatches(
    {
      receiptId: props.receipt.receiptId,
      companyId: props.receipt.companyId,
      merchant: props.receipt.merchant,
      amountMinor: props.receipt.amountMinor,
      currency: props.receipt.currency,
      date: props.receipt.date,
      status: props.receipt.status,
    },
    props.siblings,
  );
  return (
    <View>
      <Text style={styles.label}>Match</Text>
      {choices.length === 0 ? <Text>No open match</Text> : null}
      {choices.map((choice) => (
        <View key={choice.transactionId} style={styles.matchChoice}>
          <Text>
            {choice.merchant} · {formatMoney(choice.amountMinor, choice.currency)}
          </Text>
          <Pressable style={styles.secondary} onPress={() => props.onConfirm(choice.transactionId)}>
            <Text>Confirm match</Text>
          </Pressable>
        </View>
      ))}
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, gap: 8, paddingBottom: 48 },
  back: { color: "#0f381f", fontWeight: "600", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  photo: { width: "100%", height: 180, borderRadius: 8, backgroundColor: "#eee" },
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
  imageCardSelected: { borderColor: "#0f381f", borderWidth: 2 },
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
  receiptId: { fontSize: 15, fontWeight: "600", color: "#0f381f" },
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
  statusCurrent: { backgroundColor: "#0f381f", borderColor: "#0f381f", color: "#fff" },
  note: { color: "#555", fontSize: 12, marginTop: 4 },
  primary: {
    backgroundColor: "#0f381f",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  secondary: {
    borderWidth: 1,
    borderColor: "#0f381f",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  matchChoice: { marginTop: 8 },
  error: { color: "#8a1f1f" },
});
