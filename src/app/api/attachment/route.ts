import { NextRequest, NextResponse } from "next/server";
import { getAttachmentTmpUrl } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "缺少 token 参数" }, { status: 400 });
  }
  try {
    const url = await getAttachmentTmpUrl(token);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
