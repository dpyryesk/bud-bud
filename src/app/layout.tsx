import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { TimePeriodProvider } from '@/hooks/use-time-period';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Budget Buddy',
  description: 'Personal finance tracker with flexible tags and budgets',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-full flex-col">
        <TimePeriodProvider>
          <TooltipProvider>
            <Header />
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
            </div>
            <MobileNav />
          </TooltipProvider>
        </TimePeriodProvider>
      </body>
    </html>
  );
}
