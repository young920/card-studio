import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 最小化测试路由 — 只验证 feishu.ts 能不能加载、token 能不能拿 */
export async function GET() {
  const steps: string[] = [];
  try {
    // 1. 检查环境变量
    const appId = process.env.FEISHU_APP_ID || "(空)";
    const appSecret = process.env.FEISHU_APP_SECRET || "(空)";
    const baseToken = process.env.BITABLE_BASE_TOKEN || "(空)";
    steps.push(`env: appId=${appId.slice(0,8)}... appSecret=${appSecret.slice(0,4)}... baseToken=${baseToken.slice(0,8)}...`);

    // 2. 尝试导入 feishu 模块
    const feishu = await import("@/lib/feishu");
    steps.push("feishu module imported");

    // 3. 尝试获取 tenant_access_token
    const token = await feishu.getTenantAccessToken();
    steps.push(`token obtained: ${token.slice(0,10)}...`);

    // 4. 尝试调 listCards
    const cards = await feishu.listCards();
    steps.push(`listCards: ${cards.length} cards`);

    return NextResponse.json({ ok: true, steps });
  } catch (e: any) {
    steps.push(`ERROR: ${e.message || String(e)}`);
    return NextResponse.json({ ok: false, steps, stack: e.stack?.slice(0, 500) }, { status: 500 });
  }
}
