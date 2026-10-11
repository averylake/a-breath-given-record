import {curatedMix,CURATION} from './curation-policy.mjs';
export const VERSION = 'gift-of-breath/policy-1';
export const ZERO = '0x' + '0'.repeat(40);
export function wallet(value) {
  if (typeof value !== 'string' || !/^0x[\da-f]{40}$/i.test(value) || value.toLowerCase() === ZERO) throw Error('Enter a nonzero Ethereum wallet address.');
  return value.toLowerCase();
}
export function validateEntry(row) {
  const result = {...row, wallet: wallet(row.wallet)};
  if (!/^0x[\da-f]{64}$/i.test(row.seed) || /^0x0{64}$/i.test(row.seed)) throw Error('Missing permanent entry seed.');
  if (!Number.isSafeInteger(row.joinedAt) || row.joinedAt <= 0) throw Error('Invalid joining time.');
  result.seed = row.seed.toLowerCase();
  return result;
}
export function recipeInputs(row) {
  row = validateEntry(row);
  const {mix,family}=curatedMix(row.seed,row.joinedAt);
  return {version:'breath/recipe-5',curationVersion:CURATION.version,family, wallet:row.wallet, seed:row.seed, joinedAt:row.joinedAt,
    accountCreatedAt:new Date(row.joinedAt*1000).toISOString(), encounterId:row.seed.slice(2,34),
    phaseSeconds:row.joinedAt % 11,
    mix};
}
