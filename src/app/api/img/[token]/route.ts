import { getTenantAccessToken } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** GET /api/img/[token] — 反代飞书附件（图片/视频）给前端用
 *  视频支持 Range 请求（拖动进度条需要）
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const fileToken = params.token;
  if (!fileToken || fileToken === "undefined" || fileToken === "null") {
    return new Response("无效的文件 token", { status: 400 });
  }

  const rangeHeader = req.headers.get("range");

  try {
    const token = await getTenantAccessToken();

    // 方法 1: 直接 download（bitable_image 图片附件）
    let resp = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    let isVideo = false;
    let tmpUrl = "";

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
      tmpUrl = item?.tmp_download_url;
      if (!tmpUrl) {
        return new Response(`下载链接获取失败: ${tmpJson.msg || tmpJson.code}`, { status: 502 });
      }

      // 判断是不是视频
      const fileName = item?.file_name || "";
      isVideo = /\.(mp4|mov|webm|m4v|avi)$/i.test(fileName);

      // 视频：带 Range 转发，支持流式播放
      if (isVideo && rangeHeader) {
        resp = await fetch(tmpUrl, {
          headers: { Range: rangeHeader },
        });
      } else {
        resp = await fetch(tmpUrl);
      }
      if (!resp.ok && resp.status !== 206) {
        return new Response("文件下载失败: " + resp.status, { status: 502 });
      }
    }

    const contentType = resp.headers.get("content-type") || "";
    const contentDisp = resp.headers.get("content-disposition") || "";

    // 视频：直接 stream 转发，支持 Range
    if (isVideo || contentType.startsWith("video/")) {
      const headers = new Headers();
      headers.set("Content-Type", contentType || "video/mp4");
      const cl = resp.headers.get("content-length");
      if (cl) headers.set("Content-Length", cl);
      const cr = resp.headers.get("content-range");
      if (cr) headers.set("Content-Range", cr);
      headers.set("Accept-Ranges", resp.headers.get("accept-ranges") || "bytes");
      if (contentDisp) headers.set("Content-Disposition", contentDisp);
      headers.set("Cache-Control", "public, max-age=86400");

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers,
      });
    }

    // 图片：读完整 buffer 返回
    const buf = await resp.arrayBuffer();
    return serveImageBuffer(buf, contentType, contentDisp);
  } catch (e: any) {
    return new Response(`请求失败: ${e.message?.slice(0, 200)}`, { status: 500 });
  }
}

function serveImageBuffer(buf: ArrayBuffer, contentType: string, contentDisposition: string): Response {
  let ct = contentType;
  if (!ct || ct === "application/octet-stream") {
    const bytes = new Uint8Array(buf);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) ct = "image/jpeg";
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) ct = "image/gif";
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) ct = "image/webp";
    else if (bytes[0] === 0x89 && bytes[1] === 0x50) ct = "image/png";
    else ct = "application/octet-stream";
  }

  const headers: Record<string, string> = {
    "Content-Type": ct,
    "Cache-Control": "public, max-age=86400",
  };
  if (contentDisposition) headers["Content-Disposition"] = contentDisposition;

  return new Response(buf, { headers });
}
