# References Index

These reference files are a snapshot of a real, working
`src/components/base/` design system plus the matching Storybook config
files. They are the canonical templates this skill uses.

**Never modify these files manually during a skill run.** They are
read-only reference material. All output goes to the target theme directory.

---

## CSS custom property prefix convention

The references emit (and the skill must emit) these CSS custom property
prefixes — **no `my_theme-` or any other theme-name segment**:

| Category | Prefix | Example |
|---|---|---|
| Colors | `--clr-` | `--clr-red`, `--clr-grey-100` |
| Spacing | `--s-` | `--s-16`, `--s-32` *(map key = px value)* |
| Font size | `--fs-` | `--fs-16`, `--fs-72` *(map key = px value)* |
| Font family | `--ff-` | `--ff-sans`, `--ff-serif` |
| Font weight | `--fw-` | `--fw-700`, `--fw-bold` |
| Line height | `--lh-` | `--lh-24` |
| Letter spacing | `--ls-` | `--ls-1` |

Spacing map keys in `_spacing.scss` and font-size keys in
`_typography.scss` are **px values**, not ordinals. The
`reference/base/spacing/_spacing.scss` map uses keys 1, 2, 3, …, 120 —
those are literal pixels. See SKILL.md Step 4 "Map-key rule" for
rationale (Storybook chrome `.sb-*` rules consume `var(--s-16)`,
`var(--s-32)` expecting px-implied rem; ordinal keys collide and break
the Storybook layout).

Color Sass map keys and `clr()` call sites also drop the `my_theme-` segment:
- Map key: `red:`, `grey:`, `blue:` (not `my_theme-red:`)
- Call site: `clr(red)`, `clr(grey-100)` (not `clr(my_theme-red)`)

The `my_theme` strings that **remain** in the references (`my_theme:icon`
includes inside `base/` Twig, `/themes/custom/my_theme/...` font/image paths)
are the **theme machine name** — the skill swaps these to the target theme's
machine name at runtime per the `structure` tier rule. Under Emulsify Core 4
the Storybook config files no longer carry Twig namespaces or a `drupalSettings`
mock (Core renders Twig/SDC itself), so there is nothing to swap there.

---

## Tiers

Every file in the maps below is tagged with one of three tiers. The tier
tells you **exactly** how to handle that file when generating output.

| Tier | Rule |
|---|---|
| `verbatim` | Copy byte-for-byte to the target. Do **not** edit anything — not values, not names, not whitespace. These files have no my_theme-specific content. |
| `structure` | Preserve all markup, class names, JS export names, mixin signatures, YAML keys, and SCSS structure. Replace **only** token values, variable map contents, font family strings, and Twig namespace strings. my_theme-specific *shape* is correct; my_theme-specific *values* may need updating. |
| `tokens` | Reference shows the **shape** of the file only. The body is my_theme-specific (e.g. `my_theme-red`, `Benton Sans`, `my_theme` namespace) and **must not** be carried into output. Regenerate the file body from the Figma token inventory; mirror the SCSS pattern (Sass map → entry point → `:root {}`) but use new names + values. |

**Why this exists:** without these tags, every file looks like "a template
to adapt." With them, the rule is explicit per-file. `verbatim` files
short-circuit any thinking. `structure` files protect the Storybook /
Drupal-Twig conventions that are easy to break subtly. `tokens` files
prevent my_theme-specific brand names from leaking into output.

---

## Categories present in the reference

The reference ships these base/ folders:

- `breakpoints/`
- `colors/`
- `fonts/` *(local @font-face — Benton + Editor)*
- `functions/`
- `icons/`
- `motion/`
- `spacing/`
- `typography/`
- `utility/`

`border-radius/` and `shadows/` are **conditional categories** — not in
the reference, but generate them when Figma defines `border-radius` or
`box-shadow` tokens. Build them by mirroring the **spacing folder's
shape** exactly (Sass map → CSS var entry point → function partial →
Storybook story trio). The spacing folder serves as the template. See
SKILL.md → "Conditional categories — border-radius and shadows" for the
file recipe and function shape. No user confirmation needed; presence of
tokens in Figma is the trigger.

---

## File Map

### Token SCSS files

| Tier | Reference file | Target path |
|---|---|---|
| `tokens` | `base/colors/_color-palette.scss` | `src/components/base/colors/_color-palette.scss` |
| `tokens` | `base/colors/color-variables.scss` | `src/components/base/colors/color-variables.scss` |
| `tokens` | `base/spacing/_spacing.scss` | `src/components/base/spacing/_spacing.scss` |
| `tokens` | `base/spacing/spacing-variables.scss` | `src/components/base/spacing/spacing-variables.scss` |
| `tokens` | `base/typography/_typography.scss` | `src/components/base/typography/_typography.scss` |
| `structure` | `base/typography/_typography-mixins.scss` | `src/components/base/typography/_typography-mixins.scss` |
| `tokens` | `base/typography/typography-variables.scss` | `src/components/base/typography/typography-variables.scss` |
| `tokens` | `base/breakpoints/_breakpoints.scss` | `src/components/base/breakpoints/_breakpoints.scss` |
| `structure` | `base/functions/_color.scss` | `src/components/base/functions/_color.scss` |
| `structure` | `base/functions/_fonts.scss` | `src/components/base/functions/_fonts.scss` |
| `structure` | `base/functions/_space.scss` | `src/components/base/functions/_space.scss` |
| `structure` | `base/functions/_top-border.scss` | `src/components/base/functions/_top-border.scss` |
| `verbatim` | `base/functions/_rem-calc.scss` | `src/components/base/functions/_rem-calc.scss` |
| `verbatim` | `base/functions/_px2rem.scss` | `src/components/base/functions/_px2rem.scss` |
| `verbatim` | `base/motion/_motion.scss` | `src/components/base/motion/_motion.scss` |
| `structure` | `base/utility/_container.scss` | `src/components/base/utility/_container.scss` |
| `verbatim` | `base/utility/_utility.scss` | `src/components/base/utility/_utility.scss` |
| `structure` | `base/base.scss` | `src/components/base/base.scss` |

### Fonts (local @font-face pattern)

The reference uses **local font files** in `assets/fonts/{family}/` and
per-family SCSS partials (two example families shown). Substitute the
real font family names from Figma.

| Tier | Reference file | Target path | Notes |
|---|---|---|---|
| `tokens` | `base/fonts/font.scss` | `src/components/base/fonts/font.scss` | entry point that `@use`s each family partial; regenerate `@use` lines from real family list |
| `tokens` | `base/fonts/_benton.scss` | `src/components/base/fonts/_{family-1}.scss` | rename to design's primary family; replace `@font-face` `src` URLs and `font-family` name |
| `tokens` | `base/fonts/_editor.scss` | `src/components/base/fonts/_{family-2}.scss` | same for secondary family (omit if design has only one family) |

If the user picks **Google Fonts** or **Adobe Fonts** instead of local
`@font-face`, replace `font.scss` body with a single `@import url(...)`
and **do not** generate per-family partials. The font `<link>` should
also go in `storybook/preview-head.html` so Storybook loads it.

### Storybook story files

| Tier | Reference file | Target path |
|---|---|---|
| `verbatim` | `base/colors/colors.stories.js` | `src/components/base/colors/colors.stories.js` |
| `verbatim` | `base/colors/colors.twig` | `src/components/base/colors/colors.twig` |
| `structure` | `base/colors/colors.yml` | `src/components/base/colors/colors.yml` |
| `verbatim` | `base/spacing/spacing.stories.js` | `src/components/base/spacing/spacing.stories.js` |
| `verbatim` | `base/spacing/spacing.twig` | `src/components/base/spacing/spacing.twig` |
| `structure` | `base/spacing/spacing.yml` | `src/components/base/spacing/spacing.yml` |
| `verbatim` | `base/breakpoints/breakpoints.stories.js` | `src/components/base/breakpoints/breakpoints.stories.js` |
| `verbatim` | `base/breakpoints/breakpoints.twig` | `src/components/base/breakpoints/breakpoints.twig` |
| `structure` | `base/breakpoints/breakpoints.yml` | `src/components/base/breakpoints/breakpoints.yml` |
| `verbatim` | `base/typography/typography.stories.js` | `src/components/base/typography/typography.stories.js` |
| `verbatim` | `base/typography/type-faces.twig` | `src/components/base/typography/type-faces.twig` |
| `structure` | `base/typography/type-faces.yml` | `src/components/base/typography/type-faces.yml` |
| `verbatim` | `base/typography/heading-styles.twig` | `src/components/base/typography/heading-styles.twig` |
| `structure` | `base/typography/heading-styles.yml` | `src/components/base/typography/heading-styles.yml` |
| `verbatim` | `base/typography/body-styles.twig` | `src/components/base/typography/body-styles.twig` |
| `structure` | `base/typography/body-styles.yml` | `src/components/base/typography/body-styles.yml` |
| `verbatim` | `base/icons/icons.stories.js` | `src/components/base/icons/icons.stories.js` |
| `verbatim` | `base/icons/icons.twig` | `src/components/base/icons/icons.twig` |

Also create `src/components/base/icons/.gitkeep` (not in reference;
the reference's icons folder is populated, but a fresh theme starts
empty).

### SDC icon component

`base/icons/icons.twig` calls `{% include '{theme}:icon', { name: icon } %}`
to render each SVG row. The `icon` SDC component lives alongside the
listing files so that include resolves out of the box. The component
uses the project-local `bem()` / `add_attributes()` helpers and reads
SVG markup with `source('@assets/icons/' ~ name ~ '.svg')`.

| Tier | Reference file | Target path |
|---|---|---|
| `verbatim` | `base/icons/icon.twig` | `src/components/base/icons/icon.twig` |
| `tokens` | `base/icons/icon.component.yml` | `src/components/base/icons/icon.component.yml` |

The reference `icon.component.yml` intentionally ships **without** an
`enum:` block under `properties.name` — the prop shape is generic, but
the list of valid icon names is theme-specific. The skill regenerates
`enum:` from the SVG filenames found in `{THEME_ROOT}/assets/icons/` at
scaffold time, or leaves it omitted if no SVGs exist yet.

**Location is fixed to `base/icons/`.** Do NOT also create
`src/components/icon/icon.twig` or `src/components/icon/icon.component.yml`
at the top level. Drupal SDC discovers components by folder name
regardless of nesting depth, so two `icon/` folders register as
duplicate component IDs and SDC throws a registration error.

### Storybook config templates (Emulsify Core 4 / Vite)

Core 4 uses a Vite builder and renders Twig/SDC stories itself, so the only
config file the skill must regenerate is `preview-head.html` (design tokens +
chrome + fonts). `preview.js`, `main.js`, `theme.js`, and `manager-head.html`
are Core scaffold defaults — the skill writes them only to (re)establish a clean
baseline, with the small optional edits noted below.

| Tier | Reference file | Target path | What to update |
|---|---|---|---|
| `structure` | `storybook/preview-head.html` | `config/emulsify-core/storybook/preview-head.html` | The one design-system-dependent config file. In the `<style>` block, replace the `:root {}` tokens (and the `[data-component-theme='dark']` rule, if dark mode) with the design's tokens as **plain CSS** (no Sass). Update or delete the font `<link>` per the Step 3 font decision. Preserve all `.sb-*` class rules verbatim. |
| `verbatim` | `storybook/preview.js` | `config/emulsify-core/storybook/preview.js` | Core-default stub (`export const parameters = {}`). Copy as-is; no Twig namespaces or `drupalSettings` to swap anymore. |
| `verbatim` | `storybook/main.js` | `config/emulsify-core/storybook/main.js` | Core-default stub (`export default {}`). Copy as-is; no webpack/sass-loader patch or `staticDirs` map needed under Vite. |
| `structure` | `storybook/theme.js` | `config/emulsify-core/storybook/theme.js` | Optional manager-UI branding. Carry as-is, or swap the brand colors/fonts to the design's palette. Not required for any Base/* story to render. |
| `verbatim` | `storybook/manager-head.html` | `config/emulsify-core/storybook/manager-head.html` | Manager-UI chrome only. Copy as-is; edit only if `theme.js` references a manager-only font. |

---

## Expected Storybook stories after generation

Always produced:

- `Base/Colors`
- `Base/Spacing`
- `Base/Breakpoints`
- `Base/TypeFaces`
- `Base/HeadingStyles`
- `Base/BodyStyles`
- `Base/Icons`

Conditional (produced only when the corresponding Figma tokens exist):

- `Base/BorderRadius` — when border-radius tokens are present in Figma
- `Base/Shadows` — when box-shadow tokens are present in Figma
