export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Fase saat fitur tersedia; halaman sebelum itu berupa empty state. */
  phase?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Ringkasan', icon: '📊' },
  { href: '/pesanan', label: 'Pesanan', icon: '🧾', phase: 'Fase 3' },
  { href: '/produk', label: 'Produk', icon: '📦', phase: 'Fase 2' },
  { href: '/stok', label: 'Stok', icon: '🏷️', phase: 'Fase 3' },
  { href: '/pelanggan', label: 'Pelanggan', icon: '👥', phase: 'Fase 2' },
  { href: '/pembayaran', label: 'Pembayaran', icon: '💳', phase: 'Fase 4' },
  { href: '/integrasi', label: 'Integrasi', icon: '🔌', phase: 'Fase 5' },
  { href: '/ai-assistant', label: 'AI Assistant', icon: '🤖', phase: 'Fase 6' },
  { href: '/aktivitas', label: 'Aktivitas', icon: '📝' },
  { href: '/pengaturan', label: 'Pengaturan', icon: '⚙️' },
];
