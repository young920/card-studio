import { NextRequest, NextResponse } from "next/server";
import { getUserAccessToken, getAttachmentTmpUrl } from "@/lib/feishu";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });
  }
  try {
    // 直接走 batch_get_tmp_download_url（不需 recordId）
    const userToken = await getUserAccessToken();
    const url = await getAttachmentTmpUrl(token, userToken);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
