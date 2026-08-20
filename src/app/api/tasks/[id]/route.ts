import { NextRequest, NextResponse } from "next/server";
import { listCards, updateCardFields } from "@/lib/feishu";
import { BITABLE_BASE_TOKEN, TABLE_GRAPHS } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** GET single task: 返回 cards 列表 (供 modal 打开) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const taskId = Number(id);
    if (!taskId) return NextResponse.json({ ok: false, error: "invalid task_id" }, { status: 400 });

    const all = await listCards();
    const taskCards = all.filter((c) => Number(c.fields.task_id) === taskId);

    // 把 file_token 反代 URL 加上 (前端 <img src={c.url}> 直接用)
    const cards = taskCards.map((c) => {
      const original = c.fields?.原图?.[0];
      const thumb = c.fields?.缩略图?.[0];
      const isVideo = !!original && (original.type === "bitable_file" || /\.(mp4|mov|webm|m4v|avi)$/i.test(original.filename || ""));
      return {
        record_id: c.record_id,
        card_no: c.fields?.卡号 || "",
        topic: c.fields?.主题一句话 || "",
        mode: c.fields?.["风格 Mode"] || "",
        status: c.fields?.状态 || "",
        url: original ? `/api/img/${original.file_token}` : "",
        cover_url: original && !isVideo ? `/api/img/${original.file_token}` : (thumb ? `/api/img/${thumb.file_token}` : (isVideo && original ? `/api/img/${original.file_token}?cover=1` : "")),
        is_video: isVideo,
        created: c.fields?.创建日期 ? new Date(c.fields.创建日期).toISOString() : "",
        fields: c.fields,
      };
    });

    return NextResponse.json({ ok: true, task_id: taskId, cards });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

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