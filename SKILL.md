---
name: emulsify-figma-base
description: >
  Builds a complete Emulsify design system base from a Figma file (via
  the Figma MCP) or a design-tokens PDF (via the built-in Read tool).
  Use this skill any time the user provides a figma.com URL (file or
  frame) OR a local PDF path with design tokens and wants to scaffold
  or refresh the `src/components/base/` layer of an Emulsify Drupal
  theme — including SCSS token files, Sass functions, Storybook
  documentation stories, and the Storybook config file
  (`preview-head.html`). Also trigger when the user says things like "generate
  Emulsify base from Figma or a design-tokens PDF", "apply this Figma
  design to Emulsify", "apply this design PDF to Emulsify", "create the
  design system from Figma or PDF", "build the base from Figma or PDF",
  "build Emulsify base from this token PDF", or invokes the
  `/emulsify-figma-base` slash command. Both sources flow into the same
  Step 4 output generation. Assumes a fresh / empty Emulsify child theme
  (no existing components in `src/components/`). For Anthropic Design
  API URLs, use the sibling `emulsify-design-base` skill instead.
---

# Emulsify Figma Base Skill

## Overview

This skill scaffolds the `src/components/base/` layer of an empty Emulsify
Drupal child theme using design tokens read from **either** a Figma file
(via the Figma MCP server) **or** a local design-tokens PDF (via the
built-in `Read` tool). Both sources feed the same Step 4 file generation.
Output: full SCSS token system, Sass functions, Storybook stories per
category, and the one design-system-dependent Storybook config file
(`preview-head.html`).

**Targets Emulsify Core 4 (Vite builder).** Core 4 compiles SCSS through Vite
and renders Twig/SDC stories with its own integration, so the webpack-era
config patches this skill used to ship are gone: no `sass-loader` legacy-API
override, no `staticDirs` map, no Twig `include()`/`source()` polyfills, and no
`drupalSettings` mock. `preview.js` and `main.js` are now Core-default stubs.

**Scope guardrails:**

- Assumes a **fresh / empty Emulsify Core 4 theme** like the canonical `whisk`
  scaffold (empty `src/components/`, default `config/emulsify-core/storybook/`
  stubs: `main.js`, `preview.js`, `preview-head.html`, `manager-head.html`,
  `theme.js`). Does not audit or back-compat existing components.
- Generates `preview-head.html` (the one design-system-dependent config file:
  `:root` tokens + `.sb-*` chrome + font `<link>`). Writes the Core-default
  `preview.js` / `main.js` / `manager-head.html` stubs as-is, and may swap brand
  colors in `theme.js`. Does **not** modify `preview-head.js` if present — that
  is a project-specific extra (e.g. GSAP, clipboard JS), not a design-system
  fundamental.
- Scope is `base/` only — does not generate atoms / molecules / organisms.
  For atom/molecule/organism work, use the sibling
  `emulsify-figma-component` skill.

**How reference files are used:** the `references/` directory is a real
snapshot of a working `src/components/base/` design system plus its
Storybook config files. Read each reference file in full before writing
its counterpart in the target theme. Substitute only the token values —
preserve all Sass structure, Twig markup, JS export names, and class
names exactly as they appear in the reference.

See `references/README.md` for the complete reference → target file map.

**Categories present in the reference** (and therefore in the skill's
default output): `breakpoints`, `colors`, `fonts`, `functions`, `icons`,
`motion`, `spacing`, `typography`, `utility`.

**Border-radius and shadows are conditional:** if the Figma file defines
`border-radius` or `box-shadow` tokens, generate a `border-radius/` folder
and/or `shadows/` folder following the **spacing folder's structure**
exactly — same file roles, same function shape. See "Conditional
categories" in Step 4 for the file recipe. No need to ask the user to
confirm; presence of tokens in Figma is the trigger.

---

## Step 0a — Choose source type

**Before any other prompt**, ask the user:

> "Are you supplying design tokens from a **PDF** or from **Figma**?"

- If **Figma**: continue to Step 0 → **Step 1-Figma** (Figma MCP path).
- If **PDF**: ask for the absolute PDF path, then continue to Step 0 →
  **Step 1-PDF** (the PDF path defined below).

This prompt is mandatory even if the user already pasted a Figma URL or
a PDF path in their previous message — confirm once so the source
choice is explicit, then proceed. PDF and Figma are both first-class
sources; the downstream Step 4 file generation is identical regardless
of source.

---

## Step 0 — Gather inputs

Before writing any files, confirm:

| Input | How to get it |
|---|---|
| **Figma URL** *(Figma source only)* | Provided by the user. Must be a `/design/` URL **with a `node-id` query param** — e.g. `https://www.figma.com/design/{fileKey}/{name}?node-id=486-1939`. **Prefer a page-level or root "tokens" frame node** (right-click the page tab or top-level tokens frame in Figma → "Copy link to selection"). A deeply nested node returns only the variables referenced from that node and its descendants — full coverage requires a top-level node. Reject `/make/` URLs. If the URL has no `node-id`, call `get_metadata` with only `fileKey` to list pages and ask the user to pick one. |
| **PDF path** *(PDF source only)* | Absolute path on disk (e.g. `/Users/me/Downloads/guide.pdf`). Skill reads via the built-in `Read` tool, which supports PDFs natively up to 20 pages per call — for larger PDFs, the skill chunks reads in `pages:` ranges (see Step 1-PDF.0). The PDF must follow the Emulsify UI Kit "one category per page" layout (Colors page, Spacing page, Font Primary page, etc.). Non-conforming PDFs → see Step 1-PDF.6. |
| **Theme root** | Path to `web/themes/custom/{theme-name}/` in the repo |
| **Theme machine name** | Derived from the theme directory name (e.g., `my_theme`) |
| **Naming flag** | `--semantic` (default) or `--literal` |
| **Dark mode flag** | Auto-detect (default) or `--dark` to force, `--no-dark` to skip |

If the theme root is ambiguous, list candidate directories under
`web/themes/custom/` and ask. If the theme is **not** an empty Emulsify
scaffold (i.e. `src/components/` has existing components), warn the user
and ask whether to proceed anyway — this skill does not audit.

---

## Step 1-Figma — Read tokens from Figma

*(Use this section when the user picked **Figma** at Step 0a. For the
PDF path see [Step 1-PDF](#step-1-pdf--read-tokens-from-pdf) below.)*

Auto-detect path with three tiers:

1. **1a** — Single-URL Variables call. Works when the Figma file publishes Variables. One link = all categories.
2. **1b** — Per-category sequential prompts. Triggered when Variables empty. Ask user one link at a time, category by category, in a fixed order. Each link is parsed independently and read via `get_metadata` + `get_design_context`.
3. **1c** — Stop and ask. If both prior tiers yield nothing usable.

> **Mandatory prerequisite:** before any `mcp__plugin_figma_figma__use_figma`
> call, invoke the `figma:figma-use` skill (per Figma MCP server
> instructions). Read-only Figma MCP tools (`get_variable_defs`,
> `get_metadata`, `get_design_context`, `get_screenshot`) do not require
> this, but loading `figma-use` is harmless if you may later need to write.

> **Critical — desktop NOT required.** The Figma MCP plugin uses the
> remote endpoint `https://mcp.figma.com/mcp`. You do **not** need to
> tell the user to open the Figma desktop app or "select a node". All
> read tools take the target as explicit `fileKey` + `nodeId` parameters
> extracted from the URL. If you get a "need selection" / "no node"
> error, the cause is a missing or malformed `nodeId` in the call — fix
> the call, do not ask the user to open Figma.

### 1.0 Parse the Figma URL

Every read tool below requires `fileKey` (always) and `nodeId` (always
for `get_variable_defs` / `get_design_context`; optional for `get_metadata`).
For the **1b per-category fallback**, each category URL is parsed
independently — the same shape rules apply per URL.

URL shape: `https://www.figma.com/design/{fileKey}/{slug}?node-id={x}-{y}`

| Param | How to extract |
|---|---|
| `fileKey` | Path segment after `/design/`. Example: `https://figma.com/design/ABC123/My-File?node-id=486-1939` → `fileKey = ABC123` |
| `nodeId` | `node-id` query param with `-` replaced by `:`. Example: `node-id=486-1939` → `nodeId = 486:1939` |

**Variants:**
- Branch URLs (`/design/{fileKey}/branch/{branchKey}/{slug}`) → use `branchKey` as `fileKey`
- Figma Make URLs (`/make/{makeFileKey}/...`) → skill **does not support** these; tell the user
- FigJam (`/board/`) / Slides (`/slides/`) → `get_metadata` does not support; only the variable + design-context tools may work

**If the URL has no `node-id` query param:** do **not** guess a nodeId.
Call `get_metadata` with only `fileKey` (omit nodeId) — it returns the
top-level pages list. Show the user the pages and ask which one to
target, then ask for a node-specific URL (right-click frame in Figma →
"Copy link to selection") and restart Step 1.

### 1a. Try Figma Variables (preferred — one link covers everything)

Call `mcp__plugin_figma_figma__get_variable_defs` with `fileKey` +
`nodeId`. Both are required.

Variables in Figma are **file-scoped** — one call from a page-level or
root tokens frame returns every variable referenced anywhere downstream
of that node. When the Figma file uses Variables, this single call is
all you need.

Parse returned variable collections. Group variables into token categories
by name match (case-insensitive, slash-separated paths):

| Category | Name patterns to match |
|---|---|
| Colors | `color/*`, `brand/*`, `neutral/*`, `surface/*`, `text/*`, `bg/*`, `border/*`, `interaction/*`, `palette/*`, `*-color`, `*-bg`, `*-fg` |
| Spacing | `space/*`, `spacing/*`, `gap/*`, `padding/*`, `margin/*` |
| Typography | `font/*`, `type/*`, `text/*size*`, `lh/*`, `line-height/*`, `tracking/*`, `letter-spacing/*`, `font-weight/*`, `fw/*` |
| Border-radius | `radius/*`, `rounded/*`, `corner/*`, `border-radius/*` |
| Shadows | `shadow/*`, `elevation/*` |
| Breakpoints | `breakpoint/*`, `screen/*`, `bp/*` |
| Opacity | `opacity/*`, `alpha/*` |

**Detect dark mode:** if any collection has multiple modes and one matches
`/dark|night/i`, enable dual-mode generation. Otherwise single (light) mode.

If `get_variable_defs` returns non-empty → proceed to Step 1d (inventory).
If it returns empty (styles-only file) → go to **1b**.

### 1b. Per-category sequential prompts (Variables-empty fallback)

When the file has no Variables, ask the user **one Figma link per
category**, in order. Tell them up front:

> "No Figma variables detected. To build the design system I need one
> Figma link per category. I'll ask one at a time. Reply `skip` to omit
> a category. For each link, right-click the frame in Figma → 'Copy
> link to selection' so the URL has a `node-id`."

Then iterate, prompting **one category at a time** in this exact order:

1. **Colors** — frame with the palette / color tokens
2. **Spacing** — frame with the spacing scale
3. **Typography** — frame with type styles (font sizes, weights, line heights)
4. **Breakpoints** — frame defining breakpoint widths
5. **Border-radius** *(conditional — `skip` to omit)*
6. **Shadows** *(conditional — `skip` to omit)*
7. **Motion** *(conditional — `skip` to omit)*
8. **Fonts** *(font families; usually inferable from typography frame — ask only if not obvious)*

For each prompt, present:

> "Paste the Figma link to the **{category}** frame (or type `skip`):"

For each non-`skip` answer:
- Parse the URL → `fileKey` + `nodeId` (per Step 1.0)
- Call `mcp__plugin_figma_figma__get_metadata` and
  `mcp__plugin_figma_figma__get_design_context` on that `fileKey` + `nodeId`
- Extract per-category:
  - **Colors** — fills (solid + gradient stops)
  - **Spacing** — frame names like `4`, `8`, `16` with width/height matching value
  - **Typography** — text node `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`
  - **Breakpoints** — frame widths labeled `sm`, `md`, `lg`, etc.
  - **Border-radius** — `cornerRadius` on rectangles, labeled
  - **Shadows** — `effects` array (drop shadow + inner shadow)
  - **Motion** — text annotations or named easing/duration tokens
  - **Fonts** — `fontFamily` strings (deduplicate across the typography frame)

Handle skips:
- **Required categories** (colors, spacing, typography, breakpoints) skipped →
  warn the user:
  > "Skipping a required category means the generated `{category}/`
  > folder will contain only the reference scaffolding with empty maps.
  > Proceed anyway? (yes/no)"
- **Conditional categories** (border-radius, shadows, motion) skipped → omit
  the folder entirely; no warning.

If every category is skipped or returns nothing usable → go to **1c**.

### 1c. Last-resort — stop and ask

If both 1a (Variables empty) and 1b (every category skipped or empty)
yield nothing, stop and ask the user to re-check their Figma file
permissions / URLs. Do not attempt to generate files from no data.

### 1d. Emit a token inventory before writing

Print a table like:

```
Source:      Figma variables (file: <name>, 3 collections)
Modes:       light, dark
Colors:      brand (1–3), text (heading, body), bg (light, default, dark),
             border (light, default, dark), interaction (text, bg, hover, focus),
             status (info, warning, error, success)
Spacing:     xs, sm, md, lg, xl, xxl
Fonts:       <family list from --ff-* / typography variables>
Type scale:  display, headline-1..5, lead, body, small, caption, x-small
Weights:     thin, regular, medium, bold, extra-bold
Border-radius: sm, md, lg
Shadows:       sm, md, lg, xl
Breakpoints: sm, md, lg, xl, xxl
```

Confirm with user before proceeding to file writes.

---

## Step 1-PDF — Read tokens from PDF

*(Use this section when the user picked **PDF** at Step 0a. For the
Figma path see [Step 1-Figma](#step-1-figma--read-tokens-from-figma)
above.)*

The PDF path assumes an **Emulsify UI Kit-style "design tokens" PDF**:
one category per page, labeled token rows, similar to the canonical
`bowl` and `jello` reference UI Kit PDFs. For non-conforming PDFs
(marketing decks, full brand books, anything without per-page token
sections) abort per Step 1-PDF.6 and ask the user for a Figma URL or a
structured PDF.

### 1-PDF.0 Read the PDF

Call the `Read` tool on the absolute PDF path. The `Read` tool supports
PDFs natively and returns one page per `<document_content>`.

- For PDFs ≤ 10 pages: one `Read` call covers the file.
- For PDFs > 10 pages: chunk reads via the `pages:` parameter
  (`pages: "1-10"`, then `pages: "11-20"`, …). Max 20 pages per call.
- Cache parsed text in conversation variables. **Do not re-read.**

### 1-PDF.1 Per-page category detection

Each page begins with a header (one of the bold title strings at the
top of the page). Treat the header as the page's category. Mapping
(case-insensitive):

| Page header text | Category |
|---|---|
| `COLORS`, `Colors`, `Palette` | Colors |
| `Spacing` | Spacing |
| `Font Primary`, `Font Secondary`, `Typography`, `Type Scale` | Font sizes (+ implied family) |
| `Line height`, `LineHeights` | Line heights |
| `Breakpoints` | Breakpoints |
| `Border` | Border widths *(conditional)* |
| `Opacity` | Opacity *(conditional)* |
| `Radius`, `Border Radius` | Border-radius *(conditional)* |
| `Size` | Folds into Spacing (de-duplicate by px value) |
| `Shadow`, `Elevation` | Shadows *(conditional)* |
| `Motion`, `Animation`, `Duration`, `Easing` | Motion tokens *(conditional)* |

Log the page→category routing during extraction (the output checklist
requires it).

### 1-PDF.2 Per-row extraction

Within each page, rows follow one of these patterns. Extract via
regex/heuristic — examples:

- **Color row** — `{group} {label} #{hex}` (e.g. `primary default #0096e4`).
  Six-or-eight-char hex preceded by a label; the group heading is the
  most recent bold sub-header on the page (`primary`, `text`,
  `EmulsifyBlue`, `grays`, `WUP`, etc.).
- **Spacing row** — `spacing.{key} {num}` or `{key} {num}` where `{key}`
  is `xs|sm|md|lg|xl|xxl` and `{num}` is a literal px integer.
- **Font-size row** — `{name} {N}px` where `{name}` is the display label
  (`Colossus`, `Body`, `Caption`, ...) and `{N}` is an integer.
- **Line-height row** — `lineHeights.{key} {N}%` → convert percentage to
  unitless decimal (`100%` → `1`, `137%` → `1.37`).
- **Breakpoint row** — `breakpoint.{key} {num}` → px min-width.
- **Border-width row** — `border.{key} {num}` (numeric or semantic key).
- **Opacity row** — `opacity.{key} {N}%` → decimal 0..1.
- **Radius row** — `radius.{key} {num}` (px).
- **Shadow row** — `shadow.{key} {value-spec}` where `{value-spec}` is
  the full `0 4px 8px rgba(...)` string when present; otherwise capture
  the shadow stack as written and flag for manual review.

### 1-PDF.3 Font family detection

Emulsify UI Kit PDFs typically label type styles as **"Font Primary"**
without a concrete family name. After extraction:

- If a concrete `font-family` string IS present
  → carry it forward to Step 3 as the discovered family.
- If no concrete family is present → defer to Step 3 and **ask the
  user** for the family. **Do not guess a family name.** The PDF
  supplied the type *scale*; the user supplies the *family*.

### 1-PDF.4 Dark mode

UI Kit PDFs are usually single-mode (light). If the PDF has a section
labeled `Dark` / `Night` with mirrored color rows, treat the second set
as the dark palette and enable dual-mode generation per the dark-mode
rules in Step 4. Otherwise single-mode.

### 1-PDF.5 Emit the same inventory table as Step 1-Figma → Step 1d

Use the **same printed inventory format** as Step 1d, but change the
`Source:` line to `PDF (<filename>, <N> pages, <M> recognized categories)`.
Confirm with user before proceeding to file writes.

### 1-PDF.6 Failure mode — non-conforming PDF

If header detection yields **zero** recognized categories, **stop** and
reply:

> "This PDF doesn't match the Emulsify UI Kit token-page format.
> Categories I look for as page headers: Colors, Spacing, Font Primary
> / Typography, Line height, Breakpoints, Radius, Shadow, Border,
> Opacity. Could you supply a Figma `/design/` URL instead, or a PDF
> that follows the Emulsify UI Kit page-per-category layout?"

Do not freelance an extraction from an unrecognized PDF.

---

## Step 2 — Apply naming convention

### Default: `--semantic`

Map raw Figma names to a canonical schema. Slashes become hyphens; numeric
scales collapse to named tiers when possible.

| Figma raw | Semantic output |
|---|---|
| `brand/primary/500` or `brand/primary` | `brand-1` |
| `brand/secondary` | `brand-2` |
| `text/heading` | `text-heading` |
| `text/body` | `text-body` |
| `bg/default`, `surface/default` | `bg-default` |
| `space/4`, `space/md` | `md` |
| `radius/8`, `radius/md` | `md` |
| `shadow/sm` | `sm` |
| `font/heading`, `family/heading` | `heading` |
| `font-weight/700`, `weight/bold` | `bold` |

If a Figma file has multiple numeric scales under one category (e.g.
`brand/primary/100..900`), preserve the most-used or hero values and emit
all as `brand-primary-100`, `brand-primary-200`, etc.

### `--literal`

Convert slashes to dashes, kebab-case the whole name, no semantic rewrite:
- `brand/primary/500` → `brand-primary-500`
- `space/4` → `space-4`

Resulting CSS custom properties use these prefixes regardless of flag:

| Category | Prefix |
|---|---|
| Colors | `--clr-` |
| Spacing | `--s-` |
| Font size | `--fs-` |
| Font family | `--ff-` |
| Font weight | `--fw-` |
| Line height | `--lh-` |
| Letter spacing | `--ls-` |

Color Sass map keys and `clr()` call sites carry the same name (no prefix
inside the call): map key `red:`, call site `clr(red)`. Never inject a
theme-name segment like `my_theme-` or `mytheme-` into these prefixes — the
theme name lives only in Twig namespaces and asset URL paths, which the
skill handles separately via the `structure` tier rule.

---

## Step 3 — Ask about fonts

List all font families discovered (from Figma variables or text styles).
Ask the user, presenting one of:

1. **Google Fonts URL** — provide the full `https://fonts.googleapis.com/css2?...`
   URL or let the skill build one from the family list (variable axes, ital
   + wght defaults: `0,100..900;1,100..900`)
2. **Local @font-face** — user will drop font files in
   `{THEME_ROOT}/assets/fonts/` and provide format(s): woff2/woff/ttf
3. **Adobe Fonts** — provide the Typekit URL (`https://use.typekit.net/{id}.css`)
4. **None / Drupal libraries** — declared in `{theme}.libraries.yml`,
   skip SCSS / preview font loading

This decision drives the `fonts/` folder layout:

- **Local @font-face** (matches the reference exactly): write
  `fonts/font.scss` as the entry point and one `_{family}.scss` partial
  per font family (the reference shows two such partials as examples).
  User must drop font files in `{THEME_ROOT}/assets/fonts/{family}/`.
- **Google Fonts** or **Adobe Fonts**: write a single `fonts/font.scss`
  with `@import url('...')` (replace the per-family pattern with one
  import line) and **also** inject the `<link>` in `preview.js`.
- **None / Drupal libraries**: leave `fonts/` out entirely; declare in
  `{theme}.libraries.yml` (out of scope for this skill — note for user).

---

## Step 4 — Generate output files

Read `references/README.md` first for the complete reference → target path
map. **Every row is tagged with a tier** (`verbatim` / `structure` /
`tokens`) — that tag dictates exactly how to handle the file:

- `verbatim` → copy byte-for-byte. No edits at all.
- `structure` → preserve markup / class names / mixin signatures / YAML
  keys / SCSS structure. Replace **only** token values, family strings,
  and `my_theme`-namespace strings.
- `tokens` → reference shape only. Regenerate body from the Figma token
  inventory; do **not** carry my_theme-specific values forward.

Check the tier before writing each file. If a file is tagged `verbatim`,
do not "improve" it.

### Token SCSS files

Each category follows the same two-file pattern:
- `_{category}.scss` — Sass map (partial, not an entry point)
- `{category}-variables.scss` — entry point; `@use`s the map, emits `:root {}`

> **Map-key rule: spacing & font-size keys MUST be px values.**
> `$spacings: (8: …, 16: …, 32: …)` — not ordinals. Reason: the `.sb-*`
> chrome rules in `preview-head.html` (verbatim) consume `var(--s-16)`,
> `var(--s-32)`, `var(--fs-14)`. The `*-variables.scss` entry point
> emits one `--s-{key}` per map key. If your map keys are ordinal
> (1, 2, 3…22) and Figma's "Spacing 8" is 28px, `--s-8` resolves to
> 1.75rem instead of 0.5rem — chrome tables render at the wrong size.
> Same trap for `--fs-*`. Always use the **px value** as the map key
> (same as `references/base/spacing/_spacing.scss`, which uses keys
> 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, …, 120 = literal px).
> Update every downstream caller (`space(N)`, `fontsize(N)`,
> `lineheight(N)`) to pass px values too.

Mirror each category:

| Read from `references/base/` | Write to `src/components/base/` |
|---|---|
| `colors/` | `colors/` |
| `spacing/` | `spacing/` |
| `typography/` | `typography/` |
| `breakpoints/` | `breakpoints/` |
| `fonts/` | `fonts/` (see Step 3 — pattern depends on font loading strategy) |
| `motion/` | `motion/` |
| `utility/` | `utility/` |
| `icons/` | `icons/` (includes the `icon` SDC component — `icon.twig` + `icon.component.yml` — alongside the listing; also create `.gitkeep` for empty themes) |

**Dual-mode colors:** when dark mode is enabled, emit two SCSS maps
(`$colors-light`, `$colors-dark`) and generate both `:root { ... }` and
`[data-theme='dark'] { ... }` (also wrap dark in
`@media (prefers-color-scheme: dark)` so it works without a class).

### Sass function partials

Read each file in `references/base/functions/` before writing its counterpart.

- `_rem-calc.scss` and `_px2rem.scss` — **copy verbatim**, no token values
- All others (`_color.scss`, `_fonts.scss`, `_space.scss`, `_top-border.scss`)
  — update `@use` path and fallback values to match the new Sass maps
- `_radius.scss` and `_shadow.scss` — **generate these when Figma defines
  border-radius / shadow tokens** (see Conditional categories below)

### API contract: component SCSS uses the functions, not raw `var()`

The Sass function partials above (`clr`, `space`, `fontsize`,
`fontfamily`, `fontweight`, `lineheight`, `letterspacing`, and the
conditional `radius` / `shadow`) are the **only** sanctioned way to
read tokens from component SCSS. Every atom / molecule / organism
written on top of this base must call them — **never** hand-write
`var(--s-N)`, `var(--clr-X)`, `var(--fs-N)` etc. in component SCSS.

| Token | Function call | NOT |
|---|---|---|
| Color | `color: clr(red);` `background: clr(grey, 100);` `border-color: clr(text, 0.5);` (alpha) | `color: var(--clr-red);` |
| Spacing | `padding: space(16);` `gap: space(24);` | `padding: var(--s-16);` |
| Font size | `font-size: fontsize(18);` | `font-size: var(--fs-18);` |
| Font family | `font-family: fontfamily('heading');` | `font-family: var(--ff-heading);` |
| Font weight | `font-weight: fontweight(700);` | `font-weight: var(--fw-700);` |
| Line height | `line-height: lineheight(24);` | `line-height: var(--lh-24);` |
| Letter spacing | `letter-spacing: letterspacing(1);` | `letter-spacing: var(--ls-1);` |
| Border-radius | `border-radius: radius(md);` | `border-radius: var(--radius-md);` |
| Shadow | `box-shadow: shadow(lg);` | `box-shadow: var(--shadow-lg);` |

**Why the functions, not raw `var()`:**

1. **Fallback safety.** Each function emits `var(--token, $map-value)`
   so the rule still resolves to a real value if the CSS custom
   property is absent (SSR snapshots, missing `*-variables.scss`
   import, dynamic style isolation). Raw `var(--clr-red)` returns
   `unset` and the cascade falls through.
2. **`@error` on bad keys.** `space(13)` when 13 isn't in `$spacings`
   stops the build with a named error. `var(--s-13)` silently no-ops.
3. **Single refactor point.** Rename a Sass map key or change the CSS
   var prefix → all callsites flow through one function. Hand-rolled
   `var()` strings scatter and rot.
4. **`clr()` adds alpha.** `clr(red, 0.5)` returns
   `rgba(var(--clr-red), 0.5)`. Hand-rolled `rgba(var(--clr-red), 0.5)`
   only works because `--clr-red` is an RGB triple (see Step 5);
   skipping the function loses that contract guarantee.

**The two legal exceptions** — places raw `var()` is correct:

- `preview-head.html` — its `<style>` block lives outside the Sass
  pipeline; chrome rules in `references/storybook/preview-head.html`
  (`.sb-table th { padding: var(--s-16) var(--s-32) }`) are verbatim and
  reference raw vars by design.
- Generated `*-variables.scss` entry points emit `:root { --s-N: …; }`
  declarations — that's the source of the vars, not a consumer.

The reference `_typography-mixins.scss` demonstrates the contract in
practice: every mixin uses `fontsize(N)`, `fontfamily('serif')`,
`fontweight(800)`, `lineheight(N)`, `letterspacing(N)`. Mirror that
style in every component you write.

### `base.scss`

Read `references/base/base.scss`. Preserve the exact `@use` order for
the function partials (`functions/color`, `functions/space`).

**Add `@use` lines for every token entry point** (`colors/color-variables`,
`spacing/spacing-variables`, `typography/typography-variables`, and any
conditional categories like `shadows/shadows-variables`). The reference
`base.scss` *omits* these because the my_theme theme loads variable entry
points elsewhere — but for a fresh Emulsify scaffold, they belong in
`base.scss` so the `:root { --clr-…, --s-… }` blocks reach the compiled
Drupal CSS.

> **Cascade gotcha.** Emulsify Core loads the theme's compiled
> `dist/**/*.css` into the Storybook preview after `preview-head.html`'s
> `<style>` block. Any `--var` your SCSS emits with the same name as a
> `preview-head.html` declaration **wins** in the cascade. So Storybook
> is NOT insulated from your SCSS values. This is why map-key collisions
> (see "Map-key rule" above) silently break Storybook chrome —
> preview-head's `--s-16: 1rem` gets overridden by SCSS's `--s-16: 4.5rem`
> at runtime. Match values or use disjoint names.

When you generate the conditional categories `border-radius/` and/or
`shadows/` (see below), add their `@use` lines alongside the others.

### Conditional categories — border-radius and shadows

If the Figma token inventory (Step 1) detected `border-radius` or
`box-shadow` tokens, generate a full folder for each, **modeled exactly
on `spacing/`**. The reference does not contain templates for these
folders because the spacing folder *is* the template.

| File role | Spacing (reference) | Border-radius (when applicable) | Shadows (when applicable) |
|---|---|---|---|
| Sass map partial | `spacing/_spacing.scss` (`$spacings: (...)`) | `border-radius/_border-radius.scss` (`$border-radius: (...)`) | `shadows/_shadows.scss` (`$shadows: (...)`) |
| CSS var entry point | `spacing/spacing-variables.scss` (emits `--s-*`) | `border-radius/border-radius-variables.scss` (emits `--radius-*`) | `shadows/shadows-variables.scss` (emits `--shadow-*`) |
| Sass function | `functions/_space.scss` (`space()`) | `functions/_radius.scss` (`radius()`) | `functions/_shadow.scss` (`shadow()`) |
| Storybook story JS | `spacing/spacing.stories.js` | `border-radius/border-radius.stories.js` | `shadows/shadows.stories.js` |
| Storybook Twig | `spacing/spacing.twig` | `border-radius/border-radius.twig` | `shadows/shadows.twig` |
| Storybook YAML | `spacing/spacing.yml` | `border-radius/border-radius.yml` | `shadows/shadows.yml` |

**Function shape** (mirror `_space.scss` exactly — same `@use` /
`map.has-key` / `var(...)` / `@error` structure):

```scss
@use 'sass:map';
@use '../border-radius/border-radius' as *;

@function radius($key) {
  @if map.has-key($border-radius, $key) {
    @return var(--radius-#{$key}, map.get($border-radius, $key));
  } @else {
    @error 'radius(#{$key}); does not exist in the $border-radius map.';
  }
}
```

Same shape for `shadow()` reading from `$shadows`. The Storybook story /
Twig / YAML files for the new categories mirror the spacing trio: same
story `title` pattern (`Base/BorderRadius`, `Base/Shadows`), same Twig
table structure with `--radius-*` or `--shadow-*` in the CSS Variable
column, same YAML keys (`label`, `name`, `value`, `usage`).

Finally, add the new entry points to `base.scss`:
```scss
@use 'border-radius/border-radius-variables';   // only if border-radius detected
@use 'shadows/shadows-variables';               // only if shadows detected
```

### Storybook story files

Each category (colors, spacing, breakpoints, typography, icons): `.stories.js`,
`.twig`, `.yml` (except `icons/` — no `.yml`).

Read the reference story files before writing each category. Typography
uses hyphenated filenames — `type-faces`, `heading-styles`, `body-styles`
— not camelCase.

What to update per file type:
- **`.yml`** — replace every token name/value pair with the new tokens.
  Preserve YAML structure exactly.
- **`.twig`** — preserve all markup and class names. Rarely needs changes.
- **`.stories.js`** — preserve `title` values and export names exactly.
  Storybook's `/index.json` story IDs depend on these.

### `icons/` directory

Copy `references/base/icons/icons.stories.js` and `icons.twig` verbatim.
Also ship the `icon` SDC component the listing depends on:

- `references/base/icons/icon.twig` → `src/components/base/icons/icon.twig`
  — **verbatim**. Uses project-local `bem()` / `add_attributes()` and
  `source('@assets/icons/' ~ name ~ '.svg')`. No theme-name or token
  values to substitute.
- `references/base/icons/icon.component.yml` →
  `src/components/base/icons/icon.component.yml` — **tokens tier**.
  Reference omits `enum:` under `properties.name`. **Imperatively** list
  `{THEME_ROOT}/assets/icons/*.svg` (e.g. `ls {THEME_ROOT}/assets/icons/*.svg`),
  strip the `.svg` extension, sort alphabetically, and emit the result
  as the `enum:` block. Only when the directory is empty or missing
  does the skill omit `enum:` — once real SVGs land, re-run the skill
  (or hand-edit the yml) to populate it.

**Location is fixed to `base/icons/` — do NOT also create a top-level
`src/components/icon/` folder.** Drupal SDC discovers components by
folder name regardless of nesting depth, so two folders named `icon/`
register as duplicate component IDs and SDC throws a registration
error. The reference ships the files under `base/icons/`; the skill
mirrors that path and nothing else. The `{theme}:icon` Twig include in
`icons.twig` resolves to the component at `base/icons/icon.*` — no
top-level duplicate needed.

Without `icon.twig` + `icon.component.yml`, the `Base/Icons` Storybook
story renders rows of empty `<span class="icon sb-icon-preview">`
cells because `icons.twig`'s `{% include '{theme}:icon', … %}` calls
have no target.

The reference does not include a `.gitkeep` (the reference's icons
folder is populated). For a fresh theme, also write `icons/.gitkeep`
so the directory is tracked in git until real SVGs land in
`assets/icons/`.

---

## Step 5 — Update Storybook config files

Emulsify Core 4 uses a **Vite** builder and renders Twig/SDC stories with its
own integration. The only config file that carries design-system content is
`preview-head.html`. `preview.js`, `main.js`, `theme.js`, and
`manager-head.html` are Core-default stubs — write them from
`references/storybook/` as-is (the one optional edit is `theme.js` brand colors).

### `preview-head.html` (the one design-system config file)

Read `references/storybook/preview-head.html` in full.

Core 4 appends this file to the Storybook preview iframe `<head>`. It carries
three things inside one `<style>` block plus an optional font `<link>`:

1. The `:root {}` design tokens (plain CSS — no Sass).
2. The `.sb-*` chrome rules the `Base/*` stories render with (verbatim).
3. The `[data-component-theme='dark']` rule (if dark mode).

Fill the `:root {}` block with every token value as **plain CSS**. No `@use`,
no `@import`, no Sass — this `<style>` block is served as-is to the browser.

> **Critical — colors must be RGB channel triples, not hex.** The
> `clr()` Sass function (`references/base/functions/_color.scss`) emits
> `rgba(var(--clr-x), $alpha)`. If `--clr-x` is `#005f89`, the browser
> receives `rgba(#005f89, 1)` — invalid, ignored, component renders
> with no color. Emit each color CSS var as comma-separated channels
> (e.g. `--clr-link: 0, 95, 137;`), then any direct-CSS consumer wraps
> with `rgb(...)` (e.g. `background-color: rgb(var(--clr-link));`).
> The reference's `[data-component-theme='dark']` rule already uses
> `rgb(var(--clr-grey-100))` — match that pattern.

**Chrome-required CSS vars** consumed by the `.sb-*` rules (verbatim in
`references/storybook/preview-head.html`): `--s-8 --s-16 --s-24 --s-32 --s-48
--fs-14 --fs-16`. These names are fixed — the chrome rules `var()`
them by these literal names. Two valid strategies:

- **Px-keyed SCSS scale (preferred)** — if your `_spacing.scss` is px-keyed
  per the "Map-key rule" in Step 4, the SCSS already emits `--s-8 /
  --s-16 / --s-24 / --s-32 / --s-48` with the correct rem values. **Omit
  the chrome alias block entirely** — declaring them in `preview-head.html`
  duplicates (and may collide with) the SCSS output.
- **Non-px / semantic SCSS scale** (e.g. bowl uses xs/sm/md/lg/xl/xxl) —
  the SCSS emits `--s-xl`, `--s-md`, etc. with no `--s-8`/`--s-16`/…
  collision. Declare the chrome aliases explicitly in `preview-head.html`
  with their **px-implied** rem values (`--s-8: 0.5rem; --s-16: 1rem;
  --s-24: 1.5rem; --s-32: 2rem; --s-48: 3rem; --fs-14: 0.875rem;
  --fs-16: 1rem;`). Never set them to anything other than the
  px-implied rem.

Example `:root {}` block (truncated — assumes px-keyed SCSS scale, so
no chrome alias block):

```css
:root {
  /* Spacing — px-keyed, plain rem values (also emitted by SCSS at same names) */
  --s-2: 0.125rem;
  --s-8: 0.5rem;
  --s-16: 1rem;
  --s-32: 2rem;
  --s-48: 3rem;

  /* Colors as RGB triples (NOT hex) — clr() wraps in rgba() */
  --clr-white: 255, 255, 255;
  --clr-link: 0, 95, 137;
  --clr-link-hover-lighter: 0, 64, 91;
  --clr-grey-1000: 8, 11, 12;
}
```

Do **NOT** invent alias names like `--spacing-xl`, `--fs-small`,
`--fs-caption` — they're not consumed by any `.sb-*` rule and will be
dead weight.

Update the `[data-component-theme='dark']` rule to point at the
design's darkest surface token (e.g. `rgb(var(--clr-grey-1000))`).

**Fonts.** Update the font `<link>` (Google Fonts / Adobe Fonts) per Step 3's
font decision, or delete it entirely when the theme ships local `@font-face`
partials. Font loading must happen via `<link>` in this file's head — never via
`@import` in SCSS or JS.

Leave all `.sb-*` class rules **unchanged**.

Write result to `{THEME_ROOT}/config/emulsify-core/storybook/preview-head.html`.

### `preview.js`, `main.js`, `manager-head.html` — Core-default stubs

These no longer carry any design-system or webpack-era content under Core 4:

- `preview.js` → `export const parameters = {}`. Core renders Twig/SDC itself,
  so there are no `include()`/`source()` polyfills, no `drupalSettings` mock,
  and no `require.context` story loader to maintain.
- `main.js` → `export default {}`. Vite compiles SCSS directly, so there is no
  `sass-loader` legacy-API patch; Core serves theme assets, so there is no
  `staticDirs` map.
- `manager-head.html` → Storybook manager chrome only.

Copy each from `references/storybook/` verbatim to
`{THEME_ROOT}/config/emulsify-core/storybook/`. A fresh `whisk`-style scaffold
already ships these stubs — re-emitting them just guarantees a clean baseline.

### `theme.js` — optional manager branding

Read `references/storybook/theme.js`. It themes Storybook's **manager UI**
(sidebar/toolbar), not rendered components. Carry it as-is, or optionally swap
`colorPrimary` / `colorSecondary` / `appBg` and the fonts to the design's
palette. Not required for any `Base/*` story to render. Write to
`{THEME_ROOT}/config/emulsify-core/storybook/theme.js`.

---

## Step 6 — Verify the build

```bash
cd {THEME_ROOT}
npm install 2>&1 | tail -5
# Vite build needs ./dist to exist (npm run ensure-dist also creates it).
mkdir -p dist
npm run develop &
sleep 25
curl -s http://localhost:6006/index.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
stories = list(data.get('entries', data.get('stories', {})).keys())
expected = [
  'Base/Colors', 'Base/Spacing', 'Base/Breakpoints',
  'Base/TypeFaces', 'Base/HeadingStyles', 'Base/BodyStyles',
  'Base/Icons',
  # Add 'Base/BorderRadius' if Figma had border-radius tokens
  # Add 'Base/Shadows' if Figma had box-shadow tokens
]
missing = [e for e in expected if not any(e in s for s in stories)]
print('MISSING:', missing if missing else 'none — all stories found')
print('TOTAL stories:', len(stories))
"
# Kill storybook when done:
kill %1 2>/dev/null
```

Common failure modes:

| Error | Fix |
|---|---|
| PDF has page headers that don't match the recognized category table | Non-conforming PDF (Step 1-PDF.6). Stop and ask the user for a Figma URL or a PDF that follows the Emulsify UI Kit page-per-category layout. Do NOT freelance an extraction. |
| PDF has type styles labeled "Font Primary" with no concrete family name | Per Step 1-PDF.3, defer to Step 3 and ask the user for the family. **Do not guess** a family name. |
| PDF > 20 pages and `Read` errors | Chunk reads with `pages: "1-10"`, then `pages: "11-20"`, … (Read tool max is 20 pages per call). Merge inventories across chunks. |
| Figma tool says "need selection" / "no node provided" | Missing or malformed `nodeId`. Do NOT ask user to open desktop app. Re-parse the URL: `node-id=486-1939` → pass `nodeId: "486:1939"`. Both `fileKey` and `nodeId` are required for `get_variable_defs` and `get_design_context`. |
| `get_variable_defs` returned empty but the file has Variables | The supplied `nodeId` was too deep to reach any variable-bound node. Ask user for a page-level or root tokens frame URL ("Copy link to selection" on the Figma page tab) and retry 1a. |
| URL has no `node-id` query param | Call `get_metadata` with only `fileKey` (omit nodeId) → returns top-level pages. Ask user for a node-specific URL ("Copy link to selection" in Figma). |
| URL contains `/make/` | Figma Make files not supported by this skill. Ask user for a regular `/design/` URL. |
| `Base/*` story CSS looks unstyled / chrome tables broken | The `<style>` block in `preview-head.html` contains Sass (`@use`, nesting, functions). Core serves it as literal CSS to the browser — no Sass compile step. Inline all values as plain CSS. |
| A `.scss` file fails to compile under Vite | Real Sass error, not a loader issue (Core 4 compiles SCSS through Vite directly — no `sass-loader` patch). Check the `@use` paths and map keys reported in the error. |
| `Base/Icons` story rows show raw text like `/assets/icons/arrow-right.svg` instead of the inline SVG | The SVG file isn't being served. Confirm the referenced files exist under `{THEME_ROOT}/assets/icons/` and that the theme's `project.emulsify.json` asset config is intact — Core 4 serves theme assets through Vite (no skill-side `staticDirs` map). |
| Drupal SDC registration error: duplicate component id `icon` | Icon SDC scaffolded at both `src/components/base/icons/icon.*` and `src/components/icon/icon.*`. Delete the top-level `src/components/icon/` folder; SDC discovers components by folder name regardless of nesting depth. Skill must only write under `base/icons/`. |
| Component background appears unset / browser DevTools shows `Invalid property value` on `background-color: rgba(#005f89, 1)` | `--clr-*` in `preview-head.html` written as hex. They must be RGB triples (e.g. `--clr-link: 0, 95, 137;`) because `clr()` wraps in `rgba(var(--clr-x), 1)`. |
| Storybook fails to start: `no such directory: ./dist` | Run `mkdir -p {THEME_ROOT}/dist` once (or `npm run ensure-dist`). `dist/` is the Vite build output target. |
| Story missing from `/index.json` | Check `.stories.js` `title` + export name matches the reference exactly |
| Font not loading | Ensure the font `<link>` is in `preview-head.html`, not `@import` in CSS |
| Wrong CSS var name | Re-read the token source; use exact property names from Step 1 inventory |
| Dark theme not applying | Update `[data-component-theme='dark']` in `preview-head.html` to use `rgb(var(--clr-x))` with the design's darkest surface token. |
| Vite/Sass error: cannot find `base/...` | Check `base.scss` `@use` lines match generated category folders |
| Twig namespace not resolving | Core resolves namespaces from the theme's `*.info.yml` / `project.emulsify.json`. Ensure `base/` Twig `include`s reference the target theme machine name (e.g. `{theme}:icon`), not `my_theme`. |
| Storybook `.sb-table` cells render with too much or too little padding; `.sb-content` margins look 3–4× off | Spacing SCSS map keyed by **ordinals** (1..22) instead of px values. Chrome rules consume `var(--s-16)`, `var(--s-32)` expecting px-implied rem; SCSS-emitted `--s-16` (e.g. 4.5rem for ordinal-16=72px) wins the cascade and blows out the layout. Re-key `_spacing.scss` + `spacing.yml` by px value (2, 4, 8, …, 120), update every `space(N)` callsite (`_container.scss`, `_top-border.scss`, `_utility.scss`, `_typography-mixins.scss`), and drop the now-duplicate `--s-*` alias block from `preview-head.html`. Same trap and same fix for `--fs-*`. |

---

## Output checklist

- [ ] Source type confirmed at Step 0a (PDF or Figma) — explicit user response, not inferred from a prior message
- [ ] **If PDF:** per-page category routing logged (which page → which category) before any file writes
- [ ] **If PDF and family undetected:** user supplied the font family at Step 3 (skill did not guess a family name)
- [ ] Token inventory printed before any files written, user confirmed
- [ ] Every reference file read before its counterpart was generated
- [ ] All `_`-prefixed files are Sass partials (not entry points)
- [ ] All entry-point files have no `_` prefix
- [ ] `base.scss` uses `@use` for every category (not `@import`)
- [ ] `base.scss` `@use`s every `*-variables.scss` entry point so Drupal CSS-var output is non-empty (reference omits these — add for fresh themes)
- [ ] `_rem-calc.scss` + `_px2rem.scss` copied verbatim
- [ ] `preview-head.html` `<style>` `:root` block is plain CSS (no Sass)
- [ ] `preview-head.html` `--clr-*` declarations are **RGB channel triples** (`0, 95, 137`), NOT hex (`#005f89`)
- [ ] `[data-component-theme='dark']` uses `rgb(var(--clr-x))` with design's darkest surface token
- [ ] Spacing map keyed by **px value** (2, 4, 8, …) — not ordinal (1, 2, 3, …22)
- [ ] Font-size map keyed by **px value** (12, 14, 16, …) — not ordinal
- [ ] Chrome-required vars (`--s-8 --s-16 --s-24 --s-32 --s-48 --fs-14 --fs-16`) resolve to their **px-implied rem** at runtime — declared once (either by SCSS emit if scale is px-keyed, or by explicit alias in `preview-head.html` if scale is semantic). No duplicate declaration with mismatched values.
- [ ] `preview-head.html` font `<link>` matches Step 3 decision (or removed for local `@font-face`)
- [ ] `preview.js` / `main.js` / `manager-head.html` copied verbatim from `references/storybook/` (Core-default stubs)
- [ ] `theme.js` written (carried as-is, or brand colors swapped to design palette)
- [ ] `{THEME_ROOT}/dist/` directory exists (Vite build output target)
- [ ] `icons/.gitkeep` present
- [ ] Icon SDC component (`icon.twig` verbatim + `icon.component.yml` with `enum:` regenerated from `assets/icons/*.svg`, or `enum:` omitted if no SVGs) present under `src/components/base/icons/`
- [ ] Icon SDC component exists **only** under `src/components/base/icons/` — no duplicate at top-level `src/components/icon/` (Drupal SDC throws `duplicate component id` otherwise)
- [ ] Storybook started, `/index.json` verified
- [ ] Zero Vite/Sass build errors
- [ ] First component SCSS that calls `clr()` compiles cleanly (no `rgba(#hex)` errors)
- [ ] All 7 base stories present (Colors, Spacing, Breakpoints, TypeFaces, HeadingStyles, BodyStyles, Icons)
- [ ] `Base/BorderRadius` story present **iff** Figma defined border-radius tokens
- [ ] `Base/Shadows` story present **iff** Figma defined box-shadow tokens

---

## Notes / gotchas

- **Prefer a page-level or root tokens frame node** for the 1a Variables
  call. `get_variable_defs` returns only variables referenced from the
  supplied `nodeId` and its descendants — a deeply nested chip URL gives
  partial coverage even when the file is variable-rich.
- Figma MCP read tools may return large payloads — cache responses in
  variables; do not re-fetch.
- A Figma file's `success` color is sometimes a typo of `error` in light
  mode. Cross-check against dark mode and warn the user.
- Font family names are sometimes inconsistent between Figma variables
  and text styles. Prefer variable values when both exist.
- Emulsify expects `utility/_container.scss` as a **separate file**, not
  merged into `_utility.scss`.
- `functions/_top-border.scss` is expected to exist even if no current
  component uses it — write it from the reference.
- **PDF font-family caveat:** Emulsify UI Kit-style PDFs label type
  styles as "Font Primary" without naming the actual family. Per
  Step 1-PDF.3 the skill must ask the user for the family at Step 3 —
  never default to a specific family; always ask the user.
- **PDF page-chunking:** the `Read` tool caps at 20 pages per call. For
  longer PDFs, read in ranges (`pages: "1-10"`, `pages: "11-20"`, …)
  and merge the per-chunk inventories before the Step 1-PDF.5 confirm.
