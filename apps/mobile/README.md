# Doodhwala Mobile (Expo)

This is the native mobile app workspace for Doodhwala. The web app remains in `apps/web`; this project targets Android and iOS from one React Native + Expo + TypeScript codebase.

## Local development

1. Install a supported Node.js LTS version and npm.
2. Copy `.env.example` to `.env`.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to a **staging** Supabase project and its public publishable/anon key. Leave them empty to preview the UI foundation without live data.
4. From this directory run `npm install`, then `npm run start`.
5. Open Expo Go or a development build on a device, or use `npm run android` / `npm run ios` where native tooling is available.

Never put a service-role key, database password, or any privileged secret in an `EXPO_PUBLIC_*` variable. Values with that prefix are included in the client bundle.

## Current foundation

- Native-friendly Doodhwala landing screen and selectable milk categories.
- SecureStore-backed Supabase auth storage adapter.
- Explicit environment validation state.
- App identifiers and deep-link scheme reserved for Doodhwala.
- Shared backend direction with the Next.js website.

## Next implementation gates

- Confirm staging environment and Supabase Auth redirect/deep-link allowlist.
- Connect live seller discovery using the repository's existing, verified RPC contracts; do not guess database tables.
- Implement sign-in and session lifecycle with device tests.
- Add customer cart/checkout/orders/subscriptions and seller workspace using the same backend rules.
- Add notifications only after device tokens, consent, and server-side authorization are designed.
- Configure EAS build profiles and signing credentials; run Android/iOS device tests before store submission.

The app is a foundation, not a store-ready release. Live ordering, authentication journeys, device validation, store assets, privacy disclosures, and release builds are still required.
