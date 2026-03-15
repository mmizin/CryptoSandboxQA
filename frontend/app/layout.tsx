import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CryptoSandboxQA',
  description: 'Crypto exchange training platform for QA practice',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
