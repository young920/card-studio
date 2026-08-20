"use client";

import { TaskCard } from "./TaskCard";

interface Card { record_id: string; fields: Record<string, any>; }
interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
}

export function TaskGrid({
  tasks,
  onOpen,
  onDeleteTask,
  onDownloadTask,
  onCopyTask,
}: {
  tasks: Task[];
  onOpen: (id: number) => void;
  onDeleteTask?: (id: number) => void;
  onDownloadTask?: (id: number) => void;
  onCopyTask?: (id: number) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="border-2 border-ink border-dashed p-16 text-center bg-creamLight">
        <p className="eyebrow text-inkSoft">EMPTY LIBRARY</p>
        <p className="font-display text-[24px] font-bold mt-3">还没有卡片项目</p>
        <p className="text-inkSoft text-[14px] mt-2">
          点右上角 <span className="font-mono text-brick font-bold">+ NEW</span> 新建，或从飞书表格同步。
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {tasks.map((t) => (
        <TaskCard
          key={t.task_id}
          task={t}
          onOpen={() => onOpen(t.task_id)}
          onDelete={onDeleteTask ? () => onDeleteTask(t.task_id) : undefined}
          onDownload={onDownloadTask ? () => onDownloadTask(t.task_id) : undefined}
          onCopyText={onCopyTask ? () => onCopyTask(t.task_id) : undefined}
        />
      ))}
    </div>
  );
}
