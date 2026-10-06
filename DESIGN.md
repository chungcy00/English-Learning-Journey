---
name: Mine English
description: A compact learning workspace in warm white and forest green.
colors:
  bg-primary: "#F8F7F2"
  bg-alt: "#EFEEE7"
  text-primary: "#202623"
  text-secondary: "#5F6B61"
  accent-primary: "#2C5945"
  accent-vocab: "#264F3E"
  accent-secondary: "#8DA597"
  accent-warm: "#B49379"
  border-subtle: "#DEDACE"
  surface-paper: "#FCFCF8"
  surface-white: "#FFFFFF"
  surface-selected: "#EDF2EC"
  accent-hover: "#234836"
  border-control: "#84958B"
  border-selected: "#9DB3A4"
  surface-warm: "#F4F1E8"
  surface-track: "#E9EDE5"
  chart-a2: "#2C5945"
  chart-b1: "#55816B"
  chart-b2: "#8DA597"
  chart-c1: "#C3D1C5"
  chart-unknown: "#A59C89"
typography:
  page:
    fontFamily: '"Cormorant Garamond", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Georgia, serif'
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  section:
    fontFamily: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  term:
    fontFamily: '"Cormorant Garamond", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Georgia, serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  reading:
    fontFamily: '"Cormorant Garamond", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Georgia, serif'
    fontSize: "1.125rem"
    lineHeight: 1.75
  example:
    fontFamily: '"Cormorant Garamond", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Georgia, serif'
    fontSize: "1.125rem"
    lineHeight: 1.6
  body:
    fontFamily: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.75
  translation:
    fontFamily: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.85
  label:
    fontFamily: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "0.875rem"
    lineHeight: 1.5
    letterSpacing: "normal"
  meta:
    fontFamily: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "0.875rem"
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  nav: "4px"
  control: "10px"
  card: "12px"
  workspace: "16px"
  pill: "999px"
  circular: "50%"
spacing:
  control: "0.75rem"
  group: "1.5rem"
  section: "2.5rem"
  page-gutter: "1rem"
components:
  button-generate:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.bg-primary}"
    rounded: "{rounded.nav}"
    padding: "0.625rem 1.25rem"
    height: "44px"
  button-generate-hover:
    backgroundColor: "{colors.accent-vocab}"
  button-continue:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.surface-paper}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
    height: "44px"
  button-continue-hover:
    backgroundColor: "{colors.accent-hover}"
  composer:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.workspace}"
    padding: "1.25rem 1.375rem"
  choice:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 0.875rem"
    height: "44px"
  choice-selected:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.surface-paper}"
    rounded: "{rounded.pill}"
  level-selected:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.accent-primary}"
    rounded: "{rounded.card}"
    padding: "0.5rem 0.25rem"
    height: "64px"
  select:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "0.625rem 2.5rem 0.625rem 0.875rem"
    height: "44px"
  nav-active:
    backgroundColor: "{colors.bg-alt}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.nav}"
  history-card:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "1.5rem"
  stepper-button:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.circular}"
    height: "44px"
    width: "44px"
---

# Design System: Mine English

## Overview

**Creative North Star: "Compact learning workspace"**

Mine English uses warm white surfaces, forest green actions, and green-gray supporting text. The confirmed compact type sizes and existing Inter/Cormorant Garamond pairing remain part of the system. Interface controls support the learning task through visible labels, clear selected states, and accessible focus outlines.

This document captures the implemented shared palette and the first reviewed batch: Home, learning settings, reading history, and the saved-reading level chart. Other existing screens provide incumbent evidence, but their presence here does not claim completion or finish review of later implementation phases. CSS custom properties in `src/index.css` are the source of truth; frontmatter records their current values and observed component dimensions.

**Key Characteristics:**

- Warm white backgrounds and forest green actions.
- Compact controls with room for readable learning text.
- Rounded surfaces, pill choices, and visible keyboard focus.
- Factual saved-reading metadata and labeled chart values.

## Colors

The palette combines warm white neutrals with a forest green accent and muted supporting greens.

### Primary

- Forest green (`accent-primary`) identifies generation, continuation, selected parameter pills, and the A2 chart series.
- Deeper forest green (`accent-vocab`) supports vocabulary emphasis, general focus outlines, and generation-button hover.
- Dark forest green (`accent-hover`) appears on continuation-action hover.
- Muted green (`accent-secondary`) supports quieter icons and the B2 chart series.

### Neutral

- Warm white (`bg-primary`) is the page canvas and generation-button text; `surface-paper` is the slightly lighter composer, settings, and card surface.
- Warm gray (`bg-alt`) groups controls, navigation selection, and metadata badges. `surface-white`, `surface-selected`, `surface-warm`, and `surface-track` serve existing collection, practice, and progress surfaces.
- Deep green-gray (`text-primary`) carries main text; green-gray (`text-secondary`) carries helper text, dates, and placeholders.
- `border-subtle` separates surfaces and rows; `border-control` gives native selects stronger boundaries; `border-selected` marks existing collection selection.
- Muted warm brown (`accent-warm`) is the incumbent navigation-count badge color.

The chart keeps separate semantic series tokens even where values match action colors. B1 uses `chart-b1`, C1 uses `chart-c1`, and missing or unrecognized levels use `chart-unknown`. Counts and percentages accompany color.

Existing semantic feedback is not a unified root-token palette: error text uses Tailwind red, translation warnings use amber, saved feedback uses emerald, and history-delete hover has a local muted red-brown. These are observed incumbent treatments, not a new palette normalization instruction.

**The Source of Truth Rule.** Reuse the root CSS custom properties for shared palette decisions; preserve the chart's semantic series names.

## Typography

**Display/Reading Font:** Cormorant Garamond with the existing Chinese and serif fallbacks.

**Body/Control Font:** Inter with the existing Chinese and sans-serif fallbacks.

English headings and learning passages use the editorial family; controls, translations, metadata, and helper copy use the UI family. The frontmatter lists mobile/base roles. At the existing small-screen breakpoint, page, section, term, reading, and metadata roles change; component overrides remain authoritative.

### Hierarchy

- Page titles use the editorial `page` role. From (640px), its token becomes (2.25rem). Home overrides it with `clamp(1.875rem, 3vw, 2.5rem)` and (1.75rem) on mobile; History uses `clamp(1.75rem, 3vw, 2.5rem)`.
- Section headings use the UI `section` role, increasing to (1.75rem) from (640px). The chart heading stays (1.375rem).
- Terms use the editorial `term` role, increasing to (1.5rem) from (640px).
- Reading uses the editorial `reading` role, increasing to (1.375rem) from (640px); reading-screen component overrides are incumbent, outside this batch's finish review.
- Body and translations remain (1rem). The composer textarea and placeholder explicitly use the UI family at (1rem), including mobile.
- Labels and base metadata are compact. Metadata becomes (0.8125rem) from (640px), while History explicitly keeps (0.875rem). Numeric counts use tabular figures where implemented.

**The Confirmed Type Rule.** Preserve the existing font pairing and confirmed compact sizes; keep the composer input and placeholder in the UI family at (1rem).

## Layout

The shared shell centers task-sized containers with mobile gutters from the frontmatter. Gutters increase to (1.5rem) from (640px) and (2rem) from (1024px). The default collection shell is (56rem), the focus shell (48rem), and the reading shell (76rem), with observed page overrides: Home (52rem), History (68rem), and Reading (78rem). Do not assume one fixed width across tasks.

Home uses a centered compact heading, integrated topic composer and submit action, suggestion pills, and fully visible settings. The CEFR group stays four equal columns. Parameter rows wrap; on mobile their pill choices occupy the next row and align left. Below (640px), composer padding is (1rem), its minimum height is (14rem), and the submit action fills its width. Desktop composer padding is (1.25rem 1.5rem). Suggestions form a horizontally scrollable row on mobile.

History is a single-column card list with a (1rem) gap. Cards reduce padding from (1.5rem) to (1rem) on mobile. Headings, badges, and footer metadata wrap. The chart uses a (160px) pie and a text legend in a wrapping flex layout with (1.5rem 2rem) gaps.

Navigation is sticky, with four grid columns and stacked icons/text below (1024px), then a horizontal arrangement. Installed-shell safe areas and software-keyboard behavior remain existing platform adaptations. Screenshots verify desktop and mobile browser layouts; they do not establish physical-device verification.

## Elevation & Depth

Tonal backgrounds and subtle borders carry most separation. The Home composer explicitly removes its earlier shadow. A selected CEFR segment uses a small state shadow (`0 2px 6px rgb(32 38 35 / 9%)`); the generation action retains the incumbent extra-small utility shadow (`0 1px 2px 0 rgb(0 0 0 / 5%)`). Existing reading tabs use a separate small state shadow. The sticky header has a translucent canvas background and a small backdrop blur.

Focus uses a visible outline (2px) with an offset (3px); the composer also changes its border and adds a faint accent ring when a descendant has focus. Native select transitions are (160ms ease); vocabulary emphasis transitions are (150ms ease-in-out). This batch introduces no entrance animation.

## Shapes

The implemented system has several radii rather than one universal rounding token: compact navigation and generation controls, native selects, History cards and CEFR segments, larger composer/settings surfaces, pill choices and badges, and circular stepper controls. The frontmatter records those observed dimensions; there are no root radius custom properties.

Other incumbent screens also use (2px), (6px), and (8px) radii. These remain observed local treatments. Do not normalize unrelated screens as part of consuming this document. Borders are generally thin (1px), with active navigation using a thicker bottom accent (2px).

## Components

### Buttons

Generation is a compact forest green action with warm white text, a minimum (44px) touch height, an incumbent (4px) corner treatment, and a minimum width of (9.5rem). Its hover uses the vocabulary accent and disabled state uses half opacity. Continuation actions use pill geometry, paper-colored text, and the darker hover accent. General keyboard focus uses the shared outline; do not add lift animations to these static controls.

### Composer / Inputs

The composer is a paper-colored bordered surface with a visible topic label, UI-font textarea, and separated footer action. Placeholder text uses supporting green-gray. Its focus-within border/ring complements the textarea's focus outline. Native selects use the stronger control border, (10px) corners, minimum (44px) height, and an inline chevron. Hover changes the border and surface; disabled selects use (0.55) opacity.

### Chips / Parameter Choices

Suggestion pills are warm gray and bordered, with a darker warm-gray hover. Parameter pills use supporting text and subtle borders at rest; a pressed pill uses forest green fill and paper text. Their actual state is conveyed by `aria-pressed`, not color alone. History badges use warm gray, except the level badge, which uses forest green.

### Cards / Containers

History cards use paper fill, a subtle border, and the card radius. A heading and accessible delete action lead into factual badges; dates and continuation actions share the footer. The optional Home continuation card uses the same paper/border vocabulary and a warm-gray hover. The settings panel uses the larger workspace radius and thin row dividers.

### Navigation

The incumbent header pairs Mine English's editorial wordmark with icon-and-label tabs. Active tabs use warm-gray fill, primary text, and a forest green bottom border. Inactive tabs use supporting text; unavailable current-reading navigation remains visibly disabled. Labels are (11px) in the stacked layout and (0.875rem) from (1024px). Preserve the existing site icon; this batch generated no new raster assets.

### CEFR Segments / Vocabulary Stepper

The CEFR strip has a warm-gray outer surface, four equally sized buttons, and a paper-filled selected segment with green text and a state shadow. Segment height is at least (64px). The vocabulary stepper uses circular (44px) buttons and a bold tabular count; the actual implementation disables decrement at 1 and increment at 20, and disables controls while generating.

### Saved-Reading Level Chart

The inline SVG pie uses the named CEFR series colors and thin paper-colored slice separators. Its text legend lists level, saved count, and percentage with tabular numerals. The accessible chart label points to the textual values. Empty data produces explanatory text instead of a pie. This visualization describes saved readings; it does not indicate learning ability, completion, or mastery.

## Do's and Don'ts

### Do:

- Do reuse the root CSS palette and existing UI/editorial font families.
- Do preserve visible focus outlines, actual pressed states, and implemented disabled boundaries.
- Do use wrapping content and the observed responsive spacing for compact screens.
- Do pair chart colors with textual levels, counts, and percentages from actual saved data.

### Don't:

- Don't reintroduce the replaced olive palette or borrow the demo's colors.
- Don't enlarge the confirmed compact type scale or style the topic placeholder as editorial text.
- Don't interpret incumbent local radii or semantic status colors as permission to normalize unrelated screens.
- Don't describe saved-reading distribution as completion, ability, or mastery.
