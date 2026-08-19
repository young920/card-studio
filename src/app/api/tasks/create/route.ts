import { NextRequest, NextResponse } from "next/server";
import { nextAutoNumber, createCard, createCopy } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 新建任务: 分配 task_id, 在信息图库占位 card-00, 在文案库建一条记录 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectName = String(body.project_name || "(未命名)");
    const styleMode = String(body.style_mode || "Editorial Weekly");
    const title = String(body.title || "");
    const bodyText = String(body.body || "");
    const tags = Array.isArray(body.tags) ? body.tags : [];

    const newId = await nextAutoNumber(0);

    // 1. 信息图库占位 card-00
    let card00RecordId: string | undefined;
    try {
      const placeholder = await createCard({
        ID: `NO.${String(newId).padStart(3, "0")}`,
        task_id: newId,
        卡号: "card-00",
        项目名: projectName,
        主题一句话: `${projectName} · 封面 (待上传)`,
        "风格 Mode": styleMode,
        状态: "草稿",
        创建日期: Date.now(),
      });
      card00RecordId = placeholder.record_id;
    } catch (e: any) {
      console.error("createCard placeholder failed:", e.message);
    }

    // 2. 文案库建一条记录
    let copyRecordId: string | undefined;
    try {
      const copyResult = await createCopy({
        task_id: newId,
        项目名: projectName,
        标题: title || projectName,
        总文案: bodyText,
        正文: bodyText,
        标签: tags,
      });
      copyRecordId = copyResult.record_id;
    } catch (e: any) {
      console.error("createCopy failed:", e.message);
    }

    return NextResponse.json({
      ok: true,
      task_id: newId,
      project_name: projectName,
      style_mode: styleMode,
      card00_record_id: card00RecordId,
      copy_record_id: copyRecordId,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
