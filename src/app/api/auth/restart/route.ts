import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 飞书重连按钮。
 * Vercel 云端：用应用凭证自动认证，不需要 lark-cli，直接返回提示。
 * 本地开发：走 lark-cli device flow。
 */
export async function POST() {
  // Vercel: 不需要重连，应用凭证自动获取 token
  if (process.env.VERCEL) {
    return NextResponse.json({
      ok: true,
      message: "Vercel 部署使用应用凭证自动认证，无需手动重连。",
      needsAction: false,
    });
  }

  // 本地开发: 走 lark-cli device flow
  try {
    const { execSync } = await import("node:child_process");
    const out = execSync(
      'lark-cli auth login --recommend --scope "bitable:app base:app:read base:record:read" --no-wait --json 2>&1',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();

    let parsed: any;
    try {
      parsed = JSON.parse(out);
    } catch {
      return NextResponse.json({ ok: false, error: "lark-cli 输出无法解析: " + out.slice(0, 200) }, { status: 500 });
    }

    if (!parsed.verification_url) {
      return NextResponse.json({ ok: false, error: "未拿到验证链接: " + out.slice(0, 200) }, { status: 500 });
    }

    const deviceCode = parsed.device_code;
    if (deviceCode) {
      execSync(`nohup lark-cli auth login --device-code "${deviceCode}" --json > /tmp/lark-restart-login.log 2>&1 &`, { encoding: "utf-8" });
    }

    return NextResponse.json({
      ok: true,
      verification_url: parsed.verification_url,
      user_code: parsed.user_code,
      expires_in: parsed.expires_in,
      needsAction: true,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 300) || String(e) }, { status: 500 });
  }
}
