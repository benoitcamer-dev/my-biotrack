---
name: LeGrosBarbu
description: A private nightly instrument panel for food, weight, and sport — glassy near-black surfaces lit by a single violet accent.
colors:
  cockpit-violet: "#7C6FFF"
  cockpit-violet-deep: "#9B5CFF"
  signal-blue: "#5B7FFF"
  ink-black: "#08080F"
  panel: "#0F0F1A"
  panel-raised: "#16162A"
  panel-elevated: "#1E1E35"
  hairline: "rgba(255,255,255,0.05)"
  hairline-strong: "rgba(255,255,255,0.1)"
  ink-text: "#EEEEFF"
  ink-muted: "#6B6B99"
  ember-orange: "#FF8C42"
  mint-green: "#2ECC8F"
  bloom-pink: "#F062C0"
  alert-red: "#FF4D6A"
  favorite-gold: "#FFD166"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "60px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-3px"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "1.5px"
  unit:
    fontFamily: "Georgia, serif"
    fontSize: "0.9em"
    fontWeight: 400
    lineHeight: "inherit"
    letterSpacing: "normal"
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "16px"
  xl: "24px"
  2xl: "28px"
  pill: "999px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.cockpit-violet}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.cockpit-violet}"
  button-danger:
    backgroundColor: "{colors.alert-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "16px"
    typography: "{typography.label}"
  button-cancel:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  tab-segmented:
    backgroundColor: "rgba(255,255,255,0.02)"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
    padding: "14px 8px"
  tab-segmented-active:
    backgroundColor: "rgba(124,111,255,0.1)"
    textColor: "{colors.ink-text}"
  card-stat:
    backgroundColor: "rgba(255,255,255,0.03)"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  input-search:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    padding: "13px 16px"
---

# Design System: LeGrosBarbu

## Overview

**Creative North Star: "The Night Cockpit"**

LeGrosBarbu reads as a private instrument panel checked after dark: near-black ink surfaces (#08080F), glassy blurred layers, and a single electric-violet accent that lights up only what's live — the day's calorie readout, the active tab, a focused field. Nothing else competes for attention. The system is dense and fast rather than spacious: numbers sit close together, labels are small and wide-tracked, and the largest thing on any screen is always the number that matters most right now (calories, a macro total, a body-weight delta), rendered in a gradient-clipped display face with tight negative tracking that reads like a cockpit readout, not a marketing headline.

Depth comes from light, not gray. Ambient violet (and occasionally orange, pink, or green) glow signals "this is live/active/yours," while flat black shadows do the physical work of lifting sheets and dropdowns above the page. Corners are generous almost everywhere — this is a soft, tactile instrument panel, not a hard technical one — except where a sheet meets the bottom edge of the screen, where the rounding stops dead to say "anchored here."

The app has no gamification skin: no mascots, no emoji badges, no bright primary-color reward pops. Confidence comes from precision (tabular numerals, gradient-text hero figures, a Georgia-italic "g" unit mark) rather than decoration.

**Key Characteristics:**
- Near-black ink background with a single violet-blue accent gradient — everything else is grayscale until something needs to signal state
- Glow-as-elevation: colored ambient shadows for emphasis, neutral black shadows for physical lift
- Dense, glassy, mobile-first single column (480px), expanding to a 4-column stat grid past 900px
- Bottom sheets round only their top corners — a hard visual signature of "anchored to the bottom edge"
- Big gradient-clipped numerals with tight negative letter-spacing for hero stats; wide-tracked uppercase micro-labels everywhere else

## Colors

Almost monochrome by design — ink-black and grayscale surfaces carry the app; violet is the only color allowed to mean "primary," and every other hue is reserved for a specific semantic role, never decoration.

### Primary
- **Cockpit Violet** (#7C6FFF): the one accent. Primary buttons, active tab, focused input ring, protein macro, the hero gradient number's glow, the header logo's second word.
- **Cockpit Violet Deep** (#9B5CFF) / **Signal Blue** (#5B7FFF): the two colors the primary gradient interpolates toward — `linear-gradient(135deg, #7C6FFF, #5B7FFF)` for solid fills, `#7C6FFF → #9B5CFF` for the progress bar. Never used as flat solids on their own.

### Neutral
- **Ink Black** (#08080F): page background.
- **Panel** (#0F0F1A): base surface — cards, sheets, inputs at rest.
- **Panel Raised** (#16162A): one step up — hover/secondary surfaces, calendar day cells, icon-button backgrounds.
- **Panel Elevated** (#1E1E35): two steps up — the most raised flat surface (e.g. selected state fills).
- **Ink Text** (#EEEEFF): primary text, near-white with a violet cast.
- **Ink Muted** (#6B6B99): secondary text, labels, placeholders — a desaturated violet-gray, never plain gray.
- **Hairline** (rgba(255,255,255,0.05)) / **Hairline Strong** (rgba(255,255,255,0.1)): the only two border weights in the system.

### Semantic accents (role-locked, not decorative)
- **Ember Orange** (#FF8C42): calories burned/sport, and carbohydrates in the dashboard macro breakdown. (Both roles share this hue today — see Named Rule below.)
- **Mint Green** (#2ECC8F): "under goal" / expended-energy positive states.
- **Bloom Pink** (#F062C0): fat, in the dashboard macro breakdown.
- **Alert Red** (#FF4D6A): destructive actions, over-goal warnings.
- **Favorite Gold** (#FFD166): favorites and custom/user-created items only — never a general accent.

### Named Rules
**The One Accent Rule.** Cockpit Violet is the only color that means "primary action" or "brand." Every other hue is locked to a single semantic role (macro, sport, danger, favorite) and must not be reused as a generic accent.

**The Macro-Color Rule.** Protein = violet, Carbs = orange, Fat = pink is the canonical mapping (as shown on the dashboard macro pills). The meal-line macro badges currently use a second, blue/amber/orange mapping — that's drift against this rule, not a second valid system; new work should converge on the dashboard mapping.

## Typography

**Display / Body / Label Font:** Inter (with system sans-serif fallback) — the only typeface in the system.

**Character:** A single, disciplined grotesque used across every role, differentiated purely by weight, size, and tracking rather than by mixing families. Large numerals get heavy weight and tight negative tracking for a precise, technical feel; small labels get medium weight and wide positive tracking for an instrument-panel, "eyebrow" feel.

### Hierarchy
- **Display** (800, 60px, line-height 1, tracking -3px): the day's calorie number and calculator results — always gradient-clipped (`linear-gradient(135deg, #FFFFFF 35%, #C4BEFF)` with `background-clip: text`), never flat white.
- **Headline** (800, 22px, tracking -0.5px): stat-box values, meal group titles (18px variant).
- **Title** (700, 13–14px): recipe names, date-nav label, section titles — normal tracking.
- **Body** (500–600, 12–15px): entry descriptions, confirm-dialog copy, form values.
- **Label** (700, 9–12px, uppercase, tracking 1–2.5px): every section header, stat-box label, and macro-pill label. The wider the tracking, the more structural the label (section labels at 2.5px track wider than field labels at 1px).

### Named Rules
**The Gradient Numeral Rule.** Any number that is *the* headline figure of its card (the day's kcal total, a calculator result) is rendered in the display face with the white→lavender gradient text-clip and tight negative tracking — never as flat solid text at that size.

**The Georgia "g" Rule.** Gram units (`.unit-g`) render in italic Georgia serif at 0.9em — a small, deliberate typographic wink that breaks from Inter only for this one unit mark, making weight values feel hand-annotated against the otherwise mechanical numerals.

## Layout

Mobile-first single column, `max-width: 480px`, centered, with content padding of 14–16px — dense by design, not spacious; gaps between stacked elements run 6–16px, never the large open whitespace of a marketing page. Past `900px` the container widens to 760px and the stats grid switches from 2 to 4 columns, but nothing else about the density changes — this is a wider cockpit, not a different one.

Structural chrome is fixed and glassy: a sticky, blurred header (`backdrop-filter: blur(24px)`) pins to the top, and a fixed, blurred bottom nav (6 icon buttons) pins to the bottom with safe-area padding. Page content scrolls between them. Within a page, a two-tab segmented control (Journal / Bilan) governs top-level view switching; content below is organized into a hero stat card, a 2-up stat grid, a 3-up macro-pill row, and grouped list sections (meals, entries) — a consistent rhythm of "one hero, one grid, one list" repeated per page.

## Elevation & Depth

Hybrid: **ambient colored glow marks live/emphasized elements; flat neutral-black shadow physically lifts anything that overlays page content.** Nothing gets both roles at once except the hero kcal card, which combines a black outer shadow (grounding it against the page) with an inset white top highlight (a glass-edge catch-light) and a radial violet glow behind it (marking it as "the live one").

### Shadow Vocabulary
- **Ambient glow — accent** (`0 0 12–24px rgba(124,111,255,0.08–0.4)`): active tab, focused input ring, progress-bar fill, the hero card's background bloom. Always tied to a semantic color (violet by default, orange/pink/green when the emphasized value is sport/fat/positive).
- **Overlay lift** (`0 8px 32px rgba(0,0,0,0.4–0.5)` up to `0 -8px 48px rgba(0,0,0,0.5)` for bottom sheets): dropdowns, modal/settings sheets, the address-autocomplete panel. Neutral, no color — this shadow means "physically above the page," not "important."
- **Card grounding** (`0 4px 32px rgba(0,0,0,0.3)` + `inset 0 1px 0 rgba(255,255,255,0.05)`): the hero kcal card only — combines lift with a glass top-edge highlight.

### Named Rules
**The Glow-Is-Emphasis Rule.** Colored shadows always mean "live, active, or emphasized" — never plain decoration. If a colored glow appears on a static/inactive element, that's a bug, not a style choice. Anything that needs to visually float above other content (sheet, dropdown, popover) uses the neutral black overlay-lift shadow instead, regardless of what color the element itself is.

## Shapes

Generously rounded almost everywhere — the softness reads as tactile and approachable against the otherwise precise, instrument-panel numerals. Compact controls (calendar cells, small nav chips, mini buttons) sit at 6–11px; standard cards, inputs, and buttons at 14–18px; the hero card and major sheets at 24–28px. Fully round pill shapes (999px) mark anything meant to feel like a tag or a tappable chip (bottom-nav pills, meal-save/add buttons, badges); perfect circles (50%) mark dots and avatar-scale elements only.

### Named Rules
**The Half-Round Sheet Rule.** Every bottom sheet and modal (`.modal-sheet`, `.settings-sheet`, `.app-confirm-sheet`) rounds only its top two corners (`28px 28px 0 0` / `24px 24px 0 0`) and never its bottom corners — the flat bottom edge is what tells the eye "this is anchored to the screen edge, not floating."

## Components

### Buttons
- **Shape:** full-width, 16px radius, 16px vertical padding for primary actions; pill (999px) for compact tag-like actions (add/save buttons in list rows) and the header's icon buttons.
- **Primary:** violet gradient fill (`linear-gradient(135deg, #7C6FFF, #5B7FFF)`), white text, uppercase label-weight type with 2px tracking, accent-glow shadow (`0 4px 20px rgba(124,111,255,0.3)`).
- **Danger:** identical shape/typography to Primary but flat `#FF4D6A` fill and red-tinted glow — reserved for destructive confirms only.
- **Cancel/Ghost:** translucent white fill (`rgba(255,255,255,0.06)`), 1.5px translucent border, no glow — always paired below a Primary or Danger button, never used alone as a call to action.
- **Hover/Active:** primary and danger lift 1px and deepen their glow on hover; all buttons scale to 0.96–0.98 on press (`active` state) — a physical "pressed" micro-interaction, not a color change.

### Cards / Containers
- **Corner Style:** 16–18px for stat/recipe/day cards, 28px for the hero kcal card.
- **Background:** translucent white-on-dark (`rgba(255,255,255,0.03)`) for stat/macro/recipe cards; the hero card alone uses the dedicated `--gradient-surface` background for extra depth.
- **Shadow Strategy:** stat/recipe cards are flat (hairline border only, no shadow) — depth is reserved for the hero card and anything overlaying content (see Elevation & Depth).
- **Border:** 1px hairline (`rgba(255,255,255,0.05)`) at rest; a stronger hairline or accent tint on hover/clickable state.
- **Internal Padding:** 12–14px standard, 20–24px for the hero card.

### Inputs / Fields
- **Style:** translucent white fill (`rgba(255,255,255,0.06)`), 14px radius, no visible border at rest beyond a faint hairline.
- **Focus:** border shifts to accent violet, background tints violet (`rgba(124,111,255,0.06)`), plus a soft accent focus ring (`0 0 0 3px rgba(124,111,255,0.1)`) — glow-as-focus-indicator, consistent with the Glow-Is-Emphasis rule.
- **Error/Disabled:** not yet a distinct documented state — style directly from `--danger` if/when built, following the Danger button's red-glow language.

### Navigation
- **Bottom nav:** fixed, blurred, 6 icon+label buttons (Aliments, Recettes, Lieux, Sports, Poids, Réglages) in muted gray at rest, violet on hover/active, with a scale-down press state.
- **Tabs (segmented control):** 2-up grid, flat translucent background at rest; active tab gets a violet-tinted fill, border, and ambient glow — the same "glow means live" language as everywhere else.
- **Modal/date-picker navigation:** compact icon-chip prev/next buttons on `--surface2`, 6–8px radius — noticeably smaller and flatter than primary content chrome, keeping wayfinding controls visually subordinate to content.

### Signature Component: the Hero KCal Card
The one card every session opens on: a 28px-radius panel on the dedicated surface gradient, with a radial violet bloom positioned top-center behind the content, a gradient-clipped display-face number, a thin pill-shaped progress bar (violet gradient fill, glowing), and a 2-up stat grid beneath it. This card is the system's single point of maximum visual weight — everything else in the interface is deliberately quieter than it.

## Do's and Don'ts

### Do:
- **Do** reserve Cockpit Violet for primary actions, active/live state, and protein — never as a generic decorative accent.
- **Do** use colored ambient glow only to mean "this is live, active, or emphasized"; use neutral black shadow for anything physically overlaying content.
- **Do** round bottom sheets and modals on the top corners only (28px 28px 0 0) — never all four.
- **Do** render any card's headline figure in the gradient-clipped display face with tight negative tracking, not as flat solid text.
- **Do** keep spacing dense (6–16px rhythm) — this is a daily-logging tool, not a landing page; don't add marketing-scale whitespace.

### Don't:
- **Don't** introduce gray/neutral drop shadows on live, interactive cards — depth there comes from colored glow, not gray shadow.
- **Don't** add bright multi-color gamification, mascots, emoji badges, or reward-pop UI — the palette stays restrained to one accent plus role-locked semantic colors.
- **Don't** give a bottom sheet or modal rounded bottom corners — it breaks the "anchored to the edge" signature.
- **Don't** invent a third macro-color mapping. Converge new work on violet/orange/pink (protein/carbs/fat); treat the existing blue/amber/orange meal-line badges as drift to fix, not a pattern to extend.
- **Don't** use Favorite Gold as a general highlight color — it's reserved for favorites and user-created/custom items.
