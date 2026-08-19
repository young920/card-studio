import { NextResponse } from "next/server";
import { getTenantAccessToken, BITABLE_BASE_TOKEN, TABLE_GRAPHS } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/** Health check — 验证飞书 API 是否能调通. */
export async function GET() {
  try {
    const token = await getTenantAccessToken();
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records?page_size=1`,
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
      bitableBase: BITABLE_BASE_TOKEN,
      error: json.code !== 0 ? json.msg : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      mode: "error",
      error: String(e.message || e).slice(0, 200),
    });
  }
}
