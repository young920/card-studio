"use client";

import { useEffect, useRef, useState } from "react";

interface ImageLightboxProps {
  images: { url: string; card_no: string; topic: string }[];
  startIdx: number;
  onClose: () => void;
}

/**
 * 全屏图片查看器
 * - wheel 缩放 / 双击放大还原
 * - 缩放后可拖拽平移
 * - 缩放 1x 时支持 swipe 左右切图
 * - ESC 关闭
 */
export function ImageLightbox({ images, startIdx, onClose }: ImageLightboxProps) {
  const [idx, setIdx] = useState(startIdx);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0); // translate x (px)
  const [ty, setTy] = useState(0); // translate y (px)

  // drag state
  const dragRef = useRef<{
    mode: "pan" | "swipe" | null;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    pointerId: number | null;
  }>({ mode: null, startX: 0, startY: 0, startTx: 0, startTy: 0, pointerId: null });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<number>(0);

  const current = images[idx];

  // 重置 transform 当切图
  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, [idx]);

  // 锁 body 滚动 + 监听键盘
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // 缩放模式下禁用方向键切图，避免误触
      if (scale > 1.05) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, images.length - 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, images.length, scale]);

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  function clampPan(s: number, dx: number, dy: number) {
    const wrap = imgWrapRef.current;
    if (!wrap) return { x: dx, y: dy };
    const rect = wrap.getBoundingClientRect();
    const scaledW = rect.width * s;
    const scaledH = rect.height * s;
    const maxX = Math.max(0, (scaledW - rect.width) / 2);
    const maxY = Math.max(0, (scaledH - rect.height) / 2);
    return {
      x: clamp(dx, -maxX, maxX),
      y: clamp(dy, -maxY, maxY),
    };
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((s) => {
      const next = clamp(s + delta, 1, 6);
      if (next <= 1) {
        setTx(0);
        setTy(0);
      } else {
        const c = clampPan(next, tx, ty);
        setTx(c.x);
        setTy(c.y);
      }
      return next;
    });
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (scale > 1.05) {
      setScale(1);
      setTx(0);
      setTy(0);
    } else {
      setScale(2.5);
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    // 只对图片本身响应拖拽；空白区留给关闭
    if ((e.target as HTMLElement).tagName !== "IMG") return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // 双击
      lastTapRef.current = 0;
      handleDoubleClick(e as any);
      return;
    }
    lastTapRef.current = now;

    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode: scale > 1.05 ? "pan" : "swipe",
      startX: e.clientX,
      startY: e.clientY,
      startTx: tx,
      startTy: ty,
      pointerId: e.pointerId,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d.mode) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.mode === "pan") {
      const c = clampPan(scale, d.startTx + dx, d.startTy + dy);
      setTx(c.x);
      setTy(c.y);
    }
    // swipe 模式: 不在 move 里切，等 pointerup 看位移
  }

  function handlePointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d.mode) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (d.mode === "swipe") {
      // 横向滑动距离 > 50px 且大于纵向 → 切图
      if (absX > 50 && absX > absY) {
        if (dx < 0) {
          setIdx((i) => Math.min(i + 1, images.length - 1));
        } else {
          setIdx((i) => Math.max(i - 1, 0));
        }
      }
    }
    dragRef.current = {
      mode: null,
      startX: 0,
      startY: 0,
      startTx: 0,
      startTy: 0,
      pointerId: null,
    };
  }

  function handleBackdropClick(e: React.MouseEvent) {
    // 点空白处关闭；点图片不关
    if ((e.target as HTMLElement).tagName === "IMG") return;
    onClose();
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-ink/95 flex flex-col"
      onClick={handleBackdropClick}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-ink text-cream font-mono text-[12px]">
        <div className="flex items-center gap-3">
          <span className="opacity-70">{current.card_no}</span>
          <span className="opacity-50">·</span>
          <span className="opacity-70 truncate max-w-[40vw]">{current.topic}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="opacity-70">
            {idx + 1} / {images.length}
          </span>
          <span className="opacity-50">·</span>
          <span className="opacity-70">缩放 {Math.round(scale * 100)}%</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScale((s) => {
                const next = s > 1.05 ? 1 : 2.5;
                if (next === 1) {
                  setTx(0);
                  setTy(0);
                }
                return next;
              });
            }}
            className="px-2 py-1 border border-cream/40 hover:bg-cream/10 transition"
            title="切换缩放"
          >
            {scale > 1.05 ? "⊙ 还原" : "⊕ 放大"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-2 py-1 border border-cream/40 hover:bg-brick transition"
            title="关闭 (ESC)"
          >
            ✕ ESC
          </button>
        </div>
      </div>

      {/* image area */}
      <div
        ref={imgWrapRef}
        className="flex-1 flex items-center justify-center overflow-hidden select-none touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          key={current.url}
          src={current.url}
          alt={current.topic}
          draggable={false}
          onDoubleClick={handleDoubleClick}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: dragRef.current.mode ? "none" : "transform 0.18s ease-out",
            cursor: scale > 1.05 ? "grab" : "zoom-in",
          }}
        />
      </div>

      {/* bottom hint */}
      <div className="px-6 py-3 bg-ink text-cream/70 font-mono text-[11px] flex items-center justify-center gap-6">
        <span>🖱 滚轮缩放</span>
        <span>·</span>
        <span>👆 双击放大/还原</span>
        <span>·</span>
        <span>✋ 拖拽平移（放大时）</span>
        <span>·</span>
        <span>👈👉 左右滑动切图（1× 时）</span>
        <span>·</span>
        <span>⌨ ← → 切图 · ESC 退出</span>
      </div>
    </div>
  );
}