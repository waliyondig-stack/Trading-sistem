import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'FlowNiaga';

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: 'Sistem Operasi Bisnis Omnichannel untuk usaha Indonesia',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
