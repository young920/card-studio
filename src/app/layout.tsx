import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Atelier",
  description: "A back-of-house studio for your info-graphic cards and 小红书 copy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}