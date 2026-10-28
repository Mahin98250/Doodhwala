# Doodhwala Customer Profile & App-Style Navigation

## Objective
Replace the website-footer-only approach to account/legal discovery with a dedicated customer Profile screen that works on mobile and desktop.

## Existing user needs
Customers need one predictable destination for account status, orders, milk plans, saved sellers, notifications, support, and legal/privacy information. The existing legal page explicitly says the policies are drafts pending qualified legal review; the Profile must preserve that warning and must not imply final compliance.

## Information architecture
- **Account card:** signed-in state, name/email or phone from the existing Supabase session, sign-in for guests, local-only sign-out for signed-in users.
- **Quick actions:** orders, milk plans, saved sellers, updates.
- **Help & information:** support, seller entry point, about the marketplace.
- **Privacy & legal:** privacy policy, terms, cancellations/refunds, seller agreement, grievance, data rights, security.
- **Navigation:** six bottom-nav destinations remain; Profile occupies the account destination, and saved sellers remain reachable from the Profile shortcut and existing home saved view.
- **Routes:** both `/profile/` and legacy `/profile.html` resolve to the same Profile content for GitHub Pages compatibility.

## Blinkit-inspired comparison
Use the familiar grocery-app information hierarchy seen in Blinkit-style account experiences: a clear account identity area, high-frequency order actions, support grouped together, and legal/privacy links grouped at the bottom of a scrollable profile. Do not copy Blinkit logos, artwork, wording, or proprietary visual assets. Doodhwala keeps its own green/lime dairy identity, local independent seller model, and simple large-tap mobile rows.

## Visual direction
- App-like account hub rather than a web marketing page.
- Calm pale background, white grouped list surfaces, dark green account card, lime primary action, rounded but restrained components.
- Balanced density, readable touch targets, compact list descriptions, clear grouping.
- Responsive desktop header; hide desktop links on narrow screens and rely on the persistent six-item customer navigation.
- Respect safe-area insets, visible keyboard focus, and reduced-motion preferences.

## Safety boundaries
- Do not alter order, subscription, checkout, payment, seller, authorization, or database logic.
- Do not invent address-book or account settings features that do not exist.
- Do not render user metadata through HTML injection; use text content.
- Sign-out must use Supabase local scope and must not terminate other devices.
- Keep legal draft notices visible; no claims of completed legal review.
- Precache the page and assets, update cache version, and validate with existing regression tests.
