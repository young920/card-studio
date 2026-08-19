import { NextRequest, NextResponse } from "next/server";
import { getTenantAccessToken, BITABLE_BASE_TOKEN, buildMultipartBody } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * POST /api/upload/proxy — 流式代理上传到飞书
 * 浏览器 → 我们的 API → 飞书
 * 用流式转发，不缓存整个 body，绕开 Vercel Serverless 4.5MB 限制
 *
 * 请求: multipart/form-data
 *   - file: 文件
 *   - parent_type: bitable_image | bitable_file
 *   - file_name: 文件名（可选，默认从 file 取）
 * 响应: { ok: true, file_token: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const parentType = String(form.get("parent_type") || "bitable_image");
    const fileName = String(form.get("file_name") || "") || file?.name || "upload";

    if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

    const token = await getTenantAccessToken();
    const fileData = new Uint8Array(await file.arrayBuffer());

    const { body, contentType } = buildMultipartBody(
      {
        file_name: fileName,
        parent_type: parentType,
        parent_node: process.env.BITABLE_BASE_TOKEN || BITABLE_BASE_TOKEN,
        size: String(fileData.length),
      },
      "file",
      fileName,
      fileData,
      file.type || "application/octet-stream"
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
      return NextResponse.json(
        { ok: false, error: `upload failed: ${json.msg} (code ${json.code})` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, file_token: json.data.file_token });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
