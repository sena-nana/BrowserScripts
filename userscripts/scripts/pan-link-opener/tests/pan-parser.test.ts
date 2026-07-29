import assert from 'node:assert/strict';
import test from 'node:test';
import { appendExtractionCode, findPanLinks, parseExtractionCode } from '../src/pan-parser.ts';

test('findPanLinks extracts supported cloud-drive links and codes', () => {
  const matches = findPanLinks('链接 https://pan.baidu.com/s/1abcde 提取码: 9x8y');

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.provider, 'baidu');
  assert.equal(matches[0]?.code, '9x8y');
  assert.equal(appendExtractionCode(matches[0]!), 'https://pan.baidu.com/s/1abcde?pwd=9x8y#9x8y');
});

test('parseExtractionCode ignores unrelated text', () => {
  assert.equal(parseExtractionCode('no password here'), undefined);
});

test('findPanLinks supports additional reference providers', () => {
  const matches = findPanLinks(
    'https://flowus.cn/abc/share/123e4567-e89b-12d3-a456-426614174000 https://addons.mozilla.org/firefox/addon/test/'
  );

  assert.deepEqual(
    matches.map((match) => match.provider),
    ['flowus', 'firefox-addons']
  );
});
