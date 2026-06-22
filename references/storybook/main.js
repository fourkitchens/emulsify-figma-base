// This file is loaded by Emulsify Core 4's shared Storybook main config.
//
// Emulsify Core 4 uses a Vite builder. The webpack-era overrides this file used
// to carry are no longer needed:
//   - No sass-loader `api: 'legacy'` patch (Vite compiles SCSS directly).
//   - No `staticDirs` {from, to} map for assets/* (Core serves theme assets via
//     its Vite static-asset handling).
//
// Keep the default export as an object. Core shallow-merges it into its default
// Storybook config. Addons are appended to Core's defaults unless replaceAddons
// is true. Use this file only for Node-side config: addons, static dirs, or
// final config patches. Browser-side parameters belong in preview.js; manager
// branding belongs in theme.js.

// Pass empty config overrides by default so generated themes inherit Emulsify
// Core's stories, framework, Vite builder, Twig handling, and default addons.
const configOverrides = {};

// Example: add a project-specific addon and static directory.
//
// const configOverrides = {
//   addons: ['@storybook/addon-viewport'],
//   staticDirs: ['public'],
// };

// Example: patch the final Storybook config after Core applies the default
// export above. `env` is the normalized project.emulsify.json model.
//
// export function extendConfig(config, { env }) {
//   return config;
// }

// Avoid redefining stories, framework, core.builder, or viteFinal unless the
// project is intentionally replacing Emulsify Core's Storybook integration.

export default configOverrides;
