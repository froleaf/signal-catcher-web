import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "signal-catcher",
  description: "Weekly digest, eval workbench, and entity wiki for signal-catcher.",
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/weekly", label: "Weekly" },
  { href: "/eval", label: "Eval" },
  { href: "/wiki", label: "Wiki" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              signal-catcher
            </Link>
            <ul className="flex gap-6 text-sm">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-zinc-500 dark:text-zinc-500">
          <p>
            Data from{" "}
            <a
              href="https://github.com/froleaf/signal-catcher"
              className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              froleaf/signal-catcher
            </a>
            . SSG via Vercel.
          </p>
        </footer>
      </body>
    </html>
  );
}
