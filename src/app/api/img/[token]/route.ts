import { getTenantAccessToken } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** GET /api/img/[token] — 反代飞书附件（图片/视频）给前端用
 *  支持 Range 请求（视频拖动进度条需要）
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const fileToken = params.token;
  if (!fileToken || fileToken === "undefined" || fileToken === "null") {
    return new Response("无效的文件 token", { status: 400 });
  }

  const rangeHeader = req.headers.get("range");

  try {
    const token = await getTenantAccessToken();

    // 先拿文件信息和下载链接
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

    // 转发请求（带 Range header），让飞书源站处理 Range
    const forwardHeaders = new Headers();
    if (rangeHeader) forwardHeaders.set("Range", rangeHeader);

    const resp = await fetch(url, { headers: forwardHeaders });
    if (!resp.ok && resp.status !== 206) {
      return new Response("文件下载失败: " + resp.status, { status: 502 });
    }

    const contentType = resp.headers.get("content-type") || "";
    const contentDisp = resp.headers.get("content-disposition") || "";
    const contentLen = resp.headers.get("content-length") || "";
    const contentRange = resp.headers.get("content-range") || "";
    const acceptRanges = resp.headers.get("accept-ranges") || "";

    // 图片走完整 buffer + 缓存；视频直接 stream 转发（支持 Range）
    const isVideo = contentType.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi)$/i.test(item?.file_name || "");

    if (isVideo) {
      const headers = new Headers();
      headers.set("Content-Type", contentType || "video/mp4");
      if (contentLen) headers.set("Content-Length", contentLen);
      if (contentRange) headers.set("Content-Range", contentRange);
      headers.set("Accept-Ranges", acceptRanges || "bytes");
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
