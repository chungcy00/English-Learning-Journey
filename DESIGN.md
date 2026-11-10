---
name: Mine English
description: A warm hand-drawn learning workspace with consistent cat and hamster companions.
colors:
  bg-primary: "#F8F7F2"
  bg-alt: "#F0F3EC"
  text-primary: "#20251F"
  text-secondary: "#5F655D"
  text-quiet: "#6A7068"
  text-muted: "#6A7068"
  text-placeholder: "#8E928B"
  text-ink: "#2C3E35"
  accent-primary: "#315E4C"
  accent-vocab: "#315E4C"
  accent-secondary: "#98A78C"
  accent-subtle: "#B1BBA3"
  accent-warm: "#EBCB9E"
  accent-gold: "#D8B66A"
  border-subtle: "#E2E0D7"
  divider: "#ECE9E1"
  surface-paper: "#FDFDFC"
  surface-white: "#FDFDFC"
  surface-selected: "#E5EBE1"
  accent-hover: "#274E3F"
  border-control: "#E2E0D7"
  border-selected: "#98A78C"
  surface-warm: "#F7F0E5"
  surface-track: "#E5EBE1"
  surface-disabled: "#F0F1ED"
  text-disabled: "#8E928B"
  status-success: "#315E4C"
  status-warning: "#795C32"
  status-error: "#854C49"
  status-info: "#536D75"
  chart-a1: "#B1BBA3"
  chart-a2: "#EBCB9E"
  chart-b1: "#98A78C"
  chart-b2: "#CBAEA2"
  chart-c1: "#A6B5B8"
  chart-c2: "#C8BAAD"
  chart-unknown: "#E2E0D7"
typography:
  page:
    fontFamily: 'var(--font-app)'
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  section:
    fontFamily: 'var(--font-app)'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  term:
    fontFamily: 'var(--font-app)'
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  reading:
    fontFamily: 'var(--font-app)'
    fontSize: "0.9375rem"
    lineHeight: 1.65
  example:
    fontFamily: 'var(--font-app)'
    fontSize: "1rem"
    lineHeight: 1.6
  body:
    fontFamily: 'var(--font-app)'
    fontSize: "0.9375rem"
    lineHeight: 1.6
  translation:
    fontFamily: 'var(--font-app)'
    fontSize: "0.875rem"
    lineHeight: 1.6
  label:
    fontFamily: 'var(--font-app)'
    fontSize: "0.75rem"
    lineHeight: 1.4
    letterSpacing: "normal"
  meta:
    fontFamily: 'var(--font-app)'
    fontSize: "0.75rem"
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  hand-surface: "16px 14px 17px 13px / 14px 17px 13px 16px"
  hand-control: "11px 13px 10px 12px / 12px 10px 13px 11px"
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
    rounded: "{rounded.hand-surface}"
    height: "64px"
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
    rounded: "{rounded.hand-surface}"
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
  select:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.hand-control}"
    padding: "0.625rem 2.5rem 0.625rem 0.875rem"
    height: "44px"
  nav-active:
    backgroundColor: "transparent"
    textColor: "{colors.accent-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.hand-control}"
  history-card:
    backgroundColor: "{colors.surface-paper}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.hand-surface}"
    padding: "1.5rem"
  stepper-button:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.circular}"
    height: "44px"
    width: "44px"
---

# Design System: Mine English

## Overview

**Creative North Star: "A warm illustrated learning companion"**

Mine English is a readable, compact learning workspace in warm white and forest green, accompanied by a cream-white cat and a golden, round hamster. The approved 2026-11-10 redesign changes the visual construction across the website: gently hand-drawn outlines, quiet paper surfaces, controlled rounded forms and a small shared family of character illustrations. It does not replace the palette, the Nunito / Noto Sans TC typography, the confirmed size hierarchy or the learning functions.

The current implementation is defined by the palette and type variables in `src/index.css`, the shared skin in `src/handDrawn.css`, and `src/components/LearningArt.tsx`. These current rules supersede the earlier visual descriptions of rigid rectangular navigation, the old site-icon logo and unrelated page-specific card treatments. Functional decisions and their history remain in `PRODUCT.md`.

**Key Characteristics:**

- Existing warm-white surfaces, forest-green actions and readable supporting text.
- Consistent cream cat and golden hamster from the approved character reference, reused across pages.
- Thin measured outlines with fixed-size corners and restrained, sub-pixel irregularity.
- Compact, unchanged typography and clear task-oriented alignment.
- Decorative art outside reading and input areas; standard geometric charts with factual values.
- Real-state loading animations, delayed to avoid flashing during quick operations.

## Colors

The frontmatter retains the incumbent palette. Shared UI colors come from the existing CSS variables; the redesign introduces no replacement theme.

### Primary

Forest green identifies generation, continuation, selected choices, vocabulary emphasis and the active navigation item. The deeper existing hover accent supports available primary actions. Muted greens supply hand-drawn boundaries and quiet botanical details.

### Secondary

The existing warm accent and gold provide the hamster's identity and small count badges. The cream character and paper fill use the existing warm-white family. The generated artwork follows these roles; it is not a source of new UI color tokens.

### Neutral

Warm white is the page canvas; paper is the main content surface. Existing selected, alternate, disabled and warm surfaces group controls without texture behind prose. Primary, secondary and muted text roles retain their current responsibilities. Error, warning, success and information feedback continue to use the existing semantic variables.

Chart series retain separate named CEFR tokens and textual level/count/percentage labels. The diagram's true geometry and color meanings are independent of the hand-drawn outer panel.

**The Existing Palette Rule.** Read the root theme variables. Never copy a reference image's incidental color into a new UI token.

## Typography

**Font:** Nunito for Latin letters and digits, then Noto Sans TC for Chinese, with the existing platform fallbacks. Local Fontsource variable assets and font licenses remain unchanged. The editorial variable remains an alias to the app family; hand-drawn artwork is not permission to introduce a handwriting font.

### Hierarchy

- Page titles retain the existing responsive (24px / 28px) scale, weight (700) and compact heading line-height.
- Section headings retain (18px / 20px) and their existing (600) hierarchy.
- Terms and card titles use the established (16px) role, with existing component-specific emphasis retained.
- Reading remains (15px / 1.65); examples remain (16px / 1.6); body remains (15px / 1.6).
- Translations remain (14px / 1.6); labels, metadata and compact edit actions remain (12px).
- Mobile text-entry fields retain (16px) to avoid focus zoom; count/progress numerals remain tabular.

**The Unchanged Type Rule.** Shape, layout and illustration may change; fonts, established text sizes, weights, tracking and readability must not be replaced to mimic a reference.

## Layout

Task-specific, centered containers remain in use. At the existing large-desktop condition (at least 1280px, hover and a fine primary pointer), generation uses its (56rem) shell and custom words, wordbook, history and review use their existing expanded desktop shells. Reading keeps its (72rem) shell and (2:1) article/vocabulary arrangement with a (24px) gap; the readable prose measure remains bounded. Narrow/touch layouts use the existing stacked flow.

The new composition reserves space for characters above major surfaces. Characters are not placed in each row or paragraph. Desktop learning settings align a compact label column beside the choices; phones stack those groups and retain tight (44px) CEFR touch targets. Form fields, imports, toggles and parameter behavior are unchanged.

Desktop navigation stays at the top with icon/text actions and a restrained, slightly curved active underline. Phone and tablet browsers and installed shells keep the shared five-item bottom navigation, the brand header, software-keyboard hiding behavior and bottom safe-area space. Decorative header/footer sprigs stay within the viewport; footers contain overflow rather than allowing decoration to create horizontal scrolling.

Wordbook controls retain the current two-option collection menu (词汇 / 例句), search, add and sort on one row, compact lexical rows and in-flow expanded details. Random review keeps its independent dynamic lexical category filter and actual sampled group. Historical category, saved-material and deletion/undo semantics are product behavior, not new layout rules.

## Elevation & Depth

Paper fill, selected surfaces and fine outlines carry the major surfaces. The shared skin removes ornamental shadows from the primary cards, navigation and dropdowns. Existing modal backdrops and visible focus outlines retain their functional roles; the header and bottom navigation use the solid existing canvas rather than glass decoration. No texture is introduced behind learning text.

Interactive focus remains visible, with the existing theme outline and focus behavior. The new border SVGs and all decorative artwork have no pointer interaction and do not cover focus targets. Existing flip, selection and dialog transitions remain; loading motion follows real operation state and respects reduced motion.

## Shapes

The shared surface fallback uses `--hand-corner` (16px 14px 17px 13px / 14px 17px 13px 16px); compact controls use `--hand-control-corner` (11px 13px 10px 12px / 12px 10px 13px 11px). The older primitive radii remain compatibility tokens for untouched local roles, not a second new visual language.

Major surfaces use the reusable `HandOutline`: its ResizeObserver measures the actual parent, the corner radius is capped at (16px), and the contour has only sub-pixel deviation from a regular edge. The stroke (1.15px) inherits an existing theme token. Short controls and long wordbook panels must not stretch one fixed aspect-ratio border into broken corners or bowed edges. `HandRule` supplies the quiet shared rule at the header/footer; the six-column vocabulary navigation retains its already approved dashed rules and marker highlight.

**The Stable Bounds Rule.** Hand-drawn is a visual contour, not a change to the aligned layout box, text baseline, hit area or chart geometry.

## Components

### Shared artwork and Logo

`Mascot` uses the twelve official independent transparent PNGs in `public/illustrations/mascots/`, selected by an explicit filename registry. These user-provided character designs replace the previous static character atlas. Render at each image's native width/height ratio with `object-fit: contain`, no crop, mirror, stretching, recoloring, added background, extra outline or duplicated emphasis marks. The three warm-apricot accent strokes are baked into the supplied images and must remain intact. Do not redraw animals from geometry or generate substitutes.

`Companion` aligns the supplied paws to the card edge with pose-specific percentage registration that accounts for transparent margins; `StudyEmptyState` uses the official hamster-reading illustration, or the official thinking cat for an unmatched search. The shared-reading Logo is eager, supporting illustrations lazy. Decorative image failures hide only the image and leave controls/content usable. All twelve PNGs are registered, but alternate/success/rest/reminder poses need not be forced into unrelated pages. The original atlas is retained only for existing plant sprigs; it no longer displays any cat or hamster. Existing loading animations are independent and unchanged.

Home uses the peeking cat at the continuation card and peeking hamster above inspiration. Reading uses the alternate peeking cat and the same peeking hamster. Custom words use a peeking cat plus the reading hamster for empty states. Practice uses a peeking cat at the wordbook entrance and peeking hamster at the flip card. Wordbook uses the reading cat above and A–Z hamster below. History uses a peeking cat and alternate reading hamster. Shrink or hide decoration on narrow screens without changing the six-column marker navigation or functional layout.

### Buttons and choices

Actions retain their existing semantic color assignments, state attributes and touch areas. The current full-width generation action is (64px) high; ordinary controls remain at least (44px). Small controls use gently unequal corners; selected parameter pills retain compact organic forms, forest fill and paper text. Selected random-count buttons retain the same fill/text on hover without a decorative lift.

### Inputs, search and dropdowns

Inputs and textareas remain clear paper fields with a restrained theme border and gently uneven corners. Focus-within changes the shared outline's theme role while preserving the actual focus indicator. Search and menus retain current text sizes and keyboard behavior. The in-page combobox/listbox stays anchored (4px) below its trigger, and option scrolling must not move the page. Error and disabled states retain factual text and existing semantic colors.

### Cards and learning details

The common contour applies to generation, reading, random-review, custom-word, wordbook, history, task, example, definition, phrase and tree-map surfaces. The shared frame never creates a nested illustration behind the content. Reading and vocabulary cards use their existing paper roles; the continuation card remains forest green. Wordbook rows stay compact and expandable; collapsed-row swipe deletion and expanded-row gesture protection are unchanged.

The six detail columns remain 例句、派生、词根、词组、英释、用法辨析. Preserve the existing marker navigation, dashed rules, compact six-column mobile layout and the established narrow-container two-row fallback. Derivatives remain a true word-family tree; roots remain verified decomposition plus separately labeled memory support; English definitions remain English-only cards; examples remain grouped by sense; phrases retain individual audio/bookmarks; usage explanations remain concise Chinese with English expressions/examples. This visual system does not alter their data or generation rules.

### Empty, loading and feedback states

Use compact empty states in dense vocabulary detail, with concise text that distinguishes ungenerated content, reliable-content absence and generation failure. Do not expand a knowledge gap into a large empty panel or invent word facts. Custom-word and other broad empty regions can use the larger shared character/text composition. Errors and retries remain text controls, not expressions implied only by a character.

`LoadingAnimation` is a presentation-only public component driven by an operation's real active flag. It waits (300ms) before mounting the animation and hides on the same render as completion or failure, without a minimum display time, fake percentages, new request or data mutation. The operation map is: generate/vocabulary → run (1.2s); reading/history/saved → read (2.8s); analysis/examples/usage → write (2.6s); search → search (2.6s); short waits → rest (2.8s). Each animation is a transparent, registered twelve-frame (4 × 3) sprite sheet; the sequence uses CSS discrete frame positions rather than showing the static contact sheet. Assets are requested when that delayed component mounts. Small inline loaders are the default, with one larger generation-dialog treatment. Reduced-motion uses a static first frame. Loading never disables unrelated page functions merely to display artwork.

### Charts and tasks

The history chart uses the same outer paper contour and occasional edge companion. The donut segments, labels, actual totals and per-level calculations remain ordinary exact SVG geometry. The chart/list/task layout adapts to narrow viewports without skewing data marks. Review task actions retain the actual level count and existing entry points.

### Dialogs and notices

Style selection, word details, removal confirmation and existing notices share the theme border/corner treatment. Destructive and editing dialogs retain their modal focus, Escape/cancel behavior and scroll limits. Generation processing is an explicitly nonmodal corner dock (`dialog open`, `aria-modal="false"`), without a body-scroll or focus lock; on phones it sits above the bottom navigation. Its real status, topic summary, cancel control and existing notes remain, and Escape within the dock invokes the available cancel action. Navigation and unrelated page features remain usable during generation. Decorative assets do not capture input. The processing illustration uses the shared delayed loading component; real status/error text remains available independently.

## Do's and Don'ts

### Do:

- Do reuse the existing palette, type scale, real semantic states and actual chart values.
- Do use one shared cat/hamster identity and the public illustration components.
- Do measure major outlines against actual panel bounds and retain fixed-size corners.
- Do keep learning content selectable, controls at least 44px high and keyboard focus visible.
- Do use compact honest empty states and delay character loading until a real operation exceeds 300ms.
- Do preserve mobile/tablet bottom navigation, safe areas and reduced-motion behavior.

### Don't:

- Don't import reference-image colors, new fonts, a new handwriting typeface or unrelated animal icons.
- Don't fill every card with a character, place texture behind prose or let art create overflow/occlusion.
- Don't distort chart marks, typography, hit areas or data to create a hand-drawn effect.
- Don't add accounts, pet progression, currencies, fabricated statistics or other reference-only features.
- Don't change storage keys, schemas, user edits, existing generation rules or API flows for a visual skin.
- Don't present a static storyboard as an animation, show fabricated progress or keep a finished loader visible.
