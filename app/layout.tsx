import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { DocumentLanguage } from './document-language';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://dashloom.dev'),
  title: 'Dashloom — Open-source multi-product analytics dashboard',
  description: 'Monitor Cloudflare, Google Analytics, Search Console, and business metrics across every product from one open-source dashboard.',
  alternates: { canonical: '/', languages: { en: '/', zh: '/zh', 'x-default': '/' } },
  openGraph: { title: 'Dashloom — Every product signal, in one view.', description: 'A Cloudflare-native command center for indie hackers and small product teams.', url: 'https://dashloom.dev', siteName: 'Dashloom', type: 'website', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Dashloom product analytics dashboard' }] },
  twitter: { card: 'summary_large_image', title: 'Dashloom', description: 'Every product signal, in one view.', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}><DocumentLanguage />{children}</body></html>;
}
