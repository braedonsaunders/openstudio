import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/auth/AuthProvider';
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
  themeColor: '#0a0a0f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
