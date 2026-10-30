import { apiErrorMessage, apiRequest } from "../api/client.ts";
import { useSession } from "../providers/session.tsx";
import { parseReceiptBody, parseReceiptList, parseTransactions, type PortalReceipt, type PortalTransaction } from "../receipts/receipts.ts";

export function useReceiptApi() {
  const session = useSession();

  async function request(path: string, method: "GET" | "POST", body?: unknown) {
    const result = await apiRequest({
      apiUrl: session.config.apiUrl,
      idToken: session.idToken,
      path,
      method,
      body,
    });
    if (result.status === 401) session.logOut();
    return result;
  }

  return {
    async getReceipts(): Promise<PortalReceipt[]> {
      const result = await request("/receipts", "GET");
      if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Could not load receipts"));
      return parseReceiptList(result.payload);
    },
    async getReceipt(receiptId: string): Promise<PortalReceipt> {
      const result = await request(`/receipts/${receiptId}`, "GET");
      if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Could not load the receipt"));
      return parseReceiptBody(result.payload);
    },
    async getTransactions(): Promise<PortalTransaction[]> {
      const result = await request("/transactions", "GET");
      if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Could not load transactions"));
      return parseTransactions(result.payload);
    },
    async confirmMatch(receiptId: string, transactionId: string): Promise<PortalReceipt> {
      const result = await request(`/receipts/${receiptId}/match`, "POST", { transactionId });
      if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Could not confirm the match"));
      return parseReceiptBody(result.payload);
    },
    async retry(receiptId: string): Promise<PortalReceipt> {
      const result = await request(`/receipts/${receiptId}/reprocess`, "POST");
      if (!result.ok) throw new Error(apiErrorMessage(result.payload, "Could not retry the receipt"));
      return parseReceiptBody(result.payload);
    },
  };
}
