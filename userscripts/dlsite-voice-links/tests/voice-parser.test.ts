import assert from 'node:assert/strict';
import test from 'node:test';
import { findWorkCodes, toDlsiteUrl } from '../src/voice-parser.ts';

test('findWorkCodes deduplicates RJ and VJ work codes', () => {
  const codes = findWorkCodes('RJ01234567 RJ01234567 VJ123456');

  assert.deepEqual(
    codes.map((item) => item.code),
    ['RJ01234567', 'VJ123456']
  );
  assert.equal(codes[0]?.asmrUrl, 'https://asmr.one/work/RJ01234567');
});

test('toDlsiteUrl creates a DLsite product URL', () => {
  assert.equal(
    toDlsiteUrl('rj01234567'),
    'https://www.dlsite.com/maniax/work/=/product_id/RJ01234567.html'
  );
});
