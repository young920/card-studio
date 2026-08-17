import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 动态导入 feishu，避免顶层 import 失败导致整个 route 崩溃
    const feishu = await import("@/lib/feishu");
    console.log("[/api/tasks] feishu loaded, calling listCards...");
    
    const [graph, copy] = await Promise.all([
      feishu.listCards().catch(e => {
        console.error("[/api/tasks] listCards error:", e.message);
        return [];
      }),
      feishu.listCopy().catch(e => {
        console.error("[/api/tasks] listCopy error:", e.message);
        return [];
      }),
    ]);
    
    console.log(`[/api/tasks] graph=${graph.length} copy=${copy.length}`);
    const tasks = feishu.groupIntoTasks(graph, copy);
    return NextResponse.json({ ok: true, tasks });
  } catch (e: any) {
    console.error("[/api/tasks] top-level error:", e);
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
}
