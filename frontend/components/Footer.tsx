import Link from 'next/link';

const footerColumns = [
  {
    title: 'Products',
    links: [
      { label: 'Buy crypto', href: '/buy-crypto' },
      { label: 'Markets', href: '/markets/prices' },
      { label: 'Deposit', href: '/deposit-cash' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Order History', href: '/history' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Getting started', href: '/' },
      { label: 'Crypto prices', href: '/markets/prices' },
      { label: 'Crypto calculator', href: '/calculate' },
      { label: 'Iframe form practice', href: '/qa/iframe-practice' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Support center', href: '#' },
      { label: 'FAQ', href: '#' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'About us', href: '#' },
      { label: 'Contact us', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Privacy Notice', href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 group-data-[theme=light]:text-slate-600">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-emerald-400 group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:text-emerald-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-8 sm:flex-row group-data-[theme=light]:border-slate-200">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 transition-colors hover:text-emerald-400 group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:text-emerald-600"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold">CryptoSandbox</span>
          </Link>
          <p className="text-sm text-slate-500 group-data-[theme=light]:text-slate-600">
            © {new Date().getFullYear()} CryptoSandboxQA. Crypto exchange training platform for QA practice.
          </p>
        </div>
      </div>
    </footer>
  );
}
