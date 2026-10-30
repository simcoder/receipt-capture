# Test plan

This records what was tested against the assignment. A reviewer can capture a synthetic receipt, enter the fields, keep the work when the network is down, submit or queue it, see whether the server confirmed it, and match it or leave it unmatched. The state diagram is Draft, Queued, Uploading, Processing, Failed, NeedsReview, and Confirmed. A local queue must never be shown as Confirmed.

Specs stay the shipped rules: [.spec/001-initial-poc.md](../.spec/001-initial-poc.md) and [.spec/002-ux.md](../.spec/002-ux.md). This document does not add product behavior.

## How to run

From `receipt-capture/`, after `npm install` and `npm ci --prefix infra`:

```bash
npm run test:all
```

That runs three commands and prints how many passed:

1. Domain unit tests (`npm test`).
2. Typecheck (`npm run typecheck`).
3. API rule tests (`npm test` in `infra/`).

A failing command stops the run and the process exits non-zero. Pull requests and pushes to `main` run the same command in GitHub Actions. The check on the pull request is green when all three pass and red when one fails. No AWS credentials and no Expo build are required.

Simulator rows below stay **Not run** until someone walks them in Expo. Press **r** in Metro to reload. No new native module is required.

## Types

| Type | What it covers |
| --- | --- |
| Domain unit | `npm test` and `npm run typecheck` from this folder. |
| API rules | `npm test` inside `infra/`. |
| Simulator | Hands-on walk in Expo. Cognito, taps, and the live API stay manual. |

## Assignment outcomes

| Id | Requirement | Type | Check | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| A1 | Select or capture a synthetic receipt image. | Domain unit and simulator | `test/receiptForm.test.ts` saves a draft with a synthetic image. `test/localQueue.test.ts` keeps a photo visit as an image id and rejects image bytes. Simulator: on a phone, Capture opens the camera. In the simulator, Capture stays on the library screen. Choose a seeded photo. | A receipt can be started from a synthetic image or a library photo. Image bytes are not stored in the device queue. | Pass (automated). Simulator not run. |
| A2 | Enter merchant, amount, currency, and transaction date. | Domain unit | `test/captureFields.test.ts` stores a picked date as `MM-DD-YYYY` and sends the masked amount through `moneyFromDecimal`. `test/money.test.ts` stores `12.34` as minor units and rejects a third decimal and a timestamp. | Amount is integer minor units. Date is `MM-DD-YYYY`. A third decimal cannot be stored. | Pass |
| A3 | Enter optional notes. | Code check | The capture form in `mobile/src/screens/ReceiptCapture.tsx` collects merchant, amount, currency, date, and an image. | The user can enter notes, and leaving notes empty still submits. | Fail |
| A4 | Save work when connectivity is unavailable, then submit or queue. | Domain unit and simulator | `test/localQueue.test.ts` reloads the queue after relaunch and stores metadata only. `test/submitReceipt.test.ts` uses the local fake when the API cannot be reached. Simulator: turn the network off, queue a receipt, confirm the row is not Confirmed, turn the network on, and confirm that receipt is not sent again. | Offline work stays on the device as Queued or the local fake. A returning network does not submit. | Pass (automated). Simulator not run. |
| A5 | See whether the server has actually confirmed the receipt. | Domain unit and simulator | `test/state.test.ts` treats queue acceptance as Queued, not Confirmed. Simulator: Blue Bottle at 18.50 USD becomes Confirmed. City Parking at 22.00 USD becomes NeedsReview. | Confirmed appears only after the server accepts the match or the user confirms a review. Queue acceptance is Queued. | Pass (automated). Simulator not run. |
| A6 | Match one seeded transaction, or leave it unmatched. | Domain unit and simulator | `test/matchReceipt.test.ts` offers Airport Parking for City Parking at 22.00 USD, hides that transaction after another receipt takes it, and copies Confirmed from the match API. `test/matching.test.ts` keeps a user correction when a later processor result arrives. Simulator: open the NeedsReview row, confirm Airport Parking, and the row becomes Confirmed. Pull the sheet down without confirming and the row stays NeedsReview. A second 22.00 USD parking receipt has no open match. | One transaction cannot take two receipts. Dismissing review leaves the receipt unmatched. | Pass (automated). Simulator not run. |

## State diagram

The domain machine is `src/domain/receiptState.ts`. These rows point at the unit test that already walks that edge. A simulator note is included when the label is what a person would see.

| Id | Edge | Type | Check | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| S1 | Submit while online moves toward upload and does not mark Confirmed because the queue accepted it. | Domain unit | `test/state.test.ts` walks Draft to Queued to Uploading to Processing. `serverConfirm` from Draft, Queued, or Uploading throws. | Uploading is not Confirmed. Confirmed is not reachable from Draft. | Pass |
| S2 | Submit while offline stays Queued until network and auth are available. | Domain unit | `acceptIntoQueue` returns Queued. Queued plus `startUpload` is Uploading. | Offline acceptance is Queued. Upload starts only from Queued. | Pass |
| S3 | An accepted upload reaches Processing, then Confirmed when the match is certain, or NeedsReview when it is not. | Domain unit and API rules | `transition("Uploading", "acceptUpload")` is Processing. `test/matching.test.ts` and `infra/test/receiptRules.test.mjs` confirm a close merchant and send an unrelated one to review. | Blue Bottle at 18.50 USD confirms. City Parking at 22.00 USD needs review. | Pass |
| S4 | A rejected or interrupted transfer is Failed, and retry uses the same intent. | Domain unit | `transition("Uploading", "fail")` is Failed. `transition("Failed", "retry")` is Queued. `test/idempotency.test.ts` and `test/submitReceipt.test.ts` return the same receipt for the same idempotency key. | Retry does not create a second receipt. | Pass |
| S5 | NeedsReview becomes Confirmed only after the user confirms. Fields stay as submitted. | Domain unit | `transition("NeedsReview", "userConfirm")` is Confirmed. `test/matchReceipt.test.ts` rejects a local confirm when the API rejects the transaction. | The client copies Confirmed from the match response. Merchant, amount, currency, and date are not edited. | Pass |

## Shipped regressions

These already run under `npm test`. No new tests were added for them.

| Id | Rule | Check | Expected | Result |
| --- | --- | --- | --- | --- |
| R1 | One company cannot read or upload the other company's queue. | `test/localQueue.test.ts`, `test/idempotency.test.ts`, `test/receiptList.test.ts` | A contoso queue and a contoso list are not returned for northwind. | Pass |
| R2 | Logout clears tokens and that company's device queue. | `test/shell.test.ts`, `test/localQueue.test.ts` | SecureStore keys and the company queue are empty after logout. | Pass |
| R3 | The API bearer is the ID token, and the body has no token. | `test/submitReceipt.test.ts` | The request is built without a token in the body. | Pass |
| R4 | Image bytes are not written to AsyncStorage. | `test/localQueue.test.ts`, `test/submitReceipt.test.ts` | A stored queue rejects image bytes. A photo is sent only when online and under 500 KB. | Pass |
| R5 | The amount mask keeps two decimals. | `test/captureFields.test.ts` | `12.344` is stored as `12.34` minor units `1234` only after `moneyFromDecimal` accepts the masked value. A raw third decimal throws. | Pass |
| R6 | The date picker stores `MM-DD-YYYY`. | `test/captureFields.test.ts`, `test/money.test.ts` | A picked day round-trips. `YYYY-MM-DD` and a timestamp are rejected. | Pass |
| R7 | The banner follows the device network. | `test/connectivity.test.ts` | Online when `isConnected` is not false. Offline only when the device reports no network. | Pass |
| R8 | Cafe, fuel, and office buttons stay hidden unless the env value is `1`. | `test/showFakeReceipts.test.ts` | Unset, empty, `0`, and `true` hide the buttons. `1` shows them. | Pass |

## Results log

2026-10-30: `npm run test:all` printed `3 of 3 commands passed`. Domain tests: 46 passed. Typecheck passed. API rule tests: 3 passed. A3 failed the code check: the capture form has no notes field. Simulator rows are not run.
