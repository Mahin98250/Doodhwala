# Doodhwala Mobile (Expo)

This is the native mobile app workspace for Doodhwala. The website stays in `apps/web`; this React Native + Expo + TypeScript app targets Android and iOS from one codebase.

## Local development

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env`.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to a **staging** Supabase project and its public publishable/anon key. Leave them empty to preview the UI without live data.
4. Run `npm install`, then `npm run start`.
5. Open Expo Go or a development build on a device, or use `npm run android` / `npm run ios` where native tooling is available.

Never put a service-role key, database password, or privileged secret in an `EXPO_PUBLIC_*` variable. Values with that prefix are included in the client bundle.

## Implemented foundation

- Doodhwala mobile home screen with green/white brand styling.
- Live seller discovery wired to the existing `find_nearby_providers_v2` Supabase RPC when staging configuration is supplied.
- Normalized provider/product display, INR pricing, text search and cow/buffalo/A2 filters.
- Location permission is requested only after the user taps the location action; clearing location re-runs discovery without coordinates.
- Loading, empty, not-configured and recoverable-error states; no invented demo sellers.
- Native email/password sign-in and account creation using Supabase Auth, with persisted SecureStore sessions, auth-state updates, sign-out, input checks, and email-confirmation messaging.
- SecureStore-backed Supabase session storage adapter.
- Android/iOS app identifiers, deep-link scheme, and platform-specific location disclosure.
- CI type-checks and exports the JavaScript bundles for both Android and iOS.

## Still required

- Confirm staging environment, RPC grants/RLS, response shape and auth redirect/deep-link allowlist.
- Verify sign-in and session lifecycle against staging Auth settings and physical devices, including email confirmation, password reset, deep links, and account recovery.
- Add customer cart/checkout/orders/subscriptions and seller workspace using the same backend rules. Do not guess RPC names or bypass backend price/stock/ownership checks.
- Add notifications only after device tokens, consent, and server-side authorization are designed.
- Configure EAS build profiles and signing credentials; run Android/iOS device tests before store submission.

This is an early mobile MVP foundation, not a store-ready release. Live authenticated ordering, device validation, store assets/signing, privacy disclosures, and release builds remain required.
