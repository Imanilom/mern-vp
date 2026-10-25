import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin, parseAllowedOrigins } from '../utils/corsOrigins.js';

test('default origins use the Vidyamedic production domains', () => {
  assert.deepEqual(parseAllowedOrigins(''), [
    'https://vidyamedic.my.id',
    'https://www.vidyamedic.my.id',
  ]);
});

test('configured origins are normalized and deduplicated', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://vidyamedic.my.id/ ,https://www.vidyamedic.my.id,https://vidyamedic.my.id'),
    ['https://vidyamedic.my.id', 'https://www.vidyamedic.my.id'],
  );
});

test('configured origins reject paths, wildcards, and non-HTTP schemes', () => {
  for (const value of [
    'https://vidyamedic.my.id/path',
    '*',
    'file://vidyamedic.my.id',
  ]) {
    assert.throws(() => parseAllowedOrigins(value), /ALLOWED_ORIGINS/);
  }
});

test('production origin policy allows configured sites but not arbitrary localhost', () => {
  const origins = parseAllowedOrigins('https://vidyamedic.my.id,https://www.vidyamedic.my.id');
  assert.equal(isAllowedOrigin('https://vidyamedic.my.id', origins), true);
  assert.equal(isAllowedOrigin('https://api.vidyamedic.my.id', origins), false);
  assert.equal(isAllowedOrigin('http://localhost:3032', origins), false);
  assert.equal(isAllowedOrigin(undefined, origins), true);
});

test('development origin policy allows local development servers', () => {
  assert.equal(isAllowedOrigin('http://localhost:3032', [], true), true);
  assert.equal(isAllowedOrigin('https://127.0.0.1:5173', [], true), true);
  assert.equal(isAllowedOrigin('https://example.com', [], true), false);
});
