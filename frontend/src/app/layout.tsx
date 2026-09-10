import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LedgerAgent | Accounting Assistant',
  description: 'AI-Powered Accounting Operations & Workflow Automation Studio for Chartered Accountants',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/globals.css" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      brand: '#2563eb',
                    }
                  }
                }
              }
            `,
          }}
        />
      </head>
      <body className="bg-[#f8f9fb] text-slate-800 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
