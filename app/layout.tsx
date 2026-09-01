import type { Metadata } from 'next';
import './globals.css';
import './readability.css';
import { DocumentLanguage } from './document-language';
import { InstantInteractionFeedback } from './instant-interaction-feedback';
import { Suspense } from 'react';


export const metadata: Metadata = {
  metadataBase: new URL('https://dashloom.dev'),
  title: 'Dashloom — Open-source AI product intelligence',
  description: 'Connect product data, explain change with specialized agents, and deliver evidence-linked reports from one open-source platform.',
  alternates: { canonical: '/', languages: { en: '/', zh: '/zh', 'x-default': '/' } },
  applicationName: 'Dashloom',
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }, { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: { title: 'Dashloom — Turn every product signal into your next move.', description: 'Open-source AI product intelligence for indie hackers and small product teams.', url: 'https://dashloom.dev', siteName: 'Dashloom', type: 'website', images: [{ url: '/og-dashloom.png', width: 1200, height: 630, alt: 'Dashloom turns product signals into the next move' }] },
  twitter: { card: 'summary_large_image', title: 'Dashloom', description: 'Turn every product signal into your next move.', images: ['/og-dashloom.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DocumentLanguage /><Suspense fallback={null}><InstantInteractionFeedback /></Suspense>{children}</body></html>;
}
