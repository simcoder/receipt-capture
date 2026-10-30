import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { openMatches } from "../receipts/matchReceipt";
import { formatMoney } from "../receipts/receiptDraft";
import type { CompanyReceipt } from "../receipts/receiptList";

export function ReviewReceipt(props: {
  receipt: CompanyReceipt;
  siblings: readonly CompanyReceipt[];
  error: string | null;
  onConfirm: (transactionId: string) => void;
}) {
  const choices = openMatches(props.receipt, props.siblings);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Review</Text>
      <Text style={styles.label}>Merchant</Text>
      <Text style={styles.value}>{props.receipt.merchant}</Text>
      <Text style={styles.label}>Amount</Text>
      <Text style={styles.value}>{formatMoney(props.receipt.amountMinor, props.receipt.currency)}</Text>
      <Text style={styles.label}>Currency</Text>
      <Text style={styles.value}>{props.receipt.currency}</Text>
      <Text style={styles.label}>Date</Text>
      <Text style={styles.value}>{props.receipt.date}</Text>
      <Text style={styles.label}>Match</Text>
      {choices.length === 0 ? <Text>No open match</Text> : null}
      {choices.map((choice) => (
        <View key={choice.transactionId} style={styles.choice}>
          <Text>
            {choice.merchant} · {formatMoney(choice.amountMinor, choice.currency)}
          </Text>
          <Pressable accessibilityLabel={`Confirm ${choice.merchant}`} style={styles.primary} onPress={() => props.onConfirm(choice.transactionId)}>
            <Text style={styles.primaryText}>Confirm match</Text>
          </Pressable>
        </View>
      ))}
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, gap: 8, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  label: { fontSize: 13, color: "#555", marginTop: 8 },
  value: { fontSize: 16 },
  choice: { gap: 8, marginTop: 4 },
  primary: {
    backgroundColor: "#0f381f",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  error: { color: "#8a1f1f" },
});
