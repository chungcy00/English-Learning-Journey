# Web font resources

The application bundles open-source fonts through Fontsource (Google Fonts upstream).

- Nunito: https://github.com/google/fonts/tree/main/ofl/nunito
  Package: `@fontsource-variable/nunito`; normal and italic variable WOFF2, weights 200–1000.
- Noto Sans TC: https://github.com/google/fonts/tree/main/ofl/notosanstc
  Package: `@fontsource-variable/noto-sans-tc`; normal variable WOFF2, weights 100–900.

Both are licensed under SIL Open Font License 1.1. Exact package license files are included in `licenses/` and deployed with the application.

Vite emits content-hashed WOFF2 assets referenced by the imported Fontsource CSS. Unicode ranges allow the browser to request only the glyph subsets needed by the page; `font-display: swap` keeps text visible. No Google Fonts runtime request is required.

The global font stack in `src/index.css` prioritizes Nunito (including ASCII digits in mixed Chinese text), then Noto Sans TC. Existing 400/500/600/700 weights, sizes, leading and tracking are unchanged. System fonts are recovery fallbacks only. Existing dynamic counters retain tabular numerals.

Local browser verification covers Latin, digits, IPA, simplified Chinese text, italic, and 400/500/600/700 loading at phone and desktop widths. Physical Android/iPhone font rendering has not been verified; final device acceptance remains required. There are no circular numbered steps in the current progress component, so no new numbered step structure is introduced.

Changed files: `src/index.css` (family and bundled imports), `package.json` / `package-lock.json` (font dependencies), `src/utils/typography.test.ts` (regression checks), `DESIGN.md` (confirmed font rules), this README and the two OFL files. The earlier removal of the Google Fonts stylesheet from `index.html` is retained. No component JSX, business logic or current type sizes/line heights are changed by this font replacement.
