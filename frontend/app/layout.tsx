import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { RunningBanner } from '@/components/RunningBanner';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { ThemeProvider } from '@/lib/useTheme';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CryptoSandboxQA',
  description: 'Crypto exchange training platform for QA practice',
};

const themeScript = `
  (function() {
    var t = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} group`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <RunningBanner />
          <ImpersonationBanner />
          <Header />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
