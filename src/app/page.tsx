"use client";

import { useEffect, useMemo, useState } from "react";
import { TaskModal } from "@/components/TaskModal";
import { TaskGrid } from "@/components/TaskGrid";

interface Card { record_id: string; fields: Record<string, any>; }
interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errKind, setErrKind] = useState<"network" | "auth" | "other" | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStyle, setNewStyle] = useState("Editorial Weekly");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "cards">("newest");

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

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: newName.trim(),
          style_mode: newStyle,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setNewName("");
      await refresh();
      setOpenTaskId(j.task_id);
    } catch (e: any) {
      alert("创建失败：" + e.message);
    } finally {
      setCreating(false);
    }
  }

  const totalCards = tasks?.reduce((acc, t) => acc + t.cards.length, 0) ?? 0;
  const lastUpdate = tasks?.[0]?.cards?.[0]?.fields?.创建日期
    ? new Date(tasks[0].cards[0].fields.创建日期).toISOString().slice(0, 10)
    : "—";

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!search.trim()) return tasks;
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.project_name.toLowerCase().includes(q)) return true;
      if (String(t.task_id).includes(q)) return true;
      for (const c of t.cards) {
        if (c.fields?.主题一句话?.toLowerCase().includes(q)) return true;
        if (c.fields?.ID?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [tasks, search]);

  const sortedTasks = useMemo(() => {
    if (!filteredTasks) return [];
    const arr = [...filteredTasks];
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
  }, [filteredTasks, sortBy]);

  const openTask = tasks?.find((t) => t.task_id === openTaskId);

  return (
    <main className="min-h-screen">
      {/* Top header */}
      <header className="px-8 md:px-16 pt-8 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brick rounded-sm flex items-center justify-center">
              <span className="text-cream font-mono text-[12px] font-bold">CS</span>
            </div>
            <span className="font-serif text-[18px] tracking-tight">Card Studio</span>
          </div>
          <nav className="flex items-center gap-6 text-eyebrow">
            <a href="#library" className="hover:text-brick transition">LIBRARY · 卡片库</a>
            <a href="#guide" className="hover:text-brick transition">GUIDE · 使用指南</a>
            <a href="#install" className="hover:text-brick transition">INSTALL · 安装</a>
            <button
              onClick={async () => {
                const r = await fetch("/api/auth/restart", { method: "POST" });
                const j = await r.json();
                if (j.ok) {
                  const a = document.createElement("a");
                  a.href = j.verification_url;
                  a.target = "_blank";
                  a.click();
                } else {
                  alert("重连失败：" + j.error);
                }
              }}
              className="hover:text-brick transition border border-brick px-2 py-1 text-brick"
              title="飞书 token 失效时点这里重新授权"
            >
              ↻ 飞书重连
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="新任务项目名…"
              className="bg-creamLight border border-ink px-3 py-1.5 text-[13px] font-mono w-44"
            />
            <select
              value={newStyle}
              onChange={(e) => setNewStyle(e.target.value)}
              className="bg-creamLight border border-ink px-2 py-1.5 text-[13px] font-mono"
              title="选风格 Mode"
            >
              <option>Editorial Weekly</option>
              <option>Editorial Magazine</option>
              <option>Swiss International</option>
              <option>Dianyunstyle</option>
              <option>Neo-Brutalist Yingce</option>
              <option>Newspaper Weekly</option>
              <option>Dialogue / Interview</option>
              <option>Paper Brief</option>
            </select>
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary text-[12px]">
              {creating ? "提交中…" : "+ 新建任务"}
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
            信息图卡的幕后工作台
          </h1>
          <p className="mt-6 text-inkSoft max-w-md leading-relaxed">
            浏览每个项目、编辑文案、上传新卡、打包下载，一键同步到飞书多维表格。
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

      {/* 错误横幅 (含 OAuth 失效检测) */}
      {err && (
        <div className={`mx-8 md:mx-16 mb-8 p-6 border-2 ${errKind === "auth" ? "border-brick bg-creamLight" : "border-ink bg-creamLight"}`}>
          <p className="font-mono text-[13px] text-brickDeep">
            {errKind === "auth" ? "⚠ 飞书连接失效 · " : "⚠ "}{err}
          </p>
          {errKind === "auth" ? (
            <div className="mt-3">
              <p className="text-inkSoft text-[13px] mb-3">
                需要重新授权飞书访问权限（之前 OAuth 申请的 scope 不够覆盖 bitable API）。
              </p>
              <button
                onClick={async () => {
                  alert("正在发起飞书重新授权...");
                  // 触发 device flow
                  try {
                    const r = await fetch("/api/auth/restart", { method: "POST" });
                    const j = await r.json();
                    if (j.ok && j.verification_url) {
                      window.open(j.verification_url, "_blank");
                    }
                  } catch (e) {}
                }}
                className="btn-primary text-[12px]"
              >
                ↻ 重新连接飞书
              </button>
              <p className="text-inkSoft text-[12px] mt-3 font-mono">
                或手动跑：`lark-cli auth login --scope &quot;bitable:app base:app:read base:record:read&quot;`
              </p>
            </div>
          ) : (
            <p className="text-inkSoft text-[13px] mt-2">点 ⟳ REFRESH 重试，或查 <a href="/api/health" className="underline">/api/health</a>。</p>
          )}
        </div>
      )}

      {/* Library */}
      <section id="library" className="px-8 md:px-16 pb-24">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <p className="eyebrow mb-2">—— LIBRARY</p>
            <h2 className="h-section">All tasks</h2>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 搜索项目名 / task_id / 卡号 / 主题…"
              className="bg-creamLight border border-ink px-3 py-1.5 text-[13px] font-mono w-72"
            />
            <p className="text-inkSoft text-[13px] whitespace-nowrap">
              {tasks ? `${sortedTasks.length} / ${tasks.length}` : "loading..."}
            </p>
          </div>
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
    </main>
  );
}
