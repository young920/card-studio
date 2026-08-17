import { getTenantAccessToken } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/img/[token] — 反代飞书附件图片给前端用 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const fileToken = params.token;
  if (!fileToken || fileToken === "undefined" || fileToken === "null") {
    return new Response("无效的文件 token", { status: 400 });
  }

  try {
    const token = await getTenantAccessToken();

    // 用 drive API 下载附件
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!resp.ok) {
      // 降级：用 batch_get_tmp_download_url 拿临时链接
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
      const url = tmpJson.data?.tmp_download_urls?.[0]?.tmp_download_url;
      if (!url) {
        return new Response("下载链接获取失败", { status: 502 });
      }
      const fileResp = await fetch(url);
      if (!fileResp.ok) {
        return new Response("文件下载失败", { status: 502 });
      }
      const buf = await fileResp.arrayBuffer();
      return serveBuffer(buf);
    }

    const buf = await resp.arrayBuffer();
    return serveBuffer(buf);
  } catch (e: any) {
    return new Response(`请求失败: ${e.message?.slice(0, 200)}`, { status: 500 });
  }
}

function serveBuffer(buf: ArrayBuffer): Response {
  const bytes = new Uint8Array(buf);
  let contentType = "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) contentType = "image/jpeg";
  else if (bytes[0] === 0x47 && bytes[1] === 0x49) contentType = "image/gif";
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) contentType = "image/webp";
  return new Response(buf, {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
  });
}
