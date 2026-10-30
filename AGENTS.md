# Agent rules — receipt-capture

This directory is its own git repo. Commit and push from here, not from the parent `simcoder` checkout.

## Where files go

Do not add modules at `mobile/src/` root. Put each file in the folder that already owns that job.

| Path | Owns |
| --- | --- |
| `mobile/app/` | expo-router routes only. A route re-exports a screen. |
| `mobile/src/screens/` | Screens. |
| `mobile/src/providers/` | React context. The signed-in token lives in `session-provider.tsx`. The network banner state lives in `connectivity-provider.tsx`. |
| `mobile/src/hooks/` | Hooks. API access is `useReceiptApi`. |
| `mobile/src/api/client.ts` | The only `fetch` wrapper. |
| `mobile/src/auth/` | Cognito sign-in. |
| `mobile/src/receipts/` | Draft, list, submit, and match. Plain functions, tested without React. |
| `mobile/src/storage/` | The device queue. Tokens stay in SecureStore. |
| `src/domain/` | Money, dates, state, idempotency, and matching. |

`mobile/app/index.tsx` stays a one-line re-export. New UI goes in `mobile/src/screens/`.

## API calls

A new call is three steps:

1. Add a plain function under `mobile/src/receipts/` that calls `apiRequest`.
2. Add a method on `useReceiptApi` that fills `apiUrl` and `idToken` from `useSession`.
3. Call that method from the screen.

Screens do not call `fetch`. Screens do not take `apiUrl` or `idToken` as arguments.

```ts
const api = useReceiptApi();
const rows = await api.getReceipts(companyId);
```

`apiRequest` returns `{ ok, status, payload }`. A thrown `fetch` becomes `ApiTransportError`. An HTTP error is returned, not thrown. The caller treats status 500 and above as a transport failure and shows a 4xx message. The bearer token is the ID token.

Do not add React Query. Do not add an offline switch. Cafe, fuel, and office stay hidden unless `EXPO_PUBLIC_SHOW_FAKE_RECEIPTS` is `1`. The amount field goes through `maskAmount`. The date field is a picker and stores `MM-DD-YYYY`. Submit still uses `moneyFromDecimal`. Notes are optional. An empty note still submits. While online the capture button says Submit and the server validates the receipt. While offline it says Queue receipt. A returning network submits receipts that are still Queued. Only a NeedsReview row opens, and its fields stay read-only. Confirm uses the existing match call. The banner follows the device network. A receipt photo stays in memory for that visit. Do not write image bytes to AsyncStorage. `submitReceipt` sends `imageBase64` only when online and the image is under 500 KB.

## Names and packages

macOS is case-insensitive. `ReceiptList.tsx` and `receiptList.ts` are the same file. Name the screen something else, as `HomeList.tsx` does.

Domain imports from mobile code keep the `.ts` suffix: `../../../src/domain/money.ts`.

Do not set `"type": "module"` in `mobile/package.json`. `babel.config.js` uses `module.exports`.

Do not commit `mobile/.env`, a `mobile/tsconfig.json` rewrite from `expo start`, or `src/domain/index.ts`.
