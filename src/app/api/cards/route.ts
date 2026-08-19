import { NextRequest, NextResponse } from "next/server";
import { createCard, nextAutoNumber, getTenantAccessToken, BITABLE_BASE_TOKEN, buildMultipartBody } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** 上传图片/视频到飞书多维表格附件字段，并创建卡片记录 */
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

    // 2. 上传到飞书 drive
    const token = await getTenantAccessToken();
    const fileData = new Uint8Array(await file.arrayBuffer());
    const isVideo = file.type.startsWith("video/");
    const parentType = isVideo ? "bitable_file" : "bitable_image";
    const fileName = file.name || `${card_no}.${isVideo ? "mp4" : "png"}`;

    const fileToken = await uploadBitableAttachment({
      token,
      fileName,
      parentType,
      parentNode: process.env.BITABLE_BASE_TOKEN || BITABLE_BASE_TOKEN,
      fileData,
      fileType: file.type,
    });

    // 3. 创建卡片记录
    const fields: Record<string, any> = {
      task_id: Number(tid),
      卡号: card_no,
      主题一句话: topic || `${projectName} · ${card_no}`,
      "风格 Mode": mode || "Editorial Weekly",
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

async function uploadBitableAttachment(opts: {
  token: string;
  fileName: string;
  parentType: string;
  parentNode: string;
  fileData: Uint8Array;
  fileType: string;
}): Promise<string> {
  const { token, fileName, parentType, parentNode, fileData, fileType } = opts;

  const { body, contentType } = buildMultipartBody(
    {
      file_name: fileName,
      parent_type: parentType,
      parent_node: parentNode,
      size: String(fileData.length),
    },
    "file",
    fileName,
    fileData,
    fileType || "application/octet-stream"
  );

  const resp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body,
  });

  const json: any = await resp.json();
  if (json.code !== 0) {
    throw new Error(`upload failed: ${json.msg} (code ${json.code})`);
  }
  return json.data.file_token;
}
