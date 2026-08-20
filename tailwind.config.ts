import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // UISFX-inspired warm cream + ink palette
        cream: "#F2EDE0",     // 主背景
        creamLight: "#F8F4EA",
        creamDeep: "#E8E1D1", // 边框/分隔
        ink: "#1A1714",       // 主文字（近黑暖墨）
        inkSoft: "#5A544C",   // 次文字
        brick: "#E84D27",     // 强调色（橘红，更接近 uisfx 的亮红）
        brickDeep: "#C83A1A",
        terracotta: "#D97847",
        olive: "#7A7A52",
        terminalBg: "#1F1B17",
        terminalFg: "#E8E1D1",
      },
      fontFamily: {
        serif: ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
        sans: ["'Inter'", "'SF Pro Text'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'SF Mono'", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["88px", { lineHeight: "0.92", letterSpacing: "-0.03em" }],
        "display-sm": ["64px", { lineHeight: "0.95", letterSpacing: "-0.025em" }],
        h1: ["44px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h2: ["28px", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        eyebrow: ["11px", { lineHeight: "1.4", letterSpacing: "0.18em" }],
      },
      boxShadow: {
        // UISFX 风格的右下 offset 硬边阴影
        "offset-sm": "2px 2px 0 0 #1A1714",
        offset: "4px 4px 0 0 #1A1714",
        "offset-lg": "6px 6px 0 0 #1A1714",
        "offset-brick": "4px 4px 0 0 #E84D27",
        "offset-brick-lg": "6px 6px 0 0 #E84D27",
        card: "0 1px 0 rgba(26,23,20,0.08), 0 0 0 1px rgba(26,23,20,0.06)",
        cardHover: "0 4px 12px rgba(26,23,20,0.10), 0 0 0 1px rgba(26,23,20,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
