import { NextRequest, NextResponse } from "next/server";
import { updateCopyFields, deleteCopy } from "@/lib/feishu";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.json();
    const { fields } = body;
    if (!fields || typeof fields !== "object") return NextResponse.json({ ok: false, error: "fields required" }, { status: 400 });

    const allowed = ["标题", "总文案", "正文", "标签", "项目名", "出处", "备注"];
    const clean: Record<string, any> = {};
    for (const k of allowed) if (k in fields) clean[k] = fields[k];

    await updateCopyFields(recordId, clean);
    return NextResponse.json({ ok: true, updated: Object.keys(clean) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    await deleteCopy(recordId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}