import { NextRequest, NextResponse } from "next/server";
import { updateCardFields } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 直传模式更新卡片：文件已经传到飞书了，只更新记录字段
 *  body: { task_id, card_no, topic, mode, file_token, cover_token? }
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.json();
    const { task_id, card_no, topic, mode, file_token, cover_token } = body;

    const fields: Record<string, any> = {};
    if (task_id !== undefined) fields["task_id"] = Number(task_id);
    if (card_no !== undefined) fields["卡号"] = card_no;
    if (topic !== undefined) fields["主题一句话"] = topic;
    if (mode !== undefined) fields["风格 Mode"] = mode;
    if (file_token !== undefined) fields["原图"] = [{ file_token: file_token }];
    if (cover_token !== undefined) fields["缩略图"] = [{ file_token: cover_token }];

    await updateCardFields(recordId, fields);
    return NextResponse.json({ ok: true, updated: Object.keys(fields) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
