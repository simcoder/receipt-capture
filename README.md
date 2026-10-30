# Receipt capture

Synthetic receipt-capture proof of concept. A reviewer can sign in as a seeded company, capture a receipt, queue it offline, and see **Confirmed** only after the server accepts it. A retry does not create a second receipt. Switching company cannot upload the other company's queue.

This is not a product. There is no employer code, customer data, or live card data in this repo.

## Time box

Started 2026-10-29. This is a multi-day slice aimed at one coherent demo. Extra time does not add scope. What is still out of scope is listed in [DECISIONS.md](DECISIONS.md).

## Status

| Piece | State |
| --- | --- |
| README and decision log | Published with issue 1. |
| Money and dates | Issue 2. Integer minor units. Dates are `MM-DD-YYYY`. |
| Receipt state machine | Issue 3. Queue acceptance is `Queued`. `Confirmed` only from a server accept or a user correction. |
| Idempotency and company switch | Issue 4. A lost success returns the same receipt. Another company's key is rejected. Logout clears the queue. |
| Matching | Issue 5. Exact currency and minor units, then merchant similarity. One transaction cannot take two receipts. A late processor result does not overwrite a user correction. |
| Expo client | Not started. Issue 6. |
| AWS stack | Written locally in `infra/`. Issue 9. Not deployed. Cleanup is `infra/CLEANUP.md`. |
| Five-minute demo | Not recorded. |

## Run the tests

Requires Node.js 22.18 or newer.

```bash
npm install
npm test
npm run typecheck
```

There is no app to launch yet. When the Expo client exists, `npx expo start` will run against a local fake API if AWS is down.

## Companies

Two synthetic companies, decided up front so later issues do not drift:

- `northwind` — user `northwind.demo`
- `contoso` — user `contoso.demo`

Passwords, for when the stack is deployed:

| Username | Password | Company |
| --- | --- | --- |
| `northwind.demo` | `Northwind-demo-1` | `northwind` |
| `contoso.demo` | `Contoso-demo-1` | `contoso` |

They are demo passwords, not personal secrets.

## AI tools

Cursor, with Grok 4.7, drafted the repo layout, domain module, CDK stack, and these notes. The domain rules were checked with `npm test` from this folder. The API rule copy was checked with `npm test` inside `infra/`. Nothing from an employer repository was copied. The stack has not been deployed.
