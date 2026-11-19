// Combined profile-selecting interface. B is the default; select M explicitly.
import * as minimal from './minimal.mjs';
import { parseBalanced, validateBalanced, generateBalanced, jsonBalanced } from './balanced.mjs';
export { checkText, YamxError } from './common.mjs';

export function parse(text, profile = 'B') {
  return profile === 'B' ? parseBalanced(text) : minimal.parse(text, profile);
}
export function validate(text, profile = 'B') {
  return profile === 'B' ? validateBalanced(text) : minimal.validate(text, profile);
}
export function generate(value, profile = 'B') {
  return profile === 'B' ? generateBalanced(value) : minimal.generate(value, profile);
}
export function toJSON(text, profile = 'B') {
  return profile === 'B' ? jsonBalanced(text) : minimal.toJSON(text, profile);
}
