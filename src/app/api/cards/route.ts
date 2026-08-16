import { NextRequest, NextResponse } from "next/server";
import { createCard, nextAutoNumber, getTenantAccessToken } from "@/lib/feishu";

export const dynamic = "force-dynamic";

/** Upload a PNG to a task's first card (or create new card if no 卡号 provided). */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const task_id = Number(form.get("task_id") || 0);
    const card_no = String(form.get("card_no") || "card-00");
    const topic = String(form.get("topic") || "");
    const mode = String(form.get("mode") || "");
    const projectName = String(form.get("project_name") || "");
    const file = form.get("file") as File | null;

    if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

    // 1. Resolve / create task_id
    let tid = task_id;
    if (!tid) {
      tid = await nextAutoNumber(0);
    }

    // 2. Upload file to bitable attachment field via /drive/v1/medias/upload_all
    const token = await getTenantAccessToken();
    const buf = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buf], { type: file.type || "image/png" });
    const fd = new FormData();
    fd.append("file_name", file.name || `${card_no}.png`);
    fd.append("parent_type", "bitable_image");
    fd.append("parent_node", process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh");
    fd.append("file", blob, file.name || `${card_no}.png`);

    const upResp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const upJson: any = await upResp.json();
    if (upJson.code !== 0) {
      return NextResponse.json({ ok: false, error: `upload failed: ${upJson.msg}` }, { status: 500 });
    }
    const fileToken = upJson.data.file_token;

    // 3. Create card record with attachment
    const fields: Record<string, any> = {
      task_id: tid,
      卡号: card_no,
      主题一句话: topic,
      "风格 Mode": mode,
      状态: "已完成",
      项目名: projectName,
      原图: [{ file_token: fileToken }],
    };

    const { record_id } = await createCard(fields);
    return NextResponse.json({ ok: true, record_id, task_id: tid, file_token: fileToken });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}