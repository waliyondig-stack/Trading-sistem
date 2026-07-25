import { sanitizeCsvCell, toCsvLine } from './import.service';

describe('sanitizeCsvCell (proteksi formula injection)', () => {
  it.each([['=CMD()'], ['+62'], ['-1+2'], ['@SUM(A1)'], ['\tX']])(
    'menetralisasi sel berbahaya %s',
    (value) => {
      expect(sanitizeCsvCell(value).startsWith("'")).toBe(true);
    },
  );

  it('membiarkan sel normal', () => {
    expect(sanitizeCsvCell('KOPI-GAYO-250')).toBe('KOPI-GAYO-250');
  });
});

describe('toCsvLine', () => {
  it('meng-escape koma dan kutip', () => {
    expect(toCsvLine(['a,b', 'c"d'])).toBe('"a,b","c""d"');
  });
  it('menetralisasi formula dalam baris', () => {
    expect(toCsvLine(['=EVIL()', 'ok'])).toBe("'=EVIL(),ok");
  });
});
