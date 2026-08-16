import { NextRequest, NextResponse } from "next/server";
import { nextAutoNumber, createCard } from "@/lib/feishu";

export const dynamic = "force-dynamic";

/** 新建任务: 分配 task_id, 在信息图库占位一张 card-00 (项目名 + 风格 Mode),
 *  用户进 modal 再上传真正的卡. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectName = String(body.project_name || "(未命名)");
    const styleMode = String(body.style_mode || "Editorial Weekly");
    const newId = await nextAutoNumber(0);

    // 占位记录 (card-00): 用户进 modal 后再上传真图, 这条只占 task_id
    let card00RecordId: string | undefined;
    try {
      const placeholder = await createCard({
        ID: `NO.${String(newId).padStart(3, "0")}`,
        task_id: String(newId),
        卡号: "card-00",
        项目名: projectName,
        主题一句话: `${projectName} · 封面 (待上传)`,
        "风格 Mode": styleMode,
        状态: "占位中",
        创建日期: Date.now(),
      });
      card00RecordId = placeholder.record_id;
    } catch (e: any) {
      // 占位失败不致命 (可能是 lark-cli proxy 临时抖), 仍返回 task_id
      console.error("createCard placeholder failed:", e.message);
    }

    return NextResponse.json({
      ok: true,
      task_id: newId,
      project_name: projectName,
      style_mode: styleMode,
      card00_record_id: card00RecordId,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
