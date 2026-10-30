# 003 — Receipt review portal

Status: built on 2026-10-30.

A public web page reviews the receipts the phone already submitted. The phone still creates them. The portal does not add a status, a second submit path, or an edit of merchant, amount, currency, or date. It does not delete a receipt. Notes stay on the phone. Photo bytes stay in quarantine.

The rules stay as shipped in [001-initial-poc.md](001-initial-poc.md), [002-ux.md](002-ux.md), and [DECISIONS.md](../DECISIONS.md).

## Who can open it

The site is public. CloudFront serves the static files over HTTPS on the distribution's `*.cloudfront.net` name. There is no custom domain, Route 53 record, or WAF. Anyone with that URL can open the sign-in page.

The files live in a private S3 bucket. Direct public access to the bucket stays blocked. CloudFront is the only reader, through origin access control. Price Class 100 keeps the distribution in North America and Europe.

Tear down stays `npm run destroy` from `infra/`. The bucket is destroyed with the stack.

## Sign-in

The page uses the existing Cognito app client and `USER_PASSWORD_AUTH`. There is no hosted UI. The bearer on the API is the ID token. The company is `custom:company_id` on that token. The same demo users as the phone sign in here.

The token stays in memory for the tab. It is not written to `localStorage` or `sessionStorage`. Logout drops it. A refresh asks for the password again.

The page reads `config.json` from the site on boot: region, user pool id, app client id, and API URL. Those values are not baked into the JavaScript build.

## What the page shows

After sign-in, a table lists `GET /receipts` for that company. Each row shows merchant, amount from integer minor units, currency, `MM-DD-YYYY` date, status, and confidence when the API sent a number.

Opening a row loads `GET /receipts/{receiptId}`. The fields are read-only. The detail says whether an object key is present. It does not show the photo.

A NeedsReview receipt can confirm one open match with the existing `POST /receipts/{id}/match`. A Failed receipt can retry with the existing `POST /receipts/{id}/reprocess`. The page copies Confirmed from the response. It does not mark Confirmed on its own. One transaction still cannot take two receipts.

No new API route. The HTTP API already allows any origin.

## Where it lives

The React app is `portal/`. It does not import `mobile/`. Plain functions call the API. Screens do not call `fetch`. Deploy is the existing `ReceiptCapturePoc` stack, after `npm run build` in `portal/`.
