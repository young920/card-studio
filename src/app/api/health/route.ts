import { NextResponse } from "next/server";
import { getTenantAccessToken } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** Health check — 验证飞书 API 是否能调通. */
export async function GET() {
  const appId = process.env.FEISHU_APP_ID || "";
  const appSecret = process.env.FEISHU_APP_SECRET || "";
  const baseToken = process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh";

  if (!appId || !appSecret) {
    return NextResponse.json({
      ok: false,
      mode: "missing-credentials",
      error: "未配置 FEISHU_APP_ID / FEISHU_APP_SECRET 环境变量",
    });
  }

  try {
    const token = await getTenantAccessToken();
    // 尝试读一条记录验证权限
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseToken}/tables/tblYWFt0cNPvIKb8/records?page_size=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    const json: any = await resp.json();
    return NextResponse.json({
      ok: json.code === 0,
      mode: "tenant-access-token",
      tokenPresent: true,
      bitableBase: baseToken,
      error: json.code !== 0 ? json.msg : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      mode: "tenant-access-token",
      tokenPresent: false,
      bitableBase: baseToken,
      error: String(e.message || e).slice(0, 200),
    });
  }
}
