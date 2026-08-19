import { NextRequest, NextResponse } from "next/server";
import { getTenantAccessToken } from "@/lib/feishu";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(_req: NextRequest) {
  try {
    // 云端部署用应用凭证自动认证，验证 token 是否有效
    const token = await getTenantAccessToken();
    if (!token) throw new Error("token empty");
    return NextResponse.json({ ok: true, message: "飞书连接正常（应用凭证自动认证）" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || "认证失败" },
      { status: 500 }
    );
  }
}
