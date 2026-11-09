// Combined profile-selecting interface. M remains the default.
import * as minimal from './minimal.mjs';
import { parseBalanced, validateBalanced, generateBalanced } from './balanced.mjs';
export { checkText, YamxError } from './common.mjs';

export function parse(text, profile = 'M') {
  return profile === 'B' ? parseBalanced(text) : minimal.parse(text, profile);
}
export function validate(text, profile = 'M') {
  return profile === 'B' ? validateBalanced(text) : minimal.validate(text, profile);
}
export function generate(value, profile = 'M') {
  return profile === 'B' ? generateBalanced(value) : minimal.generate(value, profile);
}
