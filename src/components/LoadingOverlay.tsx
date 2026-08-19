"use client";

import { useEffect } from "react";

export function LoadingOverlay({
  visible,
  title,
  progress,
  subtitle,
}: {
  visible: boolean;
  title: string;
  progress?: number;
  subtitle?: string;
}) {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  if (!visible) return null;

  const dotPositions = [
    { top: "0%", left: "50%", delay: "0s" },
    { top: "15%", left: "80%", delay: "0.15s" },
    { top: "45%", left: "92%", delay: "0.3s" },
    { top: "75%", left: "80%", delay: "0.45s" },
    { top: "100%", left: "50%", delay: "0.6s" },
    { top: "75%", left: "20%", delay: "0.75s" },
    { top: "45%", left: "8%", delay: "0.9s" },
    { top: "15%", left: "20%", delay: "1.05s" },
    { top: "45%", left: "50%", delay: "1.2s" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(25,21,18,0.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      {/* 点阵环 */}
      <div style={{ position: "relative", width: 96, height: 96, marginBottom: 32 }}>
        {dotPositions.map((d, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: d.top,
              left: d.left,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#F5EFE0",
              marginTop: -4,
              marginLeft: -4,
              animation: `dotPulse 1.8s ease-in-out infinite`,
              animationDelay: d.delay,
              transform: "scale(0.6)",
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      <h2
        style={{
          fontFamily: "'Noto Serif SC', serif",
          fontSize: 28,
          color: "#F5EFE0",
          textAlign: "center",
          lineHeight: 1.2,
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        {title}
      </h2>

      {subtitle && (
        <p style={{
          color: "rgba(245,239,224,0.6)",
          fontSize: 13,
          fontFamily: "'Roboto Mono', monospace",
          marginBottom: 24,
        }}>
          {subtitle}
        </p>
      )}

      {/* 进度条 */}
      <div style={{
        width: 288,
        height: 4,
        background: "rgba(245,239,224,0.2)",
        borderRadius: 999,
        overflow: "hidden",
        marginBottom: 12,
      }}>
        <div style={{
          height: "100%",
          width: progress !== undefined ? `${progress}%` : "30%",
          background: "#E8633B",
          transition: "width 0.3s ease-out",
          animation: progress === undefined ? "shimmer 1.5s linear infinite" : undefined,
        }} />
      </div>

      {progress !== undefined && (
        <p style={{
          color: "rgba(245,239,224,0.8)",
          fontFamily: "'Roboto Mono', monospace",
          fontSize: 12,
        }}>
          {Math.round(progress)}%
        </p>
      )}

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
