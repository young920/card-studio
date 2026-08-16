export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getTenantAccessToken } from "@/lib/feishu";

const FEISHU_DRIVE_BASE = "https://open.feishu.cn/open-apis/drive/v1/medias";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || token === "undefined" || token === "null") {
    return new Response(`bad token: ${JSON.stringify(params)}`, { status: 400 });
  }

  try {
    // tenant_access_token 不需 user 权限，绕过 user token 失效 / 权限问题
    const tenantToken = await getTenantAccessToken();
    const url = `${FEISHU_DRIVE_BASE}/${token}/download`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${tenantToken}` },
      cache: "no-store",
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return new Response(`drive download ${resp.status}: ${body.slice(0, 200)}`, { status: 502 });
    }
    const buf = await resp.arrayBuffer();
    // sniff content-type
    const bytes = new Uint8Array(buf);
    let contentType = "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8) contentType = "image/jpeg";
    else if (bytes[0] === 0x47 && bytes[1] === 0x49) contentType = "image/gif";
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) contentType = "image/webp";
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return new Response(`proxy failed: ${err.message?.slice(0, 200)}`, {
      status: 502,
    });
  }
}
