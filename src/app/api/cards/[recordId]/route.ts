import { NextRequest, NextResponse } from "next/server";
import { updateCardFields, deleteCard, buildMultipartBody, getTenantAccessToken, BITABLE_BASE_TOKEN } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** PUT: 支持两种格式
 *  1. JSON body: { fields: {...} } → 更新文字字段
 *  2. FormData: { file, ... }  → 更新原图附件
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

      const token = await getTenantAccessToken();
      const fileData = new Uint8Array(await file.arrayBuffer());
      const isVideo = file.type.startsWith("video/");

      const fileToken = await uploadBitableAttachment({
        token,
        fileName: file.name || "card.png",
        parentType: isVideo ? "bitable_file" : "bitable_image",
        parentNode: process.env.BITABLE_BASE_TOKEN || BITABLE_BASE_TOKEN,
        fileData,
        fileType: file.type,
      });

      await updateCardFields(recordId, {
        原图: [{ file_token: fileToken }],
      });
      return NextResponse.json({ ok: true, file_token: fileToken });
    }

    const body = await req.json();
    const { fields } = body;
    if (!fields || typeof fields !== "object") return NextResponse.json({ ok: false, error: "fields required" }, { status: 400 });

    const allowed = ["主题一句话", "风格 Mode", "状态", "出处", "备注", "缩略图", "卡号"];
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
