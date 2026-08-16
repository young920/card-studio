"use client";

import { useState } from "react";

interface Card { record_id: string; fields: Record<string, any>; }
interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
}

export function TaskCard({ task, index, onOpen }: { task: Task; index: number; onOpen: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const firstCard = task.cards[0];
  const cover = (firstCard?.fields?.原图 as any[]) || [];
  const tags = (task.copy?.fields?.标签 as string[]) || [];
  const updated = (firstCard?.fields?.创建日期 as string) || "";

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    window.location.href = `/api/tasks/${task.task_id}/download`;
  }

  async function handleCopyText(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    const c = task.copy;
    if (!c) return;
    const text = `${c.fields.标题 || task.project_name}\n\n${c.fields.总文案 || c.fields.正文 || ""}\n\n${(c.fields.标签 as string[] || []).join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ 文案已复制到剪贴板");
    } catch {
      alert("复制失败，请检查浏览器权限");
    }
  }

  return (
    <div className="card-tile relative group cursor-pointer" onClick={onOpen}>
      {/* Top row: index + menu */}
      <div className="flex items-start justify-between p-3">
        <div className="w-7 h-7 bg-cream flex items-center justify-center border border-creamDeep">
          <span className="font-mono text-[11px] font-bold">{String(index).padStart(2, "0")}</span>
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="w-7 h-7 flex items-center justify-center hover:bg-creamDeep transition"
          >
            <span className="font-mono text-[14px]">⋯</span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-8 bg-creamLight border border-ink shadow-cardHover z-10 w-36"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={handleCopyText} className="w-full text-left px-3 py-2 text-[13px] hover:bg-creamDeep font-mono">
                ⧉ COPY COPY
              </button>
              <button onClick={handleDownload} className="w-full text-left px-3 py-2 text-[13px] hover:bg-creamDeep font-mono">
                ⤓ DOWNLOAD ZIP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cover preview */}
      <div className="px-3">
        <div className="aspect-[4/5] bg-creamDeep border border-creamDeep overflow-hidden">
          {cover[0] ? (
            <BitableImage fileToken={cover[0].file_token} alt={task.project_name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-inkSoft font-mono text-[11px]">
              NO COVER
            </div>
          )}
        </div>
      </div>

      {/* Bottom: title + meta */}
      <div className="p-3">
        <h3 className="font-serif text-[16px] leading-tight line-clamp-2 min-h-[2.5em]">
          {task.copy?.fields?.标题 || task.project_name}
        </h3>
        <p className="eyebrow mt-2 text-inkSoft">
          {task.cards.length} CARDS · {updated ? new Date(updated).toISOString().slice(0, 10) : "—"}
        </p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] font-mono text-brick">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Open button (hover) */}
      <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-ink text-cream flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
        <span className="text-[14px]">▶</span>
      </div>
    </div>
  );
}

function BitableImage({ fileToken, alt }: { fileToken: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useState(() => {
    fetch(`/api/img/${fileToken}`)
      .then((r) => r.json())
      .then((j) => setUrl(j.url))
      .catch(() => {});
  });
  if (!url) return <div className="w-full h-full bg-creamDeep" />;
  return <img src={url} alt={alt} className="w-full h-full object-cover" />;
}