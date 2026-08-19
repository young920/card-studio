import { NextRequest, NextResponse } from "next/server";
import { listCards, updateCardFields } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** PUT /api/tasks/[id]/reorder — 更新卡片排序 (按 cardIds 数组顺序写回「卡号」字段) */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const taskId = Number(id);
    if (!taskId) return NextResponse.json({ ok: false, error: "invalid task_id" }, { status: 400 });

    const body = await req.json();
    const { cardIds } = body;
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ ok: false, error: "cardIds array required" }, { status: 400 });
    }

    // 按新顺序写卡号: card-00, card-01, ...
    const updates = cardIds.map((recordId: string, idx: number) => {
      const cardNo = `card-${String(idx).padStart(2, "0")}`;
      return updateCardFields(recordId, { 卡号: cardNo });
    });

    await Promise.all(updates);
    return NextResponse.json({ ok: true, updated: cardIds.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
