"use client";

import { TaskCard } from "./TaskCard";

interface Card { record_id: string; fields: Record<string, any>; }
interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
}

export function TaskGrid({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: number) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-creamDeep p-16 text-center">
        <p className="eyebrow text-inkSoft">EMPTY LIBRARY · 空库</p>
        <p className="font-serif text-[20px] mt-3">暂无任务</p>
        <p className="text-inkSoft text-[14px] mt-2">
          点「+ NEW TASK 新建」或在顶部搜索框粘任务名; 也可通过 <code className="font-mono text-brick">yang-bitable-vault</code> skill 同步。
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {tasks.map((t, i) => (
        <TaskCard
          key={t.task_id}
          task={t}
          index={i + 1}
          onOpen={() => onOpen(t.task_id)}
        />
      ))}
    </div>
  );
}