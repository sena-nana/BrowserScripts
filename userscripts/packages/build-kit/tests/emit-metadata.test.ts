import assert from 'node:assert/strict';
import test from 'node:test';
import { emitMetadata } from '../src/emit-metadata.ts';

test('emitMetadata writes exclude-match entries after match entries', () => {
  const metadata = emitMetadata({
    id: 'metadata-test',
    name: 'Metadata Test',
    namespace: 'https://github.com/wangjunxue/BrowserScripts',
    version: '0.1.0',
    description: 'Metadata test.',
    match: ['https://example.com/*'],
    excludeMatch: ['https://example.com/private/*'],
    grant: []
  });

  assert.match(metadata, /@match\s+https:\/\/example\.com\/\*/);
  assert.match(metadata, /@exclude-match\s+https:\/\/example\.com\/private\/\*/);
  assert.equal(metadata.startsWith('// ==UserScript==\n'), true);
});
