"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TaskModal } from "@/components/TaskModal";
import { TaskGrid } from "@/components/TaskGrid";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { uploadToFeishu, extractVideoCover, dataUrlToFile } from "@/lib/upload";

interface Card { record_id: string; fields: Record<string, any>; }
interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
}

const STYLE_OPTIONS = ["Editorial Weekly", "Editorial Magazine", "Swiss", "Neo-Brutalist", "Newspaper", "Dialogue", "Paper Brief"];

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errKind, setErrKind] = useState<"network" | "auth" | "other" | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "cards">("newest");

  // 新建任务弹层
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createStyle, setCreateStyle] = useState(STYLE_OPTIONS[0]);
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [createFileCovers, setCreateFileCovers] = useState<(string | null)[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSubtitle, setUploadSubtitle] = useState("");

  // 使用指南弹层
  const [showGuide, setShowGuide] = useState(false);

  // 飞书表格密码验证弹层
  const [showBitablePassword, setShowBitablePassword] = useState(false);
  const [bitablePwd, setBitablePwd] = useState("");
  const [bitablePwdErr, setBitablePwdErr] = useState(false);

  async function refresh() {
    try {
      setErr(null);
      setErrKind(null);
      const r = await fetch("/api/tasks", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) {
        const msg = j.error || "未知错误";
        const kind = msg.includes("user_access_token") || msg.includes("credentials") || msg.includes("scope") ? "auth" : "network";
        setErrKind(kind);
        throw new Error(msg);
      }
      setTasks(j.tasks);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetCreateForm() {
    setCreateName("");
    setCreateStyle(STYLE_OPTIONS[0]);
    setCreateTitle("");
    setCreateBody("");
    setCreateTags("");
    setCreateFiles([]);
    setCreateFileCovers([]);
    setUploadProgress(0);
    setUploadSubtitle("");
    setCreateErr(null);
  }

  async function handleCreate() {
    if (!createName.trim()) {
      setCreateErr("项目名不能为空");
      return;
    }
    setCreating(true);
    setCreateErr(null);
    setUploading(true);
    setUploadProgress(0);
    setUploadSubtitle("创建任务中…");
    try {
      // 1. 先创建任务（在信息图库占 card-00 + 文案库建记录）
      const r = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: createName.trim(),
          style_mode: createStyle,
          title: createTitle.trim(),
          body: createBody,
          tags: createTags.trim().split(/\s+/).filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);

      const taskId = j.task_id;
      const card00RecordId = j.card00_record_id;

      // 2. 直传所有文件到飞书，拿 file_tokens
      const fileTokens: string[] = [];
      const coverTokens: (string | null)[] = [];

      if (createFiles.length > 0) {
        for (let i = 0; i < createFiles.length; i++) {
          const file = createFiles[i];
          const isVideo = file.type.startsWith("video/");
          const parentType = isVideo ? "bitable_file" : "bitable_image";

          setUploadSubtitle(`上传中 ${i + 1}/${createFiles.length} · ${file.name}`);

          const token = await uploadToFeishu({
            file,
            parentType,
            onProgress: (p) => {
              const base = (i / createFiles.length) * 100;
              setUploadProgress(base + p / createFiles.length);
            },
          });
          fileTokens.push(token);

          // 视频自动截封面，也传上去
          if (isVideo) {
            try {
              setUploadSubtitle(`生成封面 ${i + 1}/${createFiles.length}`);
              const coverDataUrl = await extractVideoCover(file);
              const coverFile = dataUrlToFile(coverDataUrl, `${file.name}-cover.jpg`);
              const coverToken = await uploadToFeishu({
                file: coverFile,
                parentType: "bitable_image",
                onProgress: () => {},
              });
              coverTokens.push(coverToken);
            } catch {
              coverTokens.push(null);
            }
          } else {
            coverTokens.push(null);
          }
        }
        setUploadProgress(100);
        setUploadSubtitle("同步到飞书表格…");
      }

      // 3. 在信息图库建卡片记录（第一张用 card00RecordId 覆盖，其余新建）
      if (fileTokens.length > 0) {
        for (let i = 0; i < fileTokens.length; i++) {
          const cardNo = "card-" + String(i).padStart(2, "0");
          const isVideo = createFiles[i].type.startsWith("video/");
          const body: Record<string, any> = {
            task_id: taskId,
            card_no: cardNo,
            topic: `${createName.trim()} · ${cardNo}`,
            mode: createStyle,
            file_token: fileTokens[i],
          };
          if (isVideo && coverTokens[i]) {
            body.cover_token = coverTokens[i];
          }

          // 第一张覆盖 card-00
          if (i === 0 && card00RecordId) {
            // 用 PUT 更新 card-00
            const fd = new FormData();
            fd.append("task_id", String(taskId));
            fd.append("card_no", cardNo);
            fd.append("topic", `${createName.trim()} · ${cardNo}`);
            fd.append("mode", createStyle);

            // 小图直接走后端接口更新
            const upr = await fetch(`/api/cards/${card00RecordId}/direct`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const upj = await upr.json();
            if (!upj.ok) console.warn("更新 card-00 失败:", upj.error);
          } else {
            // 后续新建卡片
            await fetch("/api/cards/direct", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          }
        }
      }

      resetCreateForm();
      setShowCreate(false);
      await refresh();
      setOpenTaskId(taskId);
    } catch (e: any) {
      setCreateErr(e.message);
    } finally {
      setCreating(false);
      setUploading(false);
    }
  }

  async function handleCreateFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setCreateFiles((prev) => [...prev, ...newFiles]);
    // 占位封面，后续异步生成
    setCreateFileCovers((prev) => [...prev, ...newFiles.map(() => null)]);
    // 异步生成视频封面
    newFiles.forEach(async (file, idx) => {
      if (file.type.startsWith("video/")) {
        try {
          const cover = await extractVideoCover(file);
          setCreateFileCovers((prev) => {
            const next = [...prev];
            const realIdx = createFiles.length + idx;
            if (next.length > realIdx) next[realIdx] = cover;
            return next;
          });
        } catch {}
      }
    });
  }

  function removeCreateFile(idx: number) {
    setCreateFiles((prev) => prev.filter((_, i) => i !== idx));
    setCreateFileCovers((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalCards = tasks?.reduce((acc, t) => acc + t.cards.length, 0) ?? 0;
  const lastUpdate = tasks?.[0]?.cards?.[0]?.fields?.创建日期
    ? new Date(tasks[0].cards[0].fields.创建日期).toISOString().slice(0, 10)
    : "—";

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    const arr = [...tasks];
    switch (sortBy) {
      case "newest":
        return arr.sort((a, b) => b.task_id - a.task_id);
      case "oldest":
        return arr.sort((a, b) => a.task_id - b.task_id);
      case "name":
        return arr.sort((a, b) => a.project_name.localeCompare(b.project_name, "zh-CN"));
      case "cards":
        return arr.sort((a, b) => b.cards.length - a.cards.length);
    }
  }, [tasks, sortBy]);

  const openTask = tasks?.find((t) => t.task_id === openTaskId);

  return (
    <main className="min-h-screen">
      {/* Top header */}
      <header className="px-8 md:px-16 pt-8 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brick rounded-sm flex items-center justify-center">
              <span className="text-cream font-mono text-[12px] font-bold">CA</span>
            </div>
            <span className="font-serif text-[18px] tracking-tight">Card Atelier</span>
          </div>
          <nav className="flex items-center gap-6 text-eyebrow">
            <a href="#library" className="hover:text-brick transition">LIBRARY · 卡片库</a>
            <button
              onClick={(e) => { e.preventDefault(); setShowGuide(true); }}
              className="hover:text-brick transition text-left"
            >
              GUIDE · 使用指南
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setBitablePwdErr(false); setBitablePwd(""); setShowBitablePassword(true); }}
              className="flex items-center gap-1.5 hover:text-brick transition"
              title="在飞书多维表格中打开"
            >
              <span>⤴</span>
              <span>飞书表格</span>
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await fetch("/api/health");
                  const j = await r.json();
                  if (j.ok) {
                    alert(`飞书连接正常\n\n认证方式：${j.mode}\nBase Token：${j.bitableBase?.slice(0, 12)}...`);
                  } else {
                    alert("飞书连接异常：" + (j.error || "未知错误"));
                  }
                } catch (e: any) {
                  alert("检测失败：" + e.message);
                }
              }}
              className="flex items-center gap-1.5 hover:text-brick transition cursor-help"
              title="点击检测飞书连接状态"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              <span>飞书已连接</span>
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setShowCreate(true)}
              placeholder="新任务项目名…"
              className="bg-creamLight border border-ink px-3 py-1.5 text-[13px] font-mono w-44"
            />
            <select
              value={createStyle}
              onChange={(e) => setCreateStyle(e.target.value)}
              className="bg-creamLight border border-ink px-2 py-1.5 text-[13px] font-mono"
              title="选风格 Mode"
            >
              {STYLE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-[12px]">
              + 新建任务
            </button>
            <button onClick={refresh} className="btn-ghost">
              ⟳ 刷新
            </button>
          </div>
        </div>
        <div className="divider-rule mt-6" />
      </header>

      {/* Hero */}
      <section className="px-8 md:px-16 pt-12 pb-16 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <p className="eyebrow mb-4">—— ALL TASKS · 全部任务</p>
          <h1 className="h-display">
            整理过的知识，都在这一张张图里
          </h1>
          <p className="mt-6 text-inkSoft max-w-md leading-relaxed">
            浏览每个项目、查看文案、下载原图合集，内容实时同步到飞书多维表格。
          </p>
        </div>

        <div className="border border-creamDeep bg-creamLight p-8 skew-card">
          <p className="eyebrow text-brick mb-3">— STATUS · 状态</p>
          <div className="grid grid-cols-3 gap-6 mt-4">
            <div>
              <div className="font-serif text-[56px] leading-none">{tasks?.length ?? "—"}</div>
              <p className="eyebrow mt-2">TASKS · 任务</p>
            </div>
            <div>
              <div className="font-serif text-[56px] leading-none">{totalCards || "—"}</div>
              <p className="eyebrow mt-2">CARDS · 卡片</p>
            </div>
            <div>
              <div className="font-serif text-[24px] leading-none mt-3">{lastUpdate}</div>
              <p className="eyebrow mt-2">LAST UPDATE · 最近更新</p>
            </div>
          </div>
        </div>
      </section>

      {/* 错误横幅 */}
      {err && (
        <div className={`mx-8 md:mx-16 mb-8 p-6 border-2 ${errKind === "auth" ? "border-brick bg-creamLight" : "border-ink bg-creamLight"}`}>
          <p className="font-mono text-[13px] text-brickDeep">
            {errKind === "auth" ? "⚠ 飞书连接失效 · " : "⚠ "}{err}
          </p>
          <p className="text-inkSoft text-[13px] mt-2">点 ⟳ REFRESH 重试，或查 <a href="/api/health" className="underline">/api/health</a>。</p>
        </div>
      )}

      {/* Library */}
      <section id="library" className="px-8 md:px-16 pb-24">
        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6 px-4 py-3 bg-creamLight border border-creamDeep">
          <span className="font-mono text-[13px] text-inkSoft">
            {tasks ? (
              <>{tasks.length} 个任务 · {totalCards} 张图 · 上次更新 {lastUpdate}</>
            ) : (
              "loading…"
            )}
          </span>
        </div>

        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <p className="eyebrow mb-2">—— LIBRARY</p>
            <h2 className="h-section">All tasks</h2>
          </div>
          <p className="text-inkSoft text-[13px] whitespace-nowrap">
            {tasks ? `${sortedTasks.length} / ${tasks.length}` : "loading..."}
          </p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {([
            ["newest", "最新"],
            ["oldest", "最老"],
            ["name", "项目名"],
            ["cards", "图片数"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1 text-[12px] font-mono border transition ${
                sortBy === key
                  ? "bg-ink text-cream border-ink"
                  : "bg-creamLight text-inkSoft border-creamDeep hover:border-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <TaskGrid
          tasks={sortedTasks}
          onOpen={(tid) => setOpenTaskId(tid)}
        />
      </section>

      {/* 新建任务弹层 */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-6"
          onClick={() => { if (!creating) setShowCreate(false); }}
        >
          <div
            className="bg-cream w-full max-w-[720px] max-h-[85vh] overflow-y-auto border-2 border-ink p-8 shadow-cardHover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="eyebrow text-brick">NEW TASK · 新建任务</p>
                <h2 className="font-serif text-[24px] leading-tight mt-2">填好内容，一键同步到飞书</h2>
              </div>
              <button
                onClick={() => { if (!creating) setShowCreate(false); }}
                className="w-9 h-9 hover:bg-creamDeep transition flex items-center justify-center"
              >
                <span className="font-mono text-[18px]">✕</span>
              </button>
            </div>

            {createErr && (
              <div className="mb-4 px-4 py-2 bg-brick text-cream text-[12px] font-mono">
                ⚠ {createErr}
              </div>
            )}

            {/* 项目名 + 风格 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="eyebrow text-[11px] mb-1 block">项目名 *</label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="例如：Patrick Collison · 创业心法"
                  className="w-full bg-creamLight border border-ink px-3 py-2 font-serif text-[14px]"
                />
              </div>
              <div>
                <label className="eyebrow text-[11px] mb-1 block">风格 Mode</label>
                <select
                  value={createStyle}
                  onChange={(e) => setCreateStyle(e.target.value)}
                  className="w-full bg-creamLight border border-ink px-3 py-2 font-mono text-[12px]"
                >
                  {STYLE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 标题 */}
            <div className="mb-4">
              <label className="eyebrow text-[11px] mb-1 block">标题（文案用）</label>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="一句话标题"
                className="w-full bg-creamLight border border-ink px-3 py-2 font-serif text-[14px]"
              />
            </div>

            {/* 正文 */}
            <div className="mb-4">
              <label className="eyebrow text-[11px] mb-1 block">总文案</label>
              <textarea
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                placeholder="整体写，不分页…"
                rows={6}
                className="w-full bg-creamLight border border-ink px-3 py-2 font-mono text-[12px] leading-relaxed"
              />
            </div>

            {/* 标签 */}
            <div className="mb-4">
              <label className="eyebrow text-[11px] mb-1 block">标签（空格分隔）</label>
              <input
                value={createTags}
                onChange={(e) => setCreateTags(e.target.value)}
                placeholder="创业 增长 产品"
                className="w-full bg-creamLight border border-ink px-3 py-2 font-mono text-[12px]"
              />
            </div>

            {/* 上传图片/视频 */}
            <div className="mb-6">
              <label className="eyebrow text-[11px] mb-1 block">上传图片 / 视频（可选，多张，可追加）</label>
              <label className="btn-ghost text-[12px] py-2 px-4 inline-block cursor-pointer">
                + 选择文件
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                  onChange={handleCreateFiles}
                  className="hidden"
                />
              </label>
              {createFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {createFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      <div className="w-16 h-16 border border-creamDeep bg-creamLight flex items-center justify-center overflow-hidden">
                        {f.type.startsWith("video/") ? (
                          createFileCovers[i] ? (
                            <img src={createFileCovers[i]!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-mono text-inkSoft">▶ {f.name.slice(0, 8)}</span>
                          )
                        ) : (
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <button
                        onClick={() => removeCreateFile(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-brick text-cream text-[10px] rounded-full"
                        disabled={uploading}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 提交 */}
            <div className="flex gap-3 pt-4 border-t border-creamDeep">
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="btn-primary flex-1"
              >
                {creating ? "创建中…" : "✓ 创建任务"}
              </button>
              <button
                onClick={() => { if (!creating) setShowCreate(false); }}
                disabled={creating}
                className="btn-ghost flex-1"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使用指南弹层 */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-6"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-cream w-full max-w-[640px] max-h-[80vh] overflow-y-auto border-2 border-ink p-8 shadow-cardHover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="eyebrow text-brick">GUIDE · 使用指南</p>
                <h2 className="font-serif text-[24px] leading-tight mt-2">Card Atelier 怎么用</h2>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="w-9 h-9 hover:bg-creamDeep transition flex items-center justify-center"
              >
                <span className="font-mono text-[18px]">✕</span>
              </button>
            </div>

            <div className="space-y-5 text-[14px] leading-relaxed">
              <div>
                <p className="font-serif text-[18px] mb-1">1. 新建任务</p>
                <p className="text-inkSoft">顶部输入项目名 → 选风格 → 点「+ 新建任务」→ 填标题、文案、标签、上传图片 → 同步到飞书。</p>
              </div>
              <div>
                <p className="font-serif text-[18px] mb-1">2. 查看 & 编辑</p>
                <p className="text-inkSoft">点击任务卡片打开详情。左侧是图片轮播，右侧是文案和卡片列表。点 ✎ NAME 改项目名，点 ✎ COPY 改文案。</p>
              </div>
              <div>
                <p className="font-serif text-[18px] mb-1">3. 上传新卡</p>
                <p className="text-inkSoft">详情页 CARDS 区域点「+ ADD CARD」上传图片或视频，支持多张。拖拽缩略图可以调整顺序。</p>
              </div>
              <div>
                <p className="font-serif text-[18px] mb-1">4. 下载</p>
                <p className="text-inkSoft">点「⤓ 下载 ZIP」一键打包所有图片和文案。点「⧉ 复制文案」复制到剪贴板。</p>
              </div>
              <div>
                <p className="font-serif text-[18px] mb-1">5. 数据存在哪</p>
                <p className="text-inkSoft">所有数据实时同步到飞书多维表格：信息图库（存卡片）+ 文案库（存文字）。两边用 task_id 关联。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 飞书表格密码验证弹层 */}
      {showBitablePassword && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-6"
          onClick={() => setShowBitablePassword(false)}
        >
          <div
            className="bg-cream w-full max-w-[400px] border-2 border-ink p-8 shadow-cardHover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="eyebrow text-brick">ACCESS CODE</p>
                <h2 className="font-serif text-[22px] leading-tight mt-2">访问飞书表格</h2>
              </div>
              <button
                onClick={() => setShowBitablePassword(false)}
                className="w-9 h-9 hover:bg-creamDeep transition flex items-center justify-center"
              >
                <span className="font-mono text-[18px]">✕</span>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (bitablePwd === "yang") {
                  window.open("https://bytedance.feishu.cn/base/BQ3gbOvjPa8tG9sAeRycCJSInrh", "_blank");
                  setShowBitablePassword(false);
                } else {
                  setBitablePwdErr(true);
                }
              }}
            >
              <input
                type="password"
                value={bitablePwd}
                onChange={(e) => { setBitablePwd(e.target.value); setBitablePwdErr(false); }}
                placeholder="请输入密码"
                autoFocus
                className="w-full bg-creamLight border border-ink px-3 py-2 font-mono text-[14px] mb-2"
              />
              {bitablePwdErr && <p className="text-brick text-[12px] font-mono mb-3">密码错误，请重试</p>}
              <button type="submit" className="btn-primary w-full text-[13px] py-2">
                确认访问
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {openTaskId !== null && openTask && (
        <TaskModal
          taskId={openTaskId}
          projectName={openTask.project_name}
          copyRecordId={openTask.copy?.record_id}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => refresh()}
        />
      )}

      {/* 全屏上传 loading */}
      <LoadingOverlay
        visible={uploading}
        title="上传中"
        progress={uploadProgress}
        subtitle={uploadSubtitle}
      />
    </main>
  );
}
