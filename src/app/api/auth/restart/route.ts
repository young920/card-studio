import { NextResponse } from "next/server";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";

/** 触发 lark-cli device flow 重授权. 返回 verification_url 给前端 window.open. */
export async function POST() {
  try {
    // 跑 lark-cli device flow 启动 (--no-wait, 不阻塞)
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
      return NextResponse.json({ ok: false, error: "未拿到 verification_url: " + out.slice(0, 200) }, { status: 500 });
    }

    // 后台启动 poll
    const deviceCode = parsed.device_code;
    if (deviceCode) {
      execSync(`nohup lark-cli auth login --device-code "${deviceCode}" --json > /tmp/lark-restart-login.log 2>&1 &`, { encoding: "utf-8" });
    }

    return NextResponse.json({
      ok: true,
      verification_url: parsed.verification_url,
      user_code: parsed.user_code,
      expires_in: parsed.expires_in,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message?.slice(0, 300) || String(e) }, { status: 500 });
  }
}
