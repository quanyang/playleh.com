# MahjongLeh external account-deletion runbook

The public page is `https://playleh.com/account-deletion.html`. It satisfies the Google Play
requirement for an external deletion resource without requiring the application to be installed.
It is intentionally not deployed by this branch.

## Static-site architecture and Firebase Web app

This flow is intentionally a static site. `playleh.com` may continue to serve the checked-in HTML,
CSS, and JavaScript from GitHub Pages (or another static host). It does not require Firebase Hosting,
server-side rendering, a Cloud Function, or a second MahjongLeh backend.

A Firebase **Web app** is only a browser-client registration inside the existing
`mahjongleh-433ce` Firebase project. It is not a new Firebase project, a separate account universe,
a downloadable application, or a website deployment. It supplies the public browser configuration
used by the Firebase JavaScript SDK:

- `apiKey`;
- `appId`;
- `authDomain`;
- `projectId`.

Those values identify the client and project; they do not authorize account deletion. They may be
committed after the dedicated Web app exists and its API key is restricted appropriately. Never put
Firebase Admin credentials, an Apple private key/client secret, Google OAuth secrets, provider
access tokens, backend credentials, or service-account JSON in this repository.

The same Firebase project is mandatory so an Apple/Google login resolves to the same Firebase UID
used by the iOS and Android apps. Firebase's hosted `authDomain` handler performs the provider
exchange; the static page keeps the resulting Firebase session in memory, obtains a fresh ID token,
and calls the separate MahjongLeh backend:

```text
Static playleh.com page
  -> Firebase hosted Apple/Google authentication
  -> fresh Firebase ID token held in browser memory
  -> DELETE https://mahjong-go.playleh.com/v1/account
  -> backend verifies token/revocation and prepares deletion
  -> browser revokes Apple authorization when possible and deletes Firebase user
```

The backend remains the trusted dynamic component. Exact-origin CORS only lets the browser send the
request; it does not authenticate the user or grant deletion. The backend derives the project/UID
from the verified bearer token and never accepts an identity asserted by the static page.

### Handoff rules for the next implementer

- Do not create a new Firebase project or a separate user database.
- Do not move the page to Firebase Hosting merely because Firebase calls the registration a
  “Web app”; static GitHub Pages hosting is supported.
- Do not reuse an iOS/Android API key or app ID. Register the dedicated Web app and copy its public
  configuration.
- Do not add secrets or server-side deletion authority to the static site.
- Do not deploy the site or production backend to make testing easier. Complete the loopback/local
  backend flow and real-provider browser matrix first.
- Keep the API-key sentinel and disabled controls until the real Web config is committed and tested.
- The page activates only on `https://playleh.com` or HTTP loopback. The backend's non-production
  allowance for other exact HTTPS origins exists for potential future staging, but this page
  deliberately fails closed there; staging it would require editing `deletionEndpointFor` and is not
  part of this rollout.
- The single static file serves both production and local testing, so its CSP keeps loopback
  `connect-src` entries. They are inert in production because endpoint selection refuses loopback
  backends when the page is served from `playleh.com`.

## Trust and privacy boundary

- The page uses the Firebase JavaScript SDK with in-memory persistence only.
- It refuses to initialize Firebase Auth when embedded in another site's frame. If hosting changes,
  also send a `Content-Security-Policy: frame-ancestors 'none'` response header; `frame-ancestors`
  is not enforced from this static page's CSP `<meta>` element.
- It loads no Google Analytics, Tag Manager, advertising, Crashlytics, or RevenueCat code.
- It never renders, logs, stores, or sends a raw Firebase UID, email address, provider credential,
  ID token, or store receipt anywhere except the Firebase SDK's provider exchange and the ID token's
  `Authorization` header to the canonical MahjongLeh backend.
- The backend still derives identity only from a verified Firebase token and runs the same
  idempotent deletion preparation used by iOS and Android.
- CORS is not authorization. Production permits only the exact `https://playleh.com` origin and the
  actual request still fails closed without valid, non-revoked Firebase authentication.
- A provider selection that creates a new Firebase user is treated as "account not found." The page
  deletes that empty user and never invokes backend preparation for it.
- Guest-only accounts have no web-recoverable federated credential. The page provides a support
  fallback and warns users never to email passwords, tokens, provider credentials, or receipts.

## Required deployment order

1. Merge and deploy the backend exact-origin bridge first, with
   `SUPPORTER_ACCOUNT_DELETION_WEB_ORIGIN=https://playleh.com`.
2. Keep `SUPPORTER_ACCOUNT_DELETION_ENABLED=false` until the named Firestore database, schema, GA4
   Admin API, runtime identity, and local end-to-end deletion path are ready. Once account creation
   is exposed, this latch must remain enabled and healthy.
3. Register or confirm the dedicated Firebase Web app for this page. Replace or confirm the public
   `firebaseConfig` values from that registration; do not substitute an iOS or Android API key/app
   ID. The read-only Firebase Management check on 2026-07-23 returned no registered Web apps, so the
   committed API-key sentinel deliberately keeps sign-in disabled until a follow-up commit supplies
   the real public Web config. Restrict that public key to only the Firebase APIs this page needs and
   the intended web hosts.
4. In Firebase Authentication, add `playleh.com` to authorized domains (`localhost` is authorized
   by default, which is what makes local Google-provider testing work with no console change).
   Confirm the Google provider is enabled. Apple web sign-in additionally requires an Apple
   **Services ID** — unlike the native mobile flow — registered in the Apple Developer portal with
   the MahjongLeh App ID as its primary App ID, domain `mahjongleh-433ce.firebaseapp.com`, and
   return URL `https://mahjongleh-433ce.firebaseapp.com/__/auth/handler`, then entered in the
   Firebase Apple provider dialog together with the Team ID, Key ID, and Sign in with Apple private
   key. Popup sign-in is deliberate: redirect sign-in on non-Firebase hosting has extra
   cross-browser storage and domain configuration requirements.
5. Merge the website disclosure dependency before this branch, then publish this page.
6. Run the complete real-browser/device matrix below.
7. Only after the page is functional, enter
   `https://playleh.com/account-deletion.html` in Google Play Console's Data safety account-deletion
   URL and submit the updated disclosure for review.
8. Keep `feature_supporter_account_ui=false` until the in-app and external matrices both pass.

No step above enables Supporter purchases, RevenueCat, paid gameplay, or authenticated Classic
transport.

## Local automated checks

```sh
node --test tests/account-deletion-controller.test.mjs
tidy -errors -quiet account-deletion.html privacy-policy.html index.html
git diff --check
```

For a local static preview, serve this repository from loopback. The page deliberately maps an HTTP
loopback host to port `8080` on that same host and refuses to initialize destructive controls on any
non-loopback, non-canonical origin. Use `localhost` or `127.0.0.1` for browser testing: `localhost`
is a default Firebase authorized domain, and Chrome rejects IPv6-literal CSP sources, so the page's
CSP intentionally lists only the IPv4/name loopback backends. The page's `script-src` must keep
`https://apis.google.com`; Firebase popup sign-in loads its gapi channel script from there and fails
with `auth/internal-error` before any popup if it is blocked. Set the backend's exact page origin,
for example:

```sh
SUPPORTER_ACCOUNT_DELETION_WEB_ORIGIN=http://127.0.0.1:8081
```

Real Apple/Google popup testing additionally requires the served host to be authorized in Firebase.
Do not add a production domain or publish this page merely to bypass local test configuration.

## Release evidence matrix

- existing Google-linked account: prepare, delete Firebase user, and show success;
- existing Apple-linked account: prepare, revoke access token, delete Firebase user, and show success;
- Apple access-token absence/revocation failure: delete the account and show manual Apple follow-up;
- wrong Google and Apple accounts: remove the newly created empty Firebase user, never prepare the
  intended account, and never show deletion success;
- `account-exists-with-different-credential`: direct the user to the originally linked provider;
- popup canceled/blocked and provider or DNS outage: show a sanitized recovery state;
- embedded page and Firebase Auth initialization failure: disable all destructive controls and
  retain a usable support fallback;
- Firebase SDK/module load failure: keep sign-in disabled, show a sanitized error, and retain the
  static support fallback;
- unknown `isNewUser` metadata: fail closed and clear the in-memory session;
- backend `401`, `403`, `503`, redirect, timeout, and network failure: never revoke or delete the
  Firebase user and never show success;
- Firebase deletion failure after backend `204`: explain the partial state and require a fresh,
  idempotent retry;
- repeated backend preparation advances the GA4 deletion cutoff without regressing its durable
  timestamp;
- active/pending subscription warning, both store-management links, retained-ledger disclosure, and
  typed `DELETE` confirmation are visible and keyboard/screen-reader usable;
- guest-only support fallback remains usable without reinstalling the app;
- no Analytics request, browser persistence, UID/email rendering, or sensitive console output occurs.
