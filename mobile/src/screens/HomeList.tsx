import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "../receipts/receiptDraft";
import type { CompanyReceipt } from "../receipts/receiptList";

export function HomeList(props: {
  companyId: string;
  receipts: readonly CompanyReceipt[];
  error: string | null;
  onReview: (receiptId: string) => void;
}) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Receipts</Text>
      <Text style={styles.label}>Company</Text>
      <Text>{props.companyId}</Text>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      {props.receipts.length === 0 && !props.error ? <Text>No receipts yet</Text> : null}
      {props.receipts.map((receipt) => {
        const body = (
          <>
            <Text style={styles.merchant}>{receipt.merchant}</Text>
            <Text>{formatMoney(receipt.amountMinor, receipt.currency)}</Text>
            <Text>{receipt.date}</Text>
            <Text style={styles.status}>{receipt.status}</Text>
          </>
        );
        if (receipt.status !== "NeedsReview") {
          return (
            <View key={receipt.receiptId} style={styles.receipt}>
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={receipt.receiptId}
            accessibilityLabel={`Review ${receipt.merchant}`}
            style={styles.receipt}
            onPress={() => props.onReview(receipt.receiptId)}
          >
            {body}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#0f381f",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  error: { color: "#8a1f1f" },
});
