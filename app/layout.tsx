import type { Metadata } from 'next';
import './globals.css';

// NOTE: next/font/google is intentionally avoided because the build-time
// font fetch fails in offline/sandboxed environments (the Google Fonts CSS
// parser throws). We fall back to Arabic-friendly system font stacks in
// globals.css instead.

export const metadata: Metadata = {
  title: 'سينا ستوديو — محرر الفيديو الاحترافي 4K',
  description:
    'محرر فيديو متكامل يدعم جميع الصيغ مع انتقالات انيميشن احترافية، طبقات ونصوص وأشكال، إزالة الضوضاء الكاملة، تحويل الفيديو إلى صوت MP3 و WAV، والتصدير حتى 4K.',
  openGraph: {
    title: 'سينا ستوديو — محرر الفيديو الاحترافي 4K',
    description:
      'محرر فيديو متكامل يدعم جميع الصيغ مع انتقالات انيميشن احترافية، إزالة الضوضاء، استخراج الصوت، وتصدير 4K.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'سينا ستوديو — محرر الفيديو الاحترافي 4K',
    description:
      'محرر فيديو متكامل يدعم جميع الصيغ مع انتقالات انيميشن احترافية، إزالة الضوضاء، استخراج الصوت، وتصدير 4K.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className="dark"
    >
      <body
        suppressHydrationWarning
        className="bg-[#0A0D12] text-slate-100 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden"
      >
        {children}
      </body>
    </html>
  );
}
