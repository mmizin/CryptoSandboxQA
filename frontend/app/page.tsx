import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>CryptoSandboxQA</h1>
      <p style={{ marginBottom: '2rem', color: '#8b949e' }}>
        Crypto exchange training platform for QA practice
      </p>
      <nav style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/login">Login</Link>
        <Link href="/register">Register</Link>
        <Link href="/market">Market</Link>
      </nav>
    </main>
  );
}
