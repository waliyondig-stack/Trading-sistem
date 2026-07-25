import { nameSimilarity, normalizeEmail, normalizePhoneId } from '@flowniaga/domain';

describe('normalizePhoneId', () => {
  it.each([
    ['081234567890', '+6281234567890'],
    ['0812-3456-7890', '+6281234567890'],
    ['+62 812 3456 7890', '+6281234567890'],
    ['6281234567890', '+6281234567890'],
    ['8123456789', '+628123456789'],
  ])('menormalisasi %s → %s', (input, expected) => {
    expect(normalizePhoneId(input)).toBe(expected);
  });

  it('menolak nilai yang bukan nomor telepon', () => {
    expect(normalizePhoneId('abc')).toBeNull();
    expect(normalizePhoneId('123')).toBeNull();
    expect(normalizePhoneId('')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('lowercase + trim', () => {
    expect(normalizeEmail('  Budi.Santoso@Contoh.ID ')).toBe('budi.santoso@contoh.id');
  });
  it('menolak format tidak valid', () => {
    expect(normalizeEmail('bukan-email')).toBeNull();
  });
});

describe('nameSimilarity', () => {
  it('nama identik = 1', () => {
    expect(nameSimilarity('Budi Santoso', 'budi santoso')).toBe(1);
  });
  it('nama beda total = 0', () => {
    expect(nameSimilarity('Budi Santoso', 'Rina Marlina')).toBe(0);
  });
});
