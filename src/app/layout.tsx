import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Atelier",
  description: "整理过的知识，都在这一张张图里 — Card Atelier 信息图卡片库。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}