# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo use: the developer (Benoit) is the only real user of LeGrosBarbu today. Supabase auth exists for login security, not to onboard other people. Design and product decisions should optimize for one person's daily habit loop, not for a multi-tenant audience.

## Product Purpose

A daily nutrition, weight, and sport journal: log meals (with per-item kcal/protein/carbs/fat), track body weight over time, log sport sessions, and see day-by-day and trend views (goal-vs-actual calories, protein progress) in a "Journal" / "Bilan" (report) structure.

## Positioning

Total control, AI, and personalization, for free, with no ads — instead of MyFitnessPal/Yazio. Concretely: a self-curated food and recipe database (not a bloated shared one), an AI photo-estimation flow (Gemini) tuned to how the user actually eats, and no paywalls, ads, or features he doesn't use.

## Operating Context

- Used as an installed PWA on mobile (manifest + service worker), portrait-oriented, dark-themed by default.
- Daily loop: open Journal tab, log meals/sport/water via the bottom nav (Aliments, Recettes, Lieux, Sports, Poids, Réglages), check Bilan for trends.
- Food logging can go through: a personal food database, OpenFoodFacts lookups, a custom recipe/favorites system, or AI photo estimation.
- "Lieux" (Places) tracks favorite eating locations via Google Places address search.
- Data is backed by Supabase (per-user tables: entries, custom_foods, favorites, weight_entries, etc.).

## Capabilities and Constraints

- Stays French-only: UI, labels, and copy are not planned to be internationalized.
- Stays a free installable PWA — no native App Store / Play Store distribution planned.
- AI photo-estimation is BYO-key: each user pastes their own Gemini API key in Réglages (Settings); there is no server-side/shared AI key.
- Google Maps/Places also uses a user-supplied API key (localStorage), loaded conditionally at boot.
- No package.json / build tooling — plain HTML/CSS/JS served as static files (`index.html`, `app.js`, `styles.css`), with `index-complet.html` as a secondary/fuller variant of the entry page.

## Brand Commitments

- Name: "LeGrosBarbu" (French, informal/personal tone — not a commercial brand name). Used verbatim in the header logo, PWA title, and manifest.
- Existing dark theme (`#08080F` / `#0d0f14` background) and Inter typeface are the current identity; treat as incumbent visual system, not yet documented in DESIGN.md.

## Evidence on Hand

No external testimonials, case studies, or press — this is a personal tool with a single real user. Future work must not fabricate social proof, pricing, or multi-user claims.

## Product Principles

1. Optimize for one person's real daily habit, not generic multi-user onboarding.
2. Prefer user-owned control (own data, own API keys, own curated food list) over convenience features that add lock-in or shared infrastructure costs.
3. Keep it free and ad-free — no monetization surface should be designed in.
4. French-only, mobile-PWA-only — don't design for i18n or native app store affordances.
5. AI features are an enhancement layer (photo estimation) on top of manual logging, never a replacement requiring a key the user hasn't set up.
