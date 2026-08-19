import { NextRequest, NextResponse } from "next/server";
import { createCopy } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 新建文案记录 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task_id, 标题, 总文案, 正文, 标签, 项目名 } = body;
    if (!task_id) return NextResponse.json({ ok: false, error: "task_id required" }, { status: 400 });

    const fields: Record<string, any> = { task_id: Number(task_id) };
    if (标题 !== undefined) fields["标题"] = 标题;
    if (总文案 !== undefined) fields["总文案"] = 总文案;
    if (正文 !== undefined) fields["正文"] = 正文;
    if (标签 !== undefined) fields["标签"] = 标签;
    if (项目名 !== undefined) fields["项目名"] = 项目名;

    const { record_id } = await createCopy(fields);
    return NextResponse.json({ ok: true, record_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
