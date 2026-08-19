import { getTenantAccessToken } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** GET /api/img/[token] — 反代飞书附件（图片/视频）给前端用 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const fileToken = params.token;
  if (!fileToken || fileToken === "undefined" || fileToken === "null") {
    return new Response("无效的文件 token", { status: 400 });
  }

  try {
    const token = await getTenantAccessToken();

    // 方法 1: 直接 download（bitable_image 附件）
    let resp = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!resp.ok) {
      // 方法 2: 拿临时下载链接（兼容 bitable_file / 视频等）
      const tmpResp = await fetch(
        "https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_tokens: [fileToken] }),
          cache: "no-store",
        }
      );
      const tmpJson: any = await tmpResp.json();
      const item = tmpJson.data?.tmp_download_urls?.[0];
      const url = item?.tmp_download_url;
      if (!url) {
        return new Response(`下载链接获取失败: ${tmpJson.msg || tmpJson.code}`, { status: 502 });
      }
      resp = await fetch(url);
      if (!resp.ok) {
        return new Response("文件下载失败: " + resp.status, { status: 502 });
      }
    }

    const buf = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "";
    const contentDisp = resp.headers.get("content-disposition") || "";
    return serveBuffer(buf, contentType, contentDisp);
  } catch (e: any) {
    return new Response(`请求失败: ${e.message?.slice(0, 200)}`, { status: 500 });
  }
}

function serveBuffer(buf: ArrayBuffer, contentType: string, contentDisposition: string): Response {
  let ct = contentType;
  if (!ct || ct === "application/octet-stream") {
    const bytes = new Uint8Array(buf);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) ct = "image/jpeg";
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) ct = "image/gif";
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) ct = "image/webp";
    else if (bytes[0] === 0x89 && bytes[1] === 0x50) ct = "image/png";
    else ct = "application/octet-stream";
  }

  const isVideo = ct.startsWith("video/");
  const headers: Record<string, string> = {
    "Content-Type": ct,
    "Cache-Control": "public, max-age=3600",
  };
  if (isVideo) headers["Accept-Ranges"] = "bytes";
  if (contentDisposition) headers["Content-Disposition"] = contentDisposition;

  return new Response(buf, { headers });
}
