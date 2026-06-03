import '../../../assets/fonts/sb-fonts.css';
import './preview-head.css';
import './preview-head.js';
// eslint-disable-next-line import/no-unresolved
import Twig from 'twig';

// Disable Twig.js cache for live reload.
Twig.cache(false);

// Constants used by the `source()` polyfill.
const PUBLIC_ASSET_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname === 'fourkitchens.github.io')
  ? '/my_theme/assets/'
  : '/assets/';
const INLINE_ASSET_EXTS = new Set(['svg', 'html', 'twig', 'css', 'js', 'json', 'txt', 'md']);
const IMAGE_ASSET_EXTS  = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);

const twigComponents = require.context(
  '../../../src/components/ui/',
  true,
  /\.twig$/
);

/**
 * Map Drupal-style template IDs to the compiled Twig function.
 * @param {string} name
 * @return {Function|undefined}
 */
const twigNamespaceToPath = (name) => {
  // my_theme:icon, @my_theme/icon.twig
  if (name.startsWith('my_theme:') || name.startsWith('@my_theme/')) {
    const part = name.startsWith('my_theme:') ? name.split(':')[1] : name.replace('@my_theme/', '').replace('.twig', '');
    const path = `./${part}/${part}.twig`;
    try {
      {
        const mod = twigComponents(path);
        return mod && mod.default ? mod.default : mod;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Cannot resolve Twig component for '${name}' at '${path}'`);
    }
  }

  // @icon.twig → icon/icon.twig
  if (name.startsWith('@') && name.endsWith('.twig')) {
    const part = name.slice(1, -5); // remove leading @ and trailing .twig
    const path = `./${part}/${part}.twig`;
    try {
      return twigComponents(path).default || twigComponents(path);
    } catch (e) {
      console.error(`Cannot resolve Twig shorthand template '${name}' at '${path}'`);
    }
  }

  // my_theme/icon.twig via webpack alias
  if (name.startsWith('my_theme/')) {
    const part = name.replace(/^my_theme\//, '').replace('.twig', '');
    const path = `./${part}/${part}.twig`;
    try {
      return twigComponents(path).default || twigComponents(path);
    } catch (e) {
      console.error(`Cannot resolve Twig alias template '${name}' at '${path}'`);
    }
  }

  try {
    {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = require(name);
      return mod && mod.default ? mod.default : mod;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Cannot resolve Twig template '${name}'`, e);
    return () => '';
  }
};

/**
 * Twig `include()` polyfill.
 * Mirrors Drupal behaviour inside Storybook.
 * @param {string} templateName
 * @param {Object} [variables]
 * @param {boolean} [withContext=false]
 * @return {string}
 */
Twig.extendFunction('include', (...args) => {
  let [templateName, variables = {}, withContext = false] = args;
  if (typeof withContext !== 'boolean' && variables && typeof variables.with_context !== 'undefined') {
    withContext = variables.with_context;
    delete variables.with_context;
  }

  try {
    const templateFn = twigNamespaceToPath(templateName);
    if (!templateFn) return '';

    const finalContext = withContext && typeof this === 'object'
      ? { ...(this.context || {}), ...variables }
      : variables;

    return templateFn(finalContext);
  } catch (err) {
    console.error(`Twig include() failed for: ${templateName}`, err);
    return '';
  }
});

/**
 * Twig `source()` polyfill.
 * Returns an <img> tag or URL for @assets paths.
 * @param {string} assetPath
 * @return {string}
 */
Twig.extendFunction('source', (assetPath) => {
  if (typeof assetPath !== 'string') return '';

  // Strip Drupal-style alias and extract file extension.
  const relPath   = assetPath.replace(/^@assets\//, '');
  const extension = relPath.split('.').pop().toLowerCase();

  // Inline raw content for textual assets.
  if (INLINE_ASSET_EXTS.has(extension)) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${PUBLIC_ASSET_BASE}${relPath}`, false); // synchronous
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        return xhr.responseText;
      }
      // eslint-disable-next-line no-console
      console.error(`source(): ${xhr.status} while fetching ${relPath}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`source(): failed to fetch ${relPath}`, err);
    }
  }

  // Auto-render raster images.
  if (IMAGE_ASSET_EXTS.has(extension)) {
    return `<img src="${PUBLIC_ASSET_BASE}${relPath}" alt="" role="img">`;
  }

  // Fallback: return public URL.
  return `${PUBLIC_ASSET_BASE}${relPath}`;
});

/**
 * Drupal.t() polyfill for Storybook.
 * Simply returns the input string without translation.
 * @param {string} str - The string to "translate"
 * @return {string}
 */
window.Drupal = window.Drupal || {};
window.Drupal.t = function(str) {
  return str;
};

/**
 * drupalSettings polyfill for Storybook.
 * Provides mock Drupal settings that components can use.
 */
window.drupalSettings = window.drupalSettings || {
  path: {
    baseUrl: '/',
    currentLanguage: 'en',
    isFront: false,
    langcode: 'en',
    pathPrefix: '',
    currentPath: '/',
    currentPathIsAdmin: false
  },
  my_theme_search: {
    langprefix: '',
    swiftype: false,
  },
  my_theme_language: {
    not_translated_langcode: 'es'
  },
  user: {
    uid: 0,
    permissionsHash: 'mock-permissions-hash'
  },
  ajaxPageState: {
    theme: 'my_theme',
    theme_token: 'mock-theme-token'
  },
  ajaxTrustedUrl: {},
  dataLayer: [],
  gtag: {},
  pluralDelimiter: '\u0003'
};

export default {};
