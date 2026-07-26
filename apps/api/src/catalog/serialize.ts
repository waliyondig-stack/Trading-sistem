import type { ChannelListing, ProductVariant } from '@prisma/client';

/**
 * Serialisasi nilai uang: disimpan sebagai BigInt (integer rupiah),
 * dikirim ke klien sebagai number JSON (aman ≤ 2^53 — jauh di atas
 * kebutuhan nominal rupiah wajar).
 */
export function serializeVariant(v: ProductVariant) {
  return {
    ...v,
    costAmount: Number(v.costAmount),
    sellingPrice: Number(v.sellingPrice),
  };
}

export function serializeListing(l: ChannelListing) {
  return {
    ...l,
    channelPrice: l.channelPrice === null ? null : Number(l.channelPrice),
  };
}
