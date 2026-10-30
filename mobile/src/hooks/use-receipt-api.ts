import { useCallback, useMemo } from "react";
import { confirmReceiptMatch } from "../receipts/matchReceipt";
import { fetchCompanyReceipts } from "../receipts/receiptList";
import { retryFailedReceipt, submitReceipt } from "../receipts/submitReceipt";
import { useSession } from "../providers/session-provider";

export function useReceiptApi() {
  const { apiUrl, idToken } = useSession();

  const getReceipts = useCallback(
    (companyId: string) => fetchCompanyReceipts({ apiUrl, idToken: idToken ?? "", companyId }),
    [apiUrl, idToken],
  );
  const submit = useCallback(
    (input: Omit<Parameters<typeof submitReceipt>[0], "apiUrl" | "idToken">) =>
      submitReceipt({ ...input, apiUrl, idToken }),
    [apiUrl, idToken],
  );
  const retry = useCallback(
    (input: Omit<Parameters<typeof retryFailedReceipt>[0], "apiUrl" | "idToken">) =>
      retryFailedReceipt({ ...input, apiUrl, idToken }),
    [apiUrl, idToken],
  );
  const confirmMatch = useCallback(
    (input: Omit<Parameters<typeof confirmReceiptMatch>[0], "apiUrl" | "idToken">) =>
      confirmReceiptMatch({ ...input, apiUrl, idToken }),
    [apiUrl, idToken],
  );

  return useMemo(
    () => ({ getReceipts, submit, retry, confirmMatch }),
    [getReceipts, submit, retry, confirmMatch],
  );
}
