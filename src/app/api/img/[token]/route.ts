import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/img/[token] — 反代飞书附件图片给前端用
 *  用 lark-cli base +record-download-attachment (user token, bitable 附件专用)
 *  但 lark-cli 走的是 base+record 维度, 不是 file_token 维度
 *  → 退路: 用 records 列表拿 record_id+file_token 缓存
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const fileToken = params.token;
  if (!fileToken || fileToken === "undefined" || fileToken === "null") {
    return new Response(`bad token`, { status: 400 });
  }

  // 策略 1: Vercel/有 FEISHU_USER_TOKEN env → fetch + 走 URL
  const envToken = process.env.FEISHU_USER_TOKEN || process.env.FEISHU_BOT_TOKEN;
  if (envToken) {
    try {
      const url = `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${envToken}` },
        cache: "no-store",
      });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let contentType = "image/png";
        if (bytes[0] === 0xff && bytes[1] === 0xd8) contentType = "image/jpeg";
        else if (bytes[0] === 0x47 && bytes[1] === 0x49) contentType = "image/gif";
        return new Response(buf, {
          headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
        });
      }
      return new Response(`env download ${resp.status}`, { status: 502 });
    } catch (e: any) {
      return new Response(`env failed: ${e.message?.slice(0, 200)}`, { status: 502 });
    }
  }

  // 策略 2: 本机 (无 env token, 但有 feishu-proxy 或 lark-cli) → 调 feishu-proxy 拿 buffer
  const proxyUrl = process.env.FEISHU_PROXY_URL;
  if (proxyUrl) {
    try {
      // feishu-proxy 已经知道 record_id+file_token 维度? 不, 它只透传
      // 退路: 走 lark-cli base 子命令直接下载 (跳过 feishu-proxy, 因为 proxy 不支持二进制)
      // 但 lark-cli 需要 record_id, 我们没有 (前端只给 file_token)
      // 终极退路: 缓存映射 file_token → record_id (从 records list 查)
      const cached = await findRecordIdByFileToken(fileToken);
      if (!cached) {
        return new Response(`no cached record_id for ${fileToken}`, { status: 404 });
      }

      // 用 lark-cli 下载到本地, 再 serve
      const tmpDir = path.join(process.cwd(), ".downloads");
      await fs.mkdir(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `${fileToken}.png`);

      const cmd = [
        "lark-cli",
        "base", "+record-download-attachment",
        "--base-token", "BQ3gbOvjPa8tG9sAeRycCJSInrh",
        "--table-id", "tblYWFt0cNPvIKb8",
        "--record-id", cached,
        "--file-token", fileToken,
        "--output", path.relative(process.cwd(), tmpFile),
        "--as", "user",
      ].join(" ");
      execSync(cmd, { encoding: "utf-8", cwd: process.cwd() });

      const buf = await fs.readFile(tmpFile);
      await fs.unlink(tmpFile).catch(() => {});

      const bytes = new Uint8Array(buf);
      let contentType = "image/png";
      if (bytes[0] === 0xff && bytes[1] === 0xd8) contentType = "image/jpeg";

      return new Response(buf, {
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
      });
    } catch (e: any) {
      return new Response(`proxy failed: ${e.message?.slice(0, 200)}`, { status: 502 });
    }
  }

  return new Response(`no token / proxy available`, { status: 500 });
}

// 缓存 file_token → record_id 映射
let cache: Map<string, string> | null = null;
let cacheTime = 0;

async function findRecordIdByFileToken(fileToken: string): Promise<string | null> {
  if (cache && Date.now() - cacheTime < 5 * 60 * 1000) {
    return cache.get(fileToken) || null;
  }
  try {
    const out = execSync(
      `lark-cli api GET "/open-apis/bitable/v1/apps/BQ3gbOvjPa8tG9sAeRycCJSInrh/tables/tblYWFt0cNPvIKb8/records?page_size=100" --as user --json`,
      { encoding: "utf-8" }
    );
    const data = JSON.parse(out);
    const m = new Map<string, string>();
    for (const item of data.data?.items || []) {
      for (const att of item.fields?.原图 || []) {
        if (att.file_token) m.set(att.file_token, item.record_id);
      }
      for (const att of item.fields?.缩略图 || []) {
        if (att.file_token) m.set(att.file_token, item.record_id);
      }
    }
    cache = m;
    cacheTime = Date.now();
    return m.get(fileToken) || null;
  } catch {
    return null;
  }
}
