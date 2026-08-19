import { NextRequest, NextResponse } from "next/server";
import { updateCardFields } from "@/lib/feishu";



export const dynamic = "force-dynamic";
export const runtime = "edge";

/** PUT /api/cards/[recordId]/cover — 更新卡片封面（缩略图字段）
 *  body: { cover_token: "xxx" }
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.json();
    const { cover_token } = body;

    if (!cover_token) return NextResponse.json({ ok: false, error: "cover_token required" }, { status: 400 });

    await updateCardFields(recordId, {
      缩略图: [{ file_token: cover_token }],
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
