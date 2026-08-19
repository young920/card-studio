import { NextRequest, NextResponse } from "next/server";
import { createCard, nextAutoNumber } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 直传模式创建卡片：文件已经传到飞书了，这里只写记录
 *  body: { task_id, card_no, topic, mode, file_token, cover_token? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { task_id, card_no, topic, mode, file_token, cover_token } = body;

    if (!file_token) return NextResponse.json({ ok: false, error: "file_token required" }, { status: 400 });

    let tid = Number(task_id);
    if (!tid) {
      tid = await nextAutoNumber(0);
    }

    const fields: Record<string, any> = {
      task_id: tid,
      卡号: card_no || "card-00",
      主题一句话: topic || "",
      "风格 Mode": mode || "Editorial Weekly",
      状态: "已完成",
      原图: [{ file_token: file_token }],
    };

    // 如果有封面（视频缩略图），写进缩略图字段
    if (cover_token) {
      fields["缩略图"] = [{ file_token: cover_token }];
    }

    const { record_id } = await createCard(fields);
    return NextResponse.json({ ok: true, record_id, task_id: tid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
