"use client";

import { useState } from "react";

type Card = { record_id: string; fields: Record<string, any> };

interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
}

interface TaskCardProps {
  task: Task;
  onOpen: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onCopyText?: () => void;
}

export function TaskCard({ task, onOpen, onDelete, onDownload, onCopyText }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const firstCard = task.cards[0];
  const original = (firstCard?.fields?.原图 as any[]) || [];
  const thumb = (firstCard?.fields?.缩略图 as any[]) || [];
  const orig0 = original[0];
  const isVideo = !!(orig0 && (
    (orig0.type && String(orig0.type).startsWith("video/")) ||
    orig0.type === "bitable_file" ||
    /\.(mp4|mov|webm|m4v|avi)$/i.test(orig0.filename || "")
  ));
  // 视频优先用缩略图当封面；图片优先用原图
  const cover = isVideo
    ? (thumb.length > 0 ? thumb : original)
    : (original.length > 0 ? original : thumb);
  const tags = (task.copy?.fields?.标签 as string[]) || [];
  const updated = (firstCard?.fields?.创建日期 as string) || "";

  function handleCopyText(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    onCopyText?.();
  }
  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    onDownload?.();
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    if (confirm(`删除「${task.project_name}」及其所有卡片？`)) {
      onDelete?.();
    }
  }

  return (
    <div
      className="bg-creamLight border-2 border-ink cursor-pointer transition-all duration-200 group hover:-translate-y-1 hover:shadow-offset-lg"
      onClick={onOpen}
    >
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-ink bg-ink/5">
        <span className="font-mono text-[10px] font-bold tracking-wider text-ink">
          NO.{String(task.task_id).padStart(3, "0")}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="w-6 h-6 flex items-center justify-center hover:bg-creamDeep transition"
        >
          <span className="font-mono text-[14px]">⋯</span>
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-8 bg-creamLight border-2 border-ink shadow-offset z-10 w-36"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={handleCopyText} className="w-full text-left px-3 py-2 text-[12px] hover:bg-creamDeep font-mono border-b border-ink/10">
              ⧉ COPY COPY
            </button>
            <button onClick={handleDownload} className="w-full text-left px-3 py-2 text-[12px] hover:bg-creamDeep font-mono border-b border-ink/10">
              ⤓ DOWNLOAD ZIP
            </button>
            {onDelete && (
              <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-[12px] hover:bg-brick hover:text-cream font-mono text-brickDeep">
                ✕ DELETE
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cover preview */}
      <div className="relative">
        <div className="aspect-[4/5] bg-creamDeep overflow-hidden">
          {cover[0] ? (
            <img
              src={`/api/img/${cover[0].file_token}`}
              alt={task.project_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-inkSoft font-mono text-[11px]">
              NO COVER
            </div>
          )}
        </div>
        {isVideo && (
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-ink/80 text-cream flex items-center justify-center border-2 border-cream">
            <span className="text-[11px] ml-0.5">▶</span>
          </div>
        )}
        {/* 标签小块 */}
        {tags.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="bg-brick text-cream text-[9px] font-mono px-1.5 py-0.5 font-bold">
                {tag.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: title + meta */}
      <div className="p-3 border-t-2 border-ink">
        <h3 className="font-display text-[15px] font-bold leading-tight line-clamp-2 min-h-[2.5em]">
          {task.copy?.fields?.标题 || task.project_name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-[10px] text-inkSoft">
            {task.cards.length} CARDS
          </span>
          <span className="font-mono text-[10px] text-inkSoft">
            {updated ? new Date(updated).toISOString().slice(2, 10).replace(/-/g, ".") : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
