"use client";

import { useEffect, useState } from "react";
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
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function refresh() {
    try {
      setErr(null);
      const r = await fetch("/api/tasks", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
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
        body: JSON.stringify({ project_name: newName.trim() }),
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

  const openTask = tasks?.find((t) => t.task_id === openTaskId);

  return (
    <main className="min-h-screen">
      {/* Top header */}
      <header className="px-8 md:px-16 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brick rounded-sm flex items-center justify-center">
              <span className="text-cream font-mono text-[12px] font-bold">CS</span>
            </div>
            <span className="font-serif text-[18px] tracking-tight">Card Studio</span>
          </div>
          <nav className="flex items-center gap-6 text-eyebrow">
            <a href="#library" className="hover:text-brick transition">LIBRARY</a>
            <a href="#guide" className="hover:text-brick transition">GUIDE</a>
            <a href="#install" className="hover:text-brick transition">INSTALL</a>
          </nav>
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="新任务项目名…"
              className="bg-creamLight border border-ink px-3 py-1.5 text-[13px] font-mono w-48"
            />
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary text-[12px]">
              {creating ? "…" : "+ NEW TASK"}
            </button>
            <button onClick={refresh} className="btn-ghost">
              ⟳ REFRESH
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
            A back-of-house studio for your info-graphic cards.
          </h1>
          <p className="mt-6 text-inkSoft max-w-md leading-relaxed">
            Browse every project. Edit copy. Upload new cards. Download the bundle. Sync directly to 飞书 bitable.
          </p>
        </div>

        <div className="border border-creamDeep bg-creamLight p-8 skew-card">
          <p className="eyebrow text-brick mb-3">— STATUS</p>
          <div className="grid grid-cols-3 gap-6 mt-4">
            <div>
              <div className="font-serif text-[56px] leading-none">{tasks?.length ?? "—"}</div>
              <p className="eyebrow mt-2">TASKS</p>
            </div>
            <div>
              <div className="font-serif text-[56px] leading-none">{totalCards || "—"}</div>
              <p className="eyebrow mt-2">CARDS</p>
            </div>
            <div>
              <div className="font-serif text-[24px] leading-none mt-3">{lastUpdate}</div>
              <p className="eyebrow mt-2">LAST UPDATE</p>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div className="mx-8 md:mx-16 mb-8 p-6 border-2 border-brick bg-creamLight">
          <p className="font-mono text-[13px] text-brickDeep">⚠ {err}</p>
          <p className="text-inkSoft text-[13px] mt-2">Try clicking ⟳ REFRESH, or check /api/health.</p>
        </div>
      )}

      {/* Library */}
      <section id="library" className="px-8 md:px-16 pb-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="eyebrow mb-2">—— LIBRARY</p>
            <h2 className="h-section">All tasks</h2>
          </div>
          <p className="text-inkSoft text-[13px]">
            {tasks ? `${tasks.length} projects · sorted by newest` : "loading..."}
          </p>
        </div>

        <TaskGrid
          tasks={tasks || []}
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