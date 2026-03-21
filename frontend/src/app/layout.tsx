import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '啵儿啵儿',
  description: 'Baby activity tracker',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
