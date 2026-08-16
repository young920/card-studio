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
        brick: "#C84B2A",     // 强调色（砖红）
        brickDeep: "#A33A1F",
        terracotta: "#D97847",
        olive: "#7A7A52",     // 辅色
        terminalBg: "#1F1B17", // 深色 Terminal 卡
        terminalFg: "#E8E1D1",
      },
      fontFamily: {
        serif: ["'Tiempos Headline'", "'Editorial New'", "'EB Garamond'", "Georgia", "serif"],
        sans: ["'Inter'", "'SF Pro Text'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'SF Mono'", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["64px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h1: ["44px", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
        h2: ["28px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        eyebrow: ["11px", { lineHeight: "1.4", letterSpacing: "0.18em" }],
      },
      boxShadow: {
        card: "0 1px 0 rgba(26,23,20,0.08), 0 0 0 1px rgba(26,23,20,0.06)",
        cardHover: "0 4px 12px rgba(26,23,20,0.10), 0 0 0 1px rgba(26,23,20,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;