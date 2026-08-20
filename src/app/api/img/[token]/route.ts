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

    // 方法 1: 直接 download（bitable_image 图片附件等）
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
    const totalBytes = buf.byteLength;

    // 判断是否视频
    const isVideo = contentType.startsWith("video/");

    if (!isVideo) {
      // 图片：直接返回
      return serveImageBuffer(buf, contentType, contentDisp);
    }

    // 视频：支持 Range
    if (!rangeHeader) {
      // 无 Range：全量返回 200
      const headers = new Headers();
      headers.set("Content-Type", contentType || "video/mp4");
      headers.set("Content-Length", String(totalBytes));
      headers.set("Accept-Ranges", "bytes");
      if (contentDisp) headers.set("Content-Disposition", contentDisp);
      headers.set("Cache-Control", "public, max-age=86400");
      return new Response(buf, { status: 200, headers });
    }

    // 解析 Range: bytes=start-end
    const rangeMatch = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (!rangeMatch) {
      return new Response("无效的 Range 头", { status: 400 });
    }

    let start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
    let end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalBytes - 1;

    // 边界修正
    if (start >= totalBytes) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalBytes}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
    if (end >= totalBytes) end = totalBytes - 1;
    if (start > end) start = end;

    const chunk = buf.slice(start, end + 1);
    const headers = new Headers();
    headers.set("Content-Type", contentType || "video/mp4");
    headers.set("Content-Length", String(chunk.byteLength));
    headers.set("Content-Range", `bytes ${start}-${end}/${totalBytes}`);
    headers.set("Accept-Ranges", "bytes");
    if (contentDisp) headers.set("Content-Disposition", contentDisp);
    headers.set("Cache-Control", "public, max-age=86400");

    return new Response(chunk, { status: 206, headers });
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
