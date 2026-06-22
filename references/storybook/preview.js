// This file is loaded in Storybook's browser preview iframe through Vite.
//
// Emulsify Core 4 renders Twig/SDC stories through its own Vite + Twig
// integration and ships the default a11y parameters, so this file no longer
// needs the webpack-era Twig polyfills (include/source), the drupalSettings
// mock, or the require.context story loader. Keep it to Storybook preview
// parameters and any browser-side imports your stories need (e.g. global CSS).
//
// Core merges this project's parameter overrides into its defaults.
// See https://storybook.js.org/docs/writing-stories/parameters#story-parameters.

// Example: load project CSS into every story.
//
// import '../../../src/global/storybook.css';

// Example: override selected Storybook parameters.
//
// export const parameters = {
//   layout: 'fullscreen',
//   controls: {
//     matchers: {
//       color: /(background|color)$/i,
//       date: /Date$/i,
//     },
//   },
// };

export const parameters = {};

export default parameters;
