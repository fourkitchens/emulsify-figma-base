# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A single Claude skill: `emulsify-figma-base`. Generates the `src/components/base/` layer of an Emulsify Drupal child theme from either a Figma file (Figma MCP) or a design-tokens PDF (built-in `Read` tool). There is no application, no build, no tests, no lint. "Working in this repo" means editing the skill definition (`SKILL.md`) and its frozen reference snapshot (`references/`).

For non-Figma/PDF flows backed by the Anthropic Design API, use the sibling skill `emulsify-design-base` (not in this repo).

## Repo layout

- `SKILL.md` — the skill itself. Frontmatter `name`/`description` is what Claude Code matches against; the body is the runtime procedure (Step 0a … Step 6 + Output checklist).
- `references/` — read-only canonical snapshot of a working `src/components/base/` plus the Emulsify Core 4 (Vite) Storybook config files under `references/storybook/` (`preview-head.html`, `preview.js`, `main.js`, `theme.js`, `manager-head.html`). The skill instructs Claude to **read each reference file before writing its target counterpart** and to copy/structure/regenerate per tier.
- `references/README.md` — the file-map index. Every reference file is tagged with one of three tiers: `verbatim` (copy byte-for-byte), `structure` (preserve markup / class names / mixin signatures / YAML keys; swap only token values + theme machine name), `tokens` (reference shows the shape only; regenerate body from the token inventory). Always check the tier before editing or pointing the skill at a file.

## Editing rules (apply when changing this skill)

- **Do not edit `references/*` to "improve" them during a skill run.** Those files are the canonical reference. Modifications outside a real skill-maintenance task will silently change every future generation.
- When fixing a bug surfaced by a skill run, the fix usually belongs in `SKILL.md` (procedure, gotcha, checklist row) — not in the references. References change only when the upstream Emulsify pattern changes.
- The frontmatter `description` is load-bearing: it's how Claude Code decides to trigger the skill. Preserve the trigger phrases ("generate Emulsify base from Figma or a design-tokens PDF", "apply this design PDF to Emulsify", `/emulsify-figma-base`, etc.) when editing.
- Keep the Output checklist in sync with the steps. Each "Common failure mode" added to Step 6 should have a matching checklist row above it.

## Non-obvious invariants the skill enforces (touch with care)

These are easy to break by "cleaning up" `SKILL.md` or the references. Each one fixes a real failure mode documented in Step 6.

- **Map-key rule.** `_spacing.scss` and `_typography.scss` map keys are **px values** (1, 2, 4, …, 120 / 12, 14, 16, …), not ordinals. Storybook chrome (`.sb-*` rules in the verbatim `preview-head.html` `<style>` block) consumes `var(--s-16)`, `var(--s-32)`, `var(--fs-14)`. Ordinal keys silently break the layout because SCSS-emitted vars win the cascade over preview-head's.
- **Colors as RGB triples in `preview-head.html`.** `clr()` wraps in `rgba(var(--clr-x), $alpha)`. Hex breaks every direct CSS consumer. Triples format: `--clr-link: 0, 95, 137;`.
- **Components must call Sass functions, never raw `var()`.** `clr()`, `space()`, `fontsize()`, `fontfamily()`, `fontweight()`, `lineheight()`, `letterspacing()`, and conditional `radius()`/`shadow()` are the only sanctioned read path. Two legal exceptions: `preview-head.html` (the `<style>` block is outside the Sass pipeline) and `*-variables.scss` entry points (the source of the vars).
- **Emulsify Core 4 uses a Vite builder.** Core compiles SCSS through Vite and renders Twig/SDC itself, so the webpack-era config is gone: `main.js` is an empty-overrides stub (no `sass-loader` legacy patch, no `staticDirs` map) and `preview.js` is a parameters-only stub (no Twig `include()`/`source()` polyfills, no `drupalSettings` mock, no `require.context` loader). The only design-system-dependent config file is `preview-head.html`.
- **`fonts/` layout depends on the font-loading strategy** (Step 3): local `@font-face` → entry `font.scss` + one partial per family; Google/Adobe → single `@import url(...)` in `font.scss` + `<link>` in `preview-head.html`; Drupal libraries → omit `fonts/` entirely.
- **`my_theme` strings in references = theme machine name, not brand.** They live in `base/` Twig `my_theme:icon` includes and asset URL paths (the Core 4 config stubs no longer carry Twig namespaces or a `drupalSettings` mock). CSS custom property prefixes (`--clr-`, `--s-`, etc.) and Sass map keys (`red:`, `grey:`) **never** carry a theme-name segment. Per `references/README.md`.
- **`base.scss` in the reference omits `@use` lines for `*-variables.scss` entry points** because the source theme loads them elsewhere. A fresh Emulsify scaffold needs them added — otherwise the `:root { --clr-…, --s-… }` blocks never reach compiled CSS.
- **Config stubs are Core defaults — copy verbatim.** `preview.js`, `main.js`, and `manager-head.html` carry no design-system content under Core 4; re-emit them from `references/storybook/` as-is. `theme.js` is optional manager branding (brand colors may be swapped to the design palette). Only `preview-head.html` is regenerated from the token inventory.
- **`border-radius/` and `shadows/` are conditional, modeled on `spacing/`.** Reference does not contain them. Mirror spacing's shape exactly (`_X.scss` map → `X-variables.scss` entry → `functions/_X.scss` with `map.has-key` + `@error` + `var()`-with-fallback → Storybook trio).

## Working with the Figma MCP from this skill

- Read-only Figma MCP tools (`get_variable_defs`, `get_metadata`, `get_design_context`, `get_screenshot`) do NOT need the `figma:figma-use` skill loaded.
- Any `mcp__plugin_figma_figma__use_figma` call MUST be preceded by loading the `figma:figma-use` skill — this is a hard prerequisite per the Figma MCP server instructions.
- Figma desktop app is **not** required. The MCP plugin uses the remote endpoint. "Need selection" / "no node" errors mean a missing or malformed `nodeId` in the call (`node-id=486-1939` → `nodeId: "486:1939"`), not a user-side action.
- `get_variable_defs` is file-scoped: a page-level or root tokens-frame `nodeId` returns every downstream variable in one call. Deeply nested chip URLs return partial coverage even on variable-rich files.

## Working with the PDF source path

- The `Read` tool supports PDFs natively, max 20 pages per call. Chunk via the `pages:` param (`pages: "1-10"`, then `pages: "11-20"`, …) and merge inventories before the Step 1-PDF.5 confirm.
- PDF must follow the Emulsify UI Kit "one category per page" layout (page header = category). Non-conforming PDFs → Step 1-PDF.6 (stop and ask for a Figma URL or structured PDF; **do not freelance**).
- UI Kit PDFs label type styles "Font Primary" without naming a family. Per Step 1-PDF.3: defer to Step 3 and **ask the user** for the family. Never guess a family name.

## Commit messages

Recent history (`git log`) shows terse subject-line-only commits ("PDF support added", "BCJ reference removed", "Update READMEs"). Match that style.
