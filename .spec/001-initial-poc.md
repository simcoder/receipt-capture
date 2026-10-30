# 001 — Initial receipt-capture POC

Status: complete on 2026-10-30.

This is the plan that shipped. Decisions made while building it are [DECISIONS.md](../DECISIONS.md), D1–D18. The demo script, the AI usage notes, and the recording are not part of this spec.

## Goal

A reviewer can sign in as a synthetic company, capture a receipt, queue it, and see Confirmed only after the server accepts it or the user confirms a match. A retry does not create a second receipt. One company cannot upload the other company's queue.

The app stays inside `receipt-capture/`. Infrastructure stays in `infra/`. Tear down is `npm run destroy` from that folder.

## What shipped

| Issue | Plan |
| --- | --- |
| 1 | Public repo, README, and this decision log, from this folder's own git root. |
| 2 | Amounts are integer minor units. Dates are `MM-DD-YYYY`. |
| 3 | Queue acceptance is Queued. Confirmed only follows a server accept or a user correction. |
| 4 | A lost success returns the same receipt. Another company's key is rejected. Logout clears the local queue. |
| 5 | Match on exact currency and minor units, then merchant similarity. One transaction cannot take two receipts. A late processor result does not overwrite a user correction. |
| 6 | In-app Cognito `USER_PASSWORD_AUTH`. Tokens in SecureStore. Logout clears those tokens and the local queue. |
| 7 | Receipt form: merchant, amount, currency, `MM-DD-YYYY` date, and one synthetic image. The screen shows every state and does not mark Confirmed on its own. |
| 8 | Offline toggle. Receipt metadata stays on the device and reloads after relaunch. Tokens and image bytes are not in that store. |
| 9 | CDK stack `ReceiptCapturePoc` in `infra/`. Deploy and destroy from that folder. Cleanup is `infra/CLEANUP.md`. |
| 10 | `POST /receipts` with `Idempotency-Key`. A lost success returns the same receipt. `npx expo start` uses a local fake when AWS is down. The bearer is the ID token. |
| 11 | A NeedsReview receipt lists open transactions. Confirm match copies Confirmed from that choice. A later processor result leaves the correction in place. |

Companies are `northwind` and `contoso`. Seeded users and passwords are in [infra/README.md](../infra/README.md).

## Checks

`npm test` and `npm run typecheck` from `receipt-capture/`. The API rule copy is `npm test` inside `infra/`. The simulator walkthrough is sign in, queue a receipt, and confirm a NeedsReview match.

## Left out of this spec

The five-minute demo script, the AI usage write-up, and the recording were issues 12 and 13. They are not remaining work for this spec. They get written with the next spec.
