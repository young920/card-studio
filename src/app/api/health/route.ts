import { NextResponse } from "next/server";
import { getAppCredentials } from "@/lib/feishu";

export const dynamic = "force-dynamic";

/** Health check — verifies Keychain credentials are readable. */
export async function GET() {
  const { appId, appSecret } = getAppCredentials();
  return NextResponse.json({
    ok: Boolean(appId && appSecret),
    appIdPrefix: appId ? appId.slice(0, 8) + "..." : null,
    secretPresent: Boolean(appSecret),
    bitableBase: process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh",
  });
}