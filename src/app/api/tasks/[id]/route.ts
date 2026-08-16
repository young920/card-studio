import { NextRequest, NextResponse } from "next/server";
import { listCards, updateCardFields } from "@/lib/feishu";

export const dynamic = "force-dynamic";

/** Bulk-update 项目名 across all cards of a task. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const taskId = Number(id);
    const body = await req.json();
    const { project_name } = body;
    if (!project_name?.trim()) return NextResponse.json({ ok: false, error: "project_name required" }, { status: 400 });

    const all = await listCards();
    const taskCards = all.filter((c) => Number(c.fields.task_id) === taskId);
    await Promise.all(taskCards.map((c) => updateCardFields(c.record_id, { 项目名: project_name.trim() })));
    return NextResponse.json({ ok: true, updated: taskCards.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/** Delete a whole task (all cards + copy). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const taskId = Number(id);
    const { deleteCard, deleteCopy, listCards, listCopy } = await import("@/lib/feishu");
    const [cards, copy] = await Promise.all([listCards(), listCopy()]);
    const taskCards = cards.filter((c) => Number(c.fields.task_id) === taskId);
    const taskCopies = copy.filter((c) => Number(c.fields.task_id) === taskId);
    await Promise.all([
      ...taskCards.map((c) => deleteCard(c.record_id)),
      ...taskCopies.map((c) => deleteCopy(c.record_id)),
    ]);
    return NextResponse.json({ ok: true, deleted: { cards: taskCards.length, copy: taskCopies.length } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}