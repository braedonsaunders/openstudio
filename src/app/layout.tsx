import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenStudio - Ultra-Low Latency Jamming Studio',
  description:
    'Browser-based jamming studio with sub-30ms latency, AI-powered backing tracks, and real-time stem separation. Jam with anyone, anywhere in the world.',
  keywords: [
    'jamming',
    'music',
    'studio',
    'low latency',
    'webrtc',
    'backing tracks',
    'stem separation',
    'ai music',
    'remote collaboration',
  ],
  authors: [{ name: 'OpenStudio' }],
  openGraph: {
    title: 'OpenStudio - Ultra-Low Latency Jamming Studio',
    description:
      'Jam with anyone, anywhere in the world. Sub-30ms latency, AI-powered backing tracks, and real-time stem separation.',
    type: 'website',
    siteName: 'OpenStudio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenStudio - Ultra-Low Latency Jamming Studio',
    description:
      'Jam with anyone, anywhere in the world. Sub-30ms latency, AI-powered backing tracks, and real-time stem separation.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
