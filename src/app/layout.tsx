/**
 * グローバルレイアウト
 * サイト共通のヘッダーとフォント設定を提供する
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Claude ブログ 日本語解説",
  description: "Anthropic 公式ブログの翻訳・解説サイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        {/* グローバルヘッダー */}
        <header className="bg-[#0f3460] text-white shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <a href="/" className="inline-block">
              <h1 className="text-lg font-bold tracking-tight">
                Claude ブログ 日本語解説
              </h1>
              <p className="text-xs text-blue-200 mt-0.5">
                Anthropic 公式ブログの翻訳・解説サイト
              </p>
            </a>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
