import { NextResponse } from "next/server";
import { listCards, listCopy, groupIntoTasks } from "@/lib/feishu";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [graph, copy] = await Promise.all([listCards(), listCopy()]);
    const tasks = groupIntoTasks(graph, copy);
    return NextResponse.json({ ok: true, tasks });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}