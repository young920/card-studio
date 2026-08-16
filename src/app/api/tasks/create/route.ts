import { NextRequest, NextResponse } from "next/server";
import { nextAutoNumber } from "@/lib/feishu";

export const dynamic = "force-dynamic";

/** Allocate a new task_id and return it. The actual records (cards + copy)
 *  are created by separate endpoints once the user uploads content. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectName = String(body.project_name || "(未命名)");
    const newId = await nextAutoNumber(0);
    return NextResponse.json({ ok: true, task_id: newId, project_name: projectName });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}