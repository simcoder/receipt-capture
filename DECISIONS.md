# Decisions

Living record for this proof of concept. An entry is added when the choice is made. Open items stay open until the work that forces them is done.

## Log

- 2026-10-29: Locked the product boundary, money, dates, states, idempotency, company isolation, and matching. Those rules are implemented in `src/domain` and covered by `npm test`.
- 2026-10-29: All project files stay inside `receipt-capture/`. The parent simcoder repo is not modified. Infrastructure lives only in `infra/`. Cleanup after the presentation is `infra/CLEANUP.md`. The stack is not deployed yet.
- 2026-10-29: Opened the public repo and issues 1–13 at https://github.com/simcoder/receipt-capture. All thirteen are on GitHub Project 4: https://github.com/users/simcoder/projects/4.
- 2026-10-29: Issue 1 publishes the README, this decision log, and the Node harness from this folder's own git root. Domain code and `infra/` stay uncommitted until those issues are in review.
- 2026-10-29: Code changes land through a pull request. A task that does not change this repo does not need one.
- 2026-10-29: Issue 2 sets receipt dates to `MM-DD-YYYY` and stores amounts as integer minor units.
- 2026-10-29: Issue 3 publishes the receipt state machine. Queue acceptance is `Queued`. `Confirmed` only follows `serverConfirm` or `userConfirm`.
- 2026-10-29: Issue 4 publishes idempotency and company switch. A lost success returns the same receipt. Logout clears the local queue.
- 2026-10-29: Issue 5 publishes matching. Exact money, then merchant similarity. One transaction cannot take two receipts. A late processor result does not overwrite a user correction.
- 2026-10-29: Issue 6 publishes the Expo sign-in shell. Cognito `USER_PASSWORD_AUTH`, tokens in SecureStore, logout clears the local queue.
- 2026-10-29: Issue 7 publishes the receipt form. It stores a draft with integer minor units, an `MM-DD-YYYY` date, and a chosen synthetic image. The screen shows every receipt state. Saving and queueing never mark `Confirmed`. When Cognito env is absent, the sign-in screen can open that form as `northwind` without calling Cognito.

## Accepted

### D1. Public synthetic app

The app lives entirely inside `receipt-capture/`. Nothing for this proof of concept is added to the parent simcoder repo. No employer code, customer data, signing keys, or live API tokens.

### D2. Expo is the client

The reviewer-facing client is Expo and TypeScript in `mobile/`, using expo-router and expo-secure-store. Sign-in is in-app `USER_PASSWORD_AUTH`. Tokens stay in SecureStore. Logout clears those tokens and the local queue. The receipt form captures merchant, amount, currency, an `MM-DD-YYYY` date, and one of the bundled synthetic images. It shows Draft, Queued, Uploading, Processing, Failed, NeedsReview, and Confirmed. This screen only creates a Draft and can move that draft to Queued. It does not mark Confirmed. The durable offline queue is a later issue.

### D3. Money is integer minor units

Amounts are parsed from decimal strings into an integer number of minor units plus an ISO currency code. Binary floats are rejected. This POC accepts non-negative amounts with at most two decimal places, so `"12.34"` USD is `1234`. Zero-decimal currencies such as JPY are a later change, not a silent special case.

### D4. Receipt dates are calendar dates

A receipt date is `MM-DD-YYYY`. Timestamps and `YYYY-MM-DD` are rejected. The value is not converted through a local timezone.

### D5. Confirmed is not a local queue state

States are Draft, Queued, Uploading, Processing, Failed, NeedsReview, and Confirmed. Putting a draft into the local queue yields Queued. Confirmed is reached only by `serverConfirm` from Processing, or `userConfirm` from NeedsReview.

### D6. Idempotency key lives with the receipt

The first submit stores the receipt id under the key and the company. A retry, including a lost success response, returns that same receipt id. A key from another company is rejected and does not reveal the stored receipt. This POC does not expire keys. A production TTL is out of scope; the next step would be a table TTL plus a documented replay window.

### D7. Company is the tenant boundary

Every queued receipt carries `company_id`. Upload is refused when the signed-in company does not match. Logout clears the local queue before another company can sign in. The two companies are `northwind` and `contoso`. The API, when it exists, must still check the company claim on every read and write. A hidden button is not authorization.

### D8. Cognito is created inside the CDK stack

Sign-in is Amazon Cognito with `USER_PASSWORD_AUTH` (in-app password, not a hosted UI). The pool, app client, and two seeded users are defined in `infra/`. Each user gets `custom:company_id`. Tokens will go in `expo-secure-store` when the Expo client exists. Demo passwords are in `infra/README.md`.

### D9. Teardown is `cdk destroy`

The only AWS stack is `ReceiptCapturePoc`, defined in `infra/`. DynamoDB and the user pool use `RemovalPolicy.DESTROY`. The S3 bucket uses `autoDeleteObjects` and `RemovalPolicy.DESTROY`. After the presentation, run the commands in `infra/CLEANUP.md` from that folder. The stack has not been deployed.

### D10. Matching is exact money, then merchant similarity

A candidate must share company, currency, and minor units, and must have merchant overlap after normalization (lowercase, punctuation stripped). Equal names score 1, a name contained in the other scores 0.8, otherwise the score is token overlap. Similarity of 0 is not a candidate. The user confirms the match. One transaction cannot take two receipts.

### D11. A late processor result cannot overwrite a correction

The processor is a deterministic fake. It may return NeedsReview. If the user has already corrected the receipt, or the receipt is already Confirmed, a later processor result is ignored.

### D12. Infrastructure has its own folder

CDK source, the Lambda, and the cleanup steps live in `infra/` so they can be found after the presentation without searching the app. Applying the stack (`npm run deploy` in that folder) is still a separate step. No SCS account and no copied employer stack. The Lambda repeats the money, date, and match rules so `infra/` does not import the Expo app. `infra/test` checks that copy.

### D13. Reviewer fallback does not require AWS

`npm test` already runs with no cloud account. `npx expo start` will be able to use a local fake API when the client exists. The deployed API is the production-like path.

### D14. Uploaded files stay in quarantine

The API stores an optional image under `quarantine/{companyId}/{receiptId}` as `application/octet-stream`. It does not serve the bytes back, and the bucket blocks public access. CORS on the HTTP API allows any origin because this is a presentation stack, not a production app.

### D15. Code changes go through a pull request

Anything that changes this repo is a pull request into `main`. A task that does not change the repo does not need one. Do not commit that work straight to `main`.

## Out of scope

Each item stays out until a later decision says otherwise.

| Omission | Next step if we continue |
| --- | --- |
| Real OCR | Replace the fake processor with a reviewed extraction call. Confirmed still requires server accept. |
| App Store or Play signing | A release build is a separate decision. The demo uses Expo Go or a simulator. |
| Push notifications | Not required to show queue and retry. |
| Detox or device UI tests | Domain tests are the gate. A simulator walkthrough is the demo. |
| Cognito hosted UI | Keep the in-app password flow. |
| Docker or Kubernetes | The API is one Lambda. |
| Background OS upload | The queue uploads while the app is open, then retries on relaunch. |
| Idempotency TTL | Add a documented replay window if this leaves the POC. |
| Zero-decimal currencies | Extend `moneyFromDecimal` with an exponent table and new tests. |

## Still open

- Where the on-device queue is stored. Metadata may persist locally. Tokens and receipt images must not sit in ordinary AsyncStorage or logs. The Expo issue decides the store.
- The exact HTTP contract and local fake. Written with the client wiring issue, after **Build this**.
- The five-minute demo script. Written after the deployed path works.
