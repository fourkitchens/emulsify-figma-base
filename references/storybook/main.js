import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import extendWebpackConfig from '../../../node_modules/@emulsify/core/.storybook/webpack.config.js';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
// Theme root = three levels above this file (config/emulsify-core/storybook/main.js → theme/).
const themeRoot = resolve(_dirname, '../../..');

/**
 * Storybook override: run Emulsify's webpack chain first, then walk every
 * sass-loader entry (including those nested inside `oneOf` blocks added by
 * Storybook 9) and force `api: 'legacy'`.
 *
 * Why: Emulsify-core's storybook webpack config uses `node-sass-glob-importer`
 * (legacy importer API). Dart Sass >= 1.45 defaults to the modern API which
 * rejects legacy importers with:
 *   "An importer must have either canonicalize and load methods,
 *    or a findFileUrl method."
 * Forcing `api: 'legacy'` keeps the legacy importer working without rewriting
 * Emulsify-core internals.
 *
 * Substitute the bracketed-tag prefix in the console.log with the target
 * theme machine name when this file is written into a theme.
 */
const patchSassRule = (use) => {
  if (
    use &&
    typeof use === 'object' &&
    typeof use.loader === 'string' &&
    use.loader.includes('sass-loader')
  ) {
    use.options = { ...(use.options || {}), api: 'legacy' };
    return true;
  }
  return false;
};

const walkRules = (rules, hits) => {
  if (!Array.isArray(rules)) return;
  rules.forEach((rule) => {
    if (!rule) return;
    if (Array.isArray(rule.oneOf)) walkRules(rule.oneOf, hits);
    if (Array.isArray(rule.rules)) walkRules(rule.rules, hits);
    const uses = Array.isArray(rule.use)
      ? rule.use
      : rule.use
        ? [rule.use]
        : [];
    uses.forEach((u) => {
      if (patchSassRule(u)) hits.push(rule.test ? rule.test.toString() : '?');
    });
    if (rule.loader && patchSassRule(rule)) {
      hits.push(rule.test ? rule.test.toString() : '?');
    }
  });
};

const configOverrides = {
  // Map each assets/ dir to a matching URL so source('@assets/icons/x.svg')
  // resolves to /assets/icons/x.svg. The emulsify-core default `staticDirs`
  // uses plain strings, which Storybook serves at URL root (`/x.svg`) — that
  // breaks the source() XHR fetch and forces the polyfill to fall back to
  // returning the URL string, which is what shows up in the Icons table.
  //
  // Absolute paths are required: Storybook 9's `{from, to}` form serializes
  // to "from:to" and runs it through path.resolve, which mangles colon-form
  // relative paths. Absolute `from` skips that codepath.
  staticDirs: [
    { from: resolve(themeRoot, 'assets/fonts'),  to: '/assets/fonts'  },
    { from: resolve(themeRoot, 'assets/images'), to: '/assets/images' },
    { from: resolve(themeRoot, 'assets/icons'),  to: '/assets/icons'  },
    { from: resolve(themeRoot, 'assets/videos'), to: '/assets/videos' },
    resolve(themeRoot, 'dist'),
  ],
  webpackFinal: async (storybookConfig, options) => {
    const config = await extendWebpackConfig({
      config: storybookConfig,
      ...options,
    });
    const hits = [];
    walkRules(config.module && config.module.rules, hits);
    // eslint-disable-next-line no-console
    console.log(`[{THEME_MACHINE_NAME}] patched ${hits.length} sass-loader use(s):`, hits);
    return config;
  },
};

export default configOverrides;
