import { NextRequest, NextResponse } from "next/server";
import { getTenantAccessToken, BITABLE_BASE_TOKEN } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * GET /api/upload/ticket?parent_type=bitable_file&file_name=xxx.mp4&size=123456
 * 返回飞书分片上传的 upload_id，前端用 upload_id 直接往飞书传文件
 * 绕过 Vercel Serverless 4.5MB body 限制，而且有天然进度
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("file_name");
    const parentType = searchParams.get("parent_type") || "bitable_image";
    const size = Number(searchParams.get("size") || 0);

    if (!fileName) return NextResponse.json({ ok: false, error: "file_name required" }, { status: 400 });

    const token = await getTenantAccessToken();

    // 调飞书准备分片上传接口
    const resp = await fetch(
      "https://open.feishu.cn/open-apis/drive/v1/medias/upload_prepare",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_name: fileName,
          parent_type: parentType,
          parent_node: process.env.BITABLE_BASE_TOKEN || BITABLE_BASE_TOKEN,
          size: size || undefined,
        }),
      }
    );
    const json: any = await resp.json();
    if (json.code !== 0) {
      return NextResponse.json({ ok: false, error: json.msg, code: json.code }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      upload_id: json.data.upload_id,
      file_token: json.data.file_token,
      // 前端用这个 URL 模式分片直传
      upload_url_pattern: json.data.upload_url || `https://open.feishu.cn/open-apis/drive/v1/medias/upload_part`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/upload/complete — 完成上传，生成 file_token
 * body: { upload_id, file_name, parent_type, block_list: ["etag1", ...] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { upload_id, file_name, parent_type = "bitable_image", block_list } = body;
    if (!upload_id) return NextResponse.json({ ok: false, error: "upload_id required" }, { status: 400 });

    const token = await getTenantAccessToken();

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
          file_name,
          parent_type,
          block_list,
        }),
      }
    );
    const json: any = await resp.json();
    if (json.code !== 0) {
      return NextResponse.json({ ok: false, error: json.msg, code: json.code }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      file_token: json.data.file_token,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
