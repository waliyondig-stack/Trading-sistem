/**
 * Normalisasi identitas pelanggan.
 *
 * Nilai ternormalisasi dipakai untuk pencocokan duplikat — bukan untuk tampilan.
 */

/**
 * Normalisasi nomor telepon Indonesia ke format E.164 (+62…).
 * Menerima: 08xx, 62xx, +62xx, dengan spasi/tanda hubung/kurung.
 * Mengembalikan null bila bukan nomor yang masuk akal.
 */
export function normalizePhoneId(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  if (!digits) return null;

  let national: string;
  if (digits.startsWith('+62')) {
    national = digits.slice(3);
  } else if (digits.startsWith('62')) {
    national = digits.slice(2);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else if (/^8\d+$/.test(digits)) {
    // Ditulis tanpa prefix (mis. 8123456789)
    national = digits;
  } else {
    return null;
  }

  if (!/^\d+$/.test(national)) return null;
  // Nomor nasional Indonesia: 8-12 digit setelah kode negara.
  if (national.length < 8 || national.length > 12) return null;
  return `+62${national}`;
}

/** Normalisasi email: trim + lowercase. Mengembalikan null bila format tidak valid. */
export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

/**
 * Kemiripan nama sederhana (0..1) berbasis token overlap — deterministik dan
 * dapat dijelaskan; BUKAN dasar merge otomatis.
 */
export function nameSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size);
}
