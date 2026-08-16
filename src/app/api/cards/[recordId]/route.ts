import { NextRequest, NextResponse } from "next/server";
import { updateCardFields, deleteCard } from "@/lib/feishu";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.json();
    const { fields } = body;
    if (!fields || typeof fields !== "object") return NextResponse.json({ ok: false, error: "fields required" }, { status: 400 });

    // Whitelist editable fields
    const allowed = ["主题一句话", "风格 Mode", "状态", "出处", "备注", "缩略图"];
    const clean: Record<string, any> = {};
    for (const k of allowed) if (k in fields) clean[k] = fields[k];

    await updateCardFields(recordId, clean);
    return NextResponse.json({ ok: true, updated: Object.keys(clean) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    await deleteCard(recordId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}