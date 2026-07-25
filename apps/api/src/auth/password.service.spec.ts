import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('menghasilkan hash yang dapat diverifikasi', async () => {
    const hash = await service.hash('RahasiaKuat123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await service.verify('RahasiaKuat123', hash)).toBe(true);
  });

  it('menolak kata sandi yang salah', async () => {
    const hash = await service.hash('RahasiaKuat123');
    expect(await service.verify('salah-total', hash)).toBe(false);
  });

  it('menghasilkan hash berbeda untuk kata sandi sama (salt acak)', async () => {
    const h1 = await service.hash('SamaSaja123');
    const h2 = await service.hash('SamaSaja123');
    expect(h1).not.toEqual(h2);
  });

  it('menolak format hash yang rusak', async () => {
    expect(await service.verify('apa saja', 'bukan-format-valid')).toBe(false);
  });
});
