import { seedTransactions } from "../infra/lambda/receiptRules.mjs";

function amount(minor) {
  const whole = Math.trunc(minor / 100);
  const fraction = String(Math.abs(minor % 100)).padStart(2, "0");
  return `${whole}.${fraction}`;
}

const rows = [
  ["Company", "Transaction", "Merchant", "Amount"],
  ...seedTransactions.map((transaction) => [
    transaction.companyId,
    transaction.id,
    transaction.merchant,
    `${amount(transaction.money.amountMinor)} ${transaction.money.currency}`,
  ]),
];
const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => row[index].length)));

for (const row of rows) {
  console.log(row.map((cell, index) => cell.padEnd(widths[index])).join("  "));
}
