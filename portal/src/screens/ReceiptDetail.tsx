import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useReceiptApi } from "../hooks/use-receipt-api.ts";
import { useSession } from "../providers/session.tsx";
import { openMatchChoices } from "../receipts/choices.ts";
import { formatConfidence, formatMoney, type PortalReceipt, type PortalTransaction } from "../receipts/receipts.ts";

export function ReceiptDetail() {
  const { receiptId = "" } = useParams();
  const session = useSession();
  const api = useReceiptApi();
  const [receipt, setReceipt] = useState<PortalReceipt | null>(null);
  const [transactions, setTransactions] = useState<PortalTransaction[]>([]);
  const [siblings, setSiblings] = useState<PortalReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getReceipt(receiptId), api.getReceipts(), api.getTransactions()])
      .then(([one, rows, seeds]) => {
        if (cancelled) return;
        setReceipt(one);
        setSiblings(rows);
        setTransactions(seeds);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load the receipt");
      });
    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  if (!receipt) {
    return (
      <main className="page">
        <p><Link to="/">Receipts</Link></p>
        {error ? <p className="error">{error}</p> : <p>Loading receipt</p>}
      </main>
    );
  }

  const choices = receipt.status === "NeedsReview" ? openMatchChoices(receipt, transactions, siblings) : [];

  async function confirm(transactionId: string) {
    setBusy(true);
    setError(null);
    try {
      setReceipt(await api.confirmMatch(receiptId, transactionId));
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not confirm the match");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      setReceipt(await api.retry(receiptId));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Could not retry the receipt");
    } finally {
      setBusy(false);
    }
  }

  const matched = transactions.find((transaction) => transaction.id === receipt.matchedTransactionId);

  return (
    <main className="page">
      <p><Link to="/">Receipts</Link></p>
      <header>
        <h1>{receipt.merchant}</h1>
        <button type="button" onClick={session.logOut}>
          Log out
        </button>
      </header>
      <dl>
        <dt>Amount</dt>
        <dd>{formatMoney(receipt.amountMinor, receipt.currency)}</dd>
        <dt>Date</dt>
        <dd>{receipt.date}</dd>
        <dt>Status</dt>
        <dd>{receipt.status}</dd>
        <dt>Confidence</dt>
        <dd>{receipt.confidence === undefined ? "None" : formatConfidence(receipt.confidence)}</dd>
        <dt>Match</dt>
        <dd>{matched ? `${matched.merchant} · ${formatMoney(matched.money.amountMinor, matched.money.currency)}` : "None"}</dd>
        <dt>Photo</dt>
        <dd>{receipt.objectKey ? "Photo stored" : "No photo"}</dd>
      </dl>
      {error ? <p className="error">{error}</p> : null}
      {receipt.status === "NeedsReview" ? (
        <section>
          <h2>Open matches</h2>
          {choices.length === 0 ? <p>No open match</p> : null}
          <ul>
            {choices.map((choice) => {
              const transaction = transactions.find((row) => row.id === choice.transactionId);
              const label = transaction
                ? `${transaction.merchant} · ${formatMoney(transaction.money.amountMinor, transaction.money.currency)}`
                : choice.transactionId;
              return (
                <li key={choice.transactionId}>
                  <button type="button" disabled={busy} onClick={() => confirm(choice.transactionId)}>
                    Confirm {label} · {formatConfidence(choice.similarity)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {receipt.status === "Failed" ? (
        <button type="button" disabled={busy} onClick={retry}>
          Retry
        </button>
      ) : null}
    </main>
  );
}
