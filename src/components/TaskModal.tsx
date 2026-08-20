"use client";

import { useEffect, useRef, useState } from "react";

interface CardInfo {
  record_id: string;
  card_no: string;
  topic: string;
  mode: string;
  status: string;
  url: string;
  cover_url: string;
  is_video: boolean;
  created: string;
}

interface CopyInfo {
  record_id: string;
  fields: Record<string, any>;
}

export function TaskModal({
  taskId,
  projectName,
  copyRecordId,
  onClose,
  onChanged,
}: {
  taskId: number;
  projectName: string;
  copyRecordId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cards, setCards] = useState<CardInfo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copyTitle, setCopyTitle] = useState("");
  const [copyText, setCopyText] = useState("");
  const [copyTags, setCopyTags] = useState("");
  const [copyMode, setCopyMode] = useState<"idle" | "copied">("idle");

  // edit state
  const [editMode, setEditMode] = useState<"view" | "edit-title" | "edit-copy">("view");
  const [editName, setEditName] = useState(projectName);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // upload state
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [settingCover, setSettingCover] = useState(false);

  useEffect(() => {
    refreshAll();
  }, [taskId]);

  async function refreshAll() {
    try {
      setErr(null);
      const r = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setCards(j.cards);
    } catch (e: any) {
      setErr(e.message);
    }
    // 拉文案
    const r2 = await fetch("/api/tasks", { cache: "no-store" });
    const j2 = await r2.json();
    const t = (j2.tasks || []).find((x: any) => x.task_id === taskId);
    if (t?.copy) {
      setCopyTitle(t.copy.fields.标题 || "");
      setCopyText(t.copy.fields.总文案 || t.copy.fields.正文 || "");
      setCopyTags(((t.copy.fields.标签 as string[]) || []).join(" "));
      setEditTitle(t.copy.fields.标题 || "");
      setEditBody(t.copy.fields.总文案 || t.copy.fields.正文 || "");
      setEditTags(((t.copy.fields.标签 as string[]) || []).join(" "));
    } else {
      setCopyTitle("");
      setCopyText("");
      setCopyTags("");
      setEditTitle("");
      setEditBody("");
      setEditTags("");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editMode !== "view") return;
      if (e.key === "Escape") onClose();
      if (cards && e.key === "ArrowRight") setActiveIdx((i) => Math.min(i + 1, cards.length - 1));
      if (cards && e.key === "ArrowLeft") setActiveIdx((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards, onClose, editMode]);

  async function handleCopy() {
    const fullText = `${copyTitle}\n\n${copyText}\n\n${copyTags}`.trim();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyMode("copied");
      setTimeout(() => setCopyMode("idle"), 2000);
    } catch {}
  }

  function handleDownload() {
    window.location.href = `/api/tasks/${taskId}/zip`;
  }

  async function handleSaveTitle() {
    setSaving(true);
    setSaveErr(null);
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: editName.trim() }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setEditMode("view");
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
      onChanged();
      // 刷新本页面数据
      refreshAll();
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCopy() {
    setSaving(true);
    setSaveErr(null);
    try {
      let recordId = copyRecordId;
      // 没有文案记录就新建一条
      if (!recordId) {
        const r = await fetch("/api/copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            标题: editTitle.trim(),
            总文案: editBody,
            正文: editBody,
            标签: editTags.trim().split(/\s+/).filter(Boolean),
            项目名: editName.trim() || projectName,
          }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error);
        recordId = j.record_id;
      } else {
        const r = await fetch(`/api/copy/${recordId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              标题: editTitle.trim(),
              总文案: editBody,
              正文: editBody,
              标签: editTags.trim().split(/\s+/).filter(Boolean),
            },
          }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error);
      }
      setCopyTitle(editTitle.trim());
      setCopyText(editBody);
      setCopyTags(editTags.trim());
      setEditMode("view");
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
      onChanged();
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    setSettingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("parent_type", "bitable_image");
      fd.append("file_name", `${active.card_no}-cover.jpg`);

      const up = await fetch("/api/upload/proxy", { method: "POST", body: fd });
      const upJ = await up.json();
      if (!upJ.ok) throw new Error(upJ.error);

      const r = await fetch(`/api/cards/${active.record_id}/cover`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_token: upJ.file_token }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);

      await refreshAll();
    } catch (e: any) {
      alert("上传封面失败：" + e.message);
    } finally {
      setSettingCover(false);
      e.target.value = "";
    }
  }

  async function handleSetCoverFromVideo() {
    const video = videoRef.current;
    if (!video || !active) return;
    setSettingCover(true);
    try {
      const canvas = document.createElement("canvas");
      const w = video.videoWidth;
      const h = video.videoHeight;
      const scale = Math.min(1, 720 / w);
      canvas.width = Math.floor(w * scale);
      canvas.height = Math.floor(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 不可用");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      // 转 file 上传
      const bin = atob(dataUrl.split(",")[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], `${active.card_no}-cover.jpg`, { type: "image/jpeg" });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("parent_type", "bitable_image");
      fd.append("file_name", `${active.card_no}-cover.jpg`);

      // 流式代理上传拿 file_token
      const up = await fetch("/api/upload/proxy", { method: "POST", body: fd });
      const upJ = await up.json();
      if (!upJ.ok) throw new Error(upJ.error);

      // 写回卡片的缩略图字段
      const r = await fetch(`/api/cards/${active.record_id}/cover`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_token: upJ.file_token }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);

      await refreshAll();
    } catch (e: any) {
      alert("设置封面失败：" + e.message);
    } finally {
      setSettingCover(false);
    }
  }

  async function handleDeleteCard(recordId: string) {
    if (!confirm("删除这一张卡？飞书记录 + 附件会被删除。")) return;
    try {
      const r = await fetch(`/api/cards/${recordId}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      await refreshAll();
      onChanged();
      setActiveIdx((i) => Math.max(0, i - 1));
    } catch (e: any) {
      alert("删除失败：" + e.message);
    }
  }

  async function handleDeleteTask() {
    if (!confirm(`确认删除整个 task NO.${String(taskId).padStart(3, "0")}？\n所有卡 + 文案 + 附件会从飞书删除（不可恢复）。`)) return;
    try {
      const r = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      onChanged();
      onClose();
    } catch (e: any) {
      alert("删除失败：" + e.message);
    }
  }

  async function handleUploadNewCard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append("task_id", String(taskId));
      const nextNo = cards && cards.length > 0
        ? "card-" + String(parseInt(cards[cards.length - 1].card_no.replace("card-", "")) + 1).padStart(2, "0")
        : "card-00";
      fd.append("card_no", nextNo);
      fd.append("project_name", projectName);
      fd.append("file", file);
      const r = await fetch("/api/cards", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      await refreshAll();
      onChanged();
    } catch (e: any) {
      setUploadErr(e.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // --- drag-and-drop handlers ---
  function handleCardDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }

  function handleCardDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== overIdx) setOverIdx(idx);
  }

  function handleCardDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  async function handleCardDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) {
      handleCardDragEnd();
      return;
    }
    // 本地先更新
    const reordered = [...cards!];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    // 重新编号 card_no
    const renumbered = reordered.map((c, i) => ({
      ...c,
      card_no: "card-" + String(i).padStart(2, "0"),
    }));
    setCards(renumbered);
    handleCardDragEnd();
    // 同步到飞书（重新排序后更新每张的卡号）
    try {
      const res = await fetch(`/api/tasks/${taskId}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: renumbered.map((c) => c.record_id) }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      onChanged();
    } catch (err: any) {
      console.error("reorder failed", err);
      setErr("排序保存失败：" + err.message);
    }
  }

  const active = cards?.[activeIdx];

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-cream w-full max-w-[1280px] max-h-[90vh] overflow-hidden border-2 border-ink flex flex-col md:flex-row shadow-cardHover"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT: image carousel */}
        <div className="md:w-[58%] bg-terminalBg relative flex items-center justify-center p-8">
          {err && <p className="text-brick font-mono text-[13px]">⚠ {err}</p>}
          {!cards && !err && <p className="text-terminalFg font-mono text-[13px]">loading cards…</p>}
          {active && (
            <div className="w-full">
              {active.is_video ? (
                <>
                  <video
                    ref={videoRef}
                    src={active.url}
                    controls
                    playsInline
                    className="w-full max-h-[70vh] object-contain"
                    poster={active.cover_url || undefined}
                  />
                  <div className="absolute bottom-12 right-4 flex gap-2">
                    <label className="px-3 py-1.5 bg-cream/90 text-ink text-[11px] font-mono rounded hover:bg-brick hover:text-cream transition cursor-pointer">
                      ⬆ 上传封面
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleUploadCover}
                        className="hidden"
                        disabled={settingCover}
                      />
                    </label>
                    <button
                      className="px-3 py-1.5 bg-cream/90 text-ink text-[11px] font-mono rounded hover:bg-brick hover:text-cream transition"
                      onClick={handleSetCoverFromVideo}
                      disabled={settingCover}
                    >
                      {settingCover ? "设置中…" : "⎙ 当前帧设封面"}
                    </button>
                  </div>
                </>
              ) : (
                <img
                  src={active.url}
                  alt={active.topic}
                  className="w-full max-h-[70vh] object-contain"
                />
              )}
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-cream text-ink flex items-center justify-center hover:bg-brick hover:text-cream transition"
                onClick={() => setActiveIdx((i) => Math.max(i - 1, 0))}
                disabled={activeIdx === 0}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-cream text-ink flex items-center justify-center hover:bg-brick hover:text-cream transition"
                onClick={() => setActiveIdx((i) => Math.min(i + 1, (cards?.length || 1) - 1))}
                disabled={activeIdx === (cards?.length || 1) - 1}
              >
                ›
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {cards?.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`w-2 h-2 rounded-full transition ${
                      i === activeIdx ? "bg-brick" : "bg-cream/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: text + actions */}
        <div className="md:w-[42%] p-8 overflow-y-auto">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {savedAt && (
                <div className="mb-2 px-3 py-1.5 bg-ink text-cream text-[11px] font-mono inline-block">
                  ✓ 已保存 · {new Date(savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              )}
              {saveErr && (
                <div className="mb-2 px-3 py-1.5 bg-brick text-cream text-[11px] font-mono">
                  ⚠ {saveErr}
                </div>
              )}
              <p className="eyebrow text-brick">NO.{String(taskId).padStart(3, "0")} · TASK</p>
              {editMode === "edit-title" ? (
                <div className="mt-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="font-serif text-[22px] leading-tight w-full bg-creamLight border border-ink px-2 py-1"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleSaveTitle} disabled={saving} className="btn-primary text-[12px] py-1.5 px-3">
                      {saving ? "保存中…" : "保存"}
                    </button>
                    <button onClick={() => { setEditMode("view"); setEditName(projectName); }} className="btn-ghost text-[12px] py-1.5 px-3">
                      取消
                    </button>
                    {saveErr && <span className="text-brick font-mono text-[12px]">⚠ {saveErr}</span>}
                  </div>
                </div>
              ) : (
                // 显示项目名（不是 copy 的标题）
                <h2 className="font-serif text-[28px] leading-tight mt-2">{projectName || `Task ${taskId}`}</h2>
              )}
            </div>
            <button onClick={onClose} className="w-9 h-9 hover:bg-creamDeep transition flex items-center justify-center">
              <span className="font-mono text-[18px]">✕</span>
            </button>
          </div>

          {editMode === "edit-copy" ? (
            <div className="mb-6">
              <p className="eyebrow mb-2">EDIT COPY</p>
              <div>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="标题"
                  className="w-full bg-creamLight border border-ink px-3 py-2 mb-2 font-serif text-[16px]"
                />
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="总文案（长文不分页）"
                  rows={12}
                  className="w-full bg-creamLight border border-ink px-3 py-2 font-mono text-[12px] leading-relaxed"
                />
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="标签（空格分隔）"
                  className="w-full bg-creamLight border border-ink px-3 py-2 mt-2 font-mono text-[12px]"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleSaveCopy} disabled={saving} className="btn-primary text-[12px] py-1.5 px-3">
                  {saving ? "保存中…" : "保存"}
                </button>
                <button onClick={() => { setEditMode("view"); setEditTitle(copyTitle); setEditBody(copyText); setEditTags(copyTags); }} className="btn-ghost text-[12px] py-1.5 px-3">
                  取消
                </button>
                {saveErr && <span className="text-brick font-mono text-[12px]">⚠ {saveErr}</span>}
              </div>
            </div>
          ) : (
            <>
              {copyTags && (
                <div className="mb-6">
                  <p className="eyebrow mb-2">TAGS</p>
                  <div className="flex flex-wrap gap-2">
                    {copyTags.split(" ").filter(Boolean).map((t) => (
                      <span key={t} className="px-2 py-1 bg-creamLight border border-creamDeep text-[12px] font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <p className="eyebrow mb-2">COPY</p>
                <p className="text-[14px] leading-[1.65] whitespace-pre-wrap text-ink">
                  {copyText || "（暂无文案 · 点 ✎ EDIT COPY 加）"}
                </p>
              </div>
            </>
          )}

          {/* Card list */}
          <div className="mb-6 border-t border-creamDeep pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">CARDS · {cards?.length ?? 0} 张</p>
              <label className="btn-ghost text-[11px] py-1 px-2 cursor-pointer">
                {uploading ? "上传中…" : "+ ADD CARD"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                  onChange={handleUploadNewCard}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
            {uploadErr && <p className="text-brick font-mono text-[11px] mb-2">⚠ {uploadErr}</p>}
            <div className="flex gap-2 overflow-x-auto scroll-hide pb-2">
              {cards?.map((c, i) => {
                const isDragging = dragIdx === i;
                const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
                return (
                  <div key={c.record_id} className="relative group/thumb">
                    <button
                      onClick={() => setActiveIdx(i)}
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, i)}
                      onDragOver={(e) => handleCardDragOver(e, i)}
                      onDragEnd={handleCardDragEnd}
                      onDrop={(e) => handleCardDrop(e, i)}
                      className={`flex-shrink-0 w-14 h-14 border-2 transition cursor-grab
                        ${isDragging
                          ? "opacity-40 border-dashed border-ink"
                          : isOver
                            ? "border-brick bg-brick/10"
                            : i === activeIdx
                              ? "border-brick"
                              : "border-creamDeep hover:border-ink"
                        }
                      `}
                    >
                      {c.is_video ? (
                        c.cover_url ? (
                          <img src={c.cover_url} alt={c.card_no} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-creamDeep text-inkSoft text-[10px]">▶</div>
                        )
                      ) : (
                        <img src={c.url} alt={c.card_no} className="w-full h-full object-cover" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteCard(c.record_id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-brick text-cream text-[10px] rounded-full opacity-0 group-hover/thumb:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            {active && (
              <p className="text-[12px] text-inkSoft mt-2 italic">{active.card_no} · {active.topic}</p>
            )}
            <p className="text-[10px] text-inkSoft mt-1 font-mono">💡 拖拽缩略图可调整顺序</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 sticky bottom-0 bg-cream pt-4 border-t border-creamDeep">
            <button onClick={handleCopy} disabled={editMode !== "view"} className="btn-primary flex-1">
              {copyMode === "copied" ? "✓ 已复制" : "⧉ 复制文案"}
            </button>
            <button onClick={handleDownload} disabled={editMode !== "view"} className="btn-ghost flex-1">
              ⤓ 下载 ZIP
            </button>
            {editMode === "view" ? (
              <>
                <button onClick={() => setEditMode("edit-title")} className="btn-ghost" title="改项目名">
                  ✎ NAME
                </button>
                <button onClick={() => setEditMode("edit-copy")} className="btn-ghost" title="改文案">
                  ✎ COPY
                </button>
                <button onClick={handleDeleteTask} className="btn-ghost text-brick border-brick hover:bg-brick hover:text-cream">
                  🗑 TASK
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
