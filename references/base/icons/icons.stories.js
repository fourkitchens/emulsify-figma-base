import { renderTwig } from '@emulsify/core/storybook';
import iconsTemplate from './icons.twig';

// Dynamically import all SVG files in assets/icons root (non-recursive).
// The filenames (minus .svg) are passed as the `icons` context to the listing.
const req = require.context('../../../../assets/icons', false, /\.svg$/);
const iconNames = req.keys().map((file) => file.replace('./', '').replace('.svg', ''));

export default {
  title: 'Base/Icons',
};

// Render through emulsify-core's Twig renderer (NOT a precomputed HTML string).
// Each row's SVG comes from `source('@assets/icons/*.svg')`, a lazy Vite glob
// that is unresolved on first render. renderTwig's TwigStory re-runs the
// template on the `emulsify:twig-source-loaded` event, so source() returns the
// cached SVG. A string story would freeze the empty first render (no SVG).
export const Icons = renderTwig(iconsTemplate, { context: { icons: iconNames } });
