import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "图个明白 · 知识卡片库",
  description: "把知识做成卡片，看图就懂 — 图个明白，你的可视化知识卡片库。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}