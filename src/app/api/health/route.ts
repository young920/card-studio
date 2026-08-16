import { NextResponse } from "next/server";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";

/** Health check — 验证 lark-cli proxy 是否能调通 bitable. */
export async function GET() {
  // 1. env 路径 (Vercel 云端)
  const envToken = process.env.FEISHU_USER_TOKEN || process.env.FEISHU_BOT_TOKEN;
  if (envToken) {
    return NextResponse.json({
      ok: true,
      mode: "env",
      tokenPresent: true,
      bitableBase: process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh",
    });
  }

  // 2. 本地 lark-cli proxy 路径
  try {
    const out = execSync(
      `lark-cli api GET "/open-apis/bitable/v1/apps/${process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh"}/tables/tblYWFt0cNPvIKb8/records?page_size=1" --as bot --json 2>&1`,
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    const json = JSON.parse(out);
    return NextResponse.json({
      ok: json.ok === true,
      mode: "lark-cli-proxy",
      tokenPresent: json.ok === true,
      bitableBase: process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh",
      identity: json.identity,
      error: json.ok ? undefined : json.error?.message,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      mode: "lark-cli-proxy",
      tokenPresent: false,
      bitableBase: process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh",
      error: String(e.message || e).slice(0, 200),
    });
  }
}
