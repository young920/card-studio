import { NextRequest, NextResponse } from "next/server";
import { listCards, listCopy } from "@/lib/feishu";
import { buildTaskZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const taskId = Number(id);
    const [graph, copy] = await Promise.all([listCards(), listCopy()]);
    const taskCards = graph.filter((c) => Number(c.fields.task_id) === taskId);
    taskCards.sort((a, b) => String(a.fields.卡号).localeCompare(String(b.fields.卡号)));
    const taskCopy = copy.find((c) => Number(c.fields.task_id) === taskId);

    // attachment field already carries a direct `url` from list_records
    const cards = taskCards.map((c) => {
      const atts = (c.fields.原图 as any[]) || [];
      const first = atts[0];
      return { cardNo: String(c.fields.卡号), pngUrl: first?.url || "" };
    });

    const copyPayload = taskCopy
      ? {
          title: String(taskCopy.fields.标题 || taskCopy.fields.项目名 || ""),
          fullCopy: String(taskCopy.fields.总文案 || taskCopy.fields.正文 || ""),
          tags: (taskCopy.fields.标签 as string[]) || [],
        }
      : undefined;

    const projectName = String(taskCards[0]?.fields.项目名 || `task-${taskId}`);
    const asciiName = projectName.replace(/[^\x20-\x7E]/g, "_");

    const buf = await buildTaskZip({
      projectName,
      taskId,
      cards,
      copy: copyPayload,
    });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="CardStudio-${asciiName}.zip"; filename*=UTF-8''${encodeURIComponent(projectName)}.zip`,
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}