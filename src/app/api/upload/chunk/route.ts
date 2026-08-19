import { NextRequest, NextResponse } from "next/server";
import { getTenantAccessToken, BITABLE_BASE_TOKEN } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * 分片上传代理 — 前端分片传到这里，我们转发给飞书
 * 每片 ~1MB，远小于 Vercel 4.5MB body 限制
 *
 * 1. POST /api/upload/chunk?init=1 — 初始化上传，拿 upload_id
 *    body: { file_name, parent_type, size }
 *
 * 2. POST /api/upload/chunk?upload_id=xxx&seq=N — 传第 N 片
 *    body: multipart/form-data { file: 分片blob }
 *
 * 3. POST /api/upload/chunk?finish=1 — 完成上传，拿 file_token
 *    body: { upload_id, file_name, parent_type, block_list: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = await getTenantAccessToken();

    // 1. 初始化
    if (searchParams.get("init")) {
      const body = await req.json();
      const { file_name, parent_type = "bitable_image", size } = body;

      const resp = await fetch(
        "https://open.feishu.cn/open-apis/drive/v1/medias/upload_prepare",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name,
            parent_type,
            parent_node: process.env.BITABLE_BASE_TOKEN || BITABLE_BASE_TOKEN,
            size: size || undefined,
          }),
        }
      );
      const json: any = await resp.json();
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: json.msg, code: json.code },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        upload_id: json.data.upload_id,
        upload_url: json.data.upload_url || "https://open.feishu.cn/open-apis/drive/v1/medias/upload_part",
        block_size: json.data.block_size || 1048576,
      });
    }

    // 2. 传分片（走通用地址 + Authorization token，参数对齐 lark-cli
    const uploadId = searchParams.get("upload_id");
    const seq = searchParams.get("seq");
    if (uploadId && seq !== null) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

      const fileData = new Uint8Array(await file.arrayBuffer());
      const encoder = new TextEncoder();
      const boundary = "----Chunk" + Date.now().toString(16);
      const CRLF = encoder.encode("\r\n");

      const parts: Uint8Array[] = [];
      const addStr = (s: string) => parts.push(encoder.encode(s));

      addStr(`--${boundary}\r\n`);
      addStr(`Content-Disposition: form-data; name="upload_id"\r\n\r\n`);
      addStr(uploadId);
      parts.push(CRLF);

      addStr(`--${boundary}\r\n`);
      addStr(`Content-Disposition: form-data; name="seq"\r\n\r\n`);
      addStr(seq);
      parts.push(CRLF);

      addStr(`--${boundary}\r\n`);
      addStr(`Content-Disposition: form-data; name="size"\r\n\r\n`);
      addStr(String(fileData.length));
      parts.push(CRLF);

      addStr(`--${boundary}\r\n`);
      addStr(
        `Content-Disposition: form-data; name="file"; filename="part_${seq}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
      );
      parts.push(fileData);
      parts.push(CRLF);
      addStr(`--${boundary}--\r\n`);

      // 合并
      let total = 0;
      for (const p of parts) total += p.length;
      const body = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { body.set(p, off); off += p.length; }

      const resp = await fetch(
        "https://open.feishu.cn/open-apis/drive/v1/medias/upload_part",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
        }
      );
      const json: any = await resp.json();
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: json.msg, code: json.code },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, etag: json.data?.etag || seq });
    }

    // 3. 完成上传（对齐 lark-cli：传 block_num，不传 block_list）
    if (searchParams.get("finish")) {
      const body = await req.json();
      const { upload_id, file_name, parent_type = "bitable_image", block_num } = body;

      const resp = await fetch(
        "https://open.feishu.cn/open-apis/drive/v1/medias/upload_finish",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            upload_id,
            block_num: block_num ?? 0,
          }),
        }
      );
      const json: any = await resp.json();
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: json.msg, code: json.code },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        file_token: json.data.file_token,
      });
    }

    return NextResponse.json(
      { ok: false, error: "invalid request: need init=1 or upload_id+seq or finish=1" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
