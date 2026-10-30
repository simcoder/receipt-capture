import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReceiptApi } from "../hooks/use-receipt-api.ts";
import { useSession } from "../providers/session.tsx";
import { formatConfidence, formatMoney, type PortalReceipt } from "../receipts/receipts.ts";

export function ReceiptTable() {
  const session = useSession();
  const api = useReceiptApi();
  const [receipts, setReceipts] = useState<PortalReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getReceipts()
      .then((rows) => {
        if (!cancelled) setReceipts(rows);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load receipts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.idToken]);

  return (
    <main className="page">
      <header>
        <div>
          <h1>Receipts</h1>
          <p>{session.companyId}</p>
        </div>
        <button type="button" onClick={session.logOut}>
          Log out
        </button>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading receipts</p> : null}
      {!loading && !error && receipts.length === 0 ? <p>No receipts yet</p> : null}
      {receipts.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.receiptId}>
                <td>
                  <Link to={`/receipts/${receipt.receiptId}`}>{receipt.merchant}</Link>
                </td>
                <td>{formatMoney(receipt.amountMinor, receipt.currency)}</td>
                <td>{receipt.date}</td>
                <td>{receipt.status}</td>
                <td>{receipt.confidence === undefined ? "" : formatConfidence(receipt.confidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
