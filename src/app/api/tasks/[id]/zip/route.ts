import { NextRequest } from "next/server";
import { listCards, listCopy, getAttachmentBuffer, groupIntoTasks } from "@/lib/feishu";
import { zipFiles } from "@/lib/zip";

export const dynamic = "force-dynamic";
// Edge Runtime — Cloudflare Pages 兼容
export const runtime = "edge";

/** GET /api/tasks/[id]/zip — 打包整个 task 的资源 (原图 + README.md) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!taskId) return new Response("invalid task_id", { status: 400 });

  // 1. 拉所有 cards + copy
  const [cards, copy] = await Promise.all([listCards(), listCopy()]);
  const tasks = groupIntoTasks(cards, copy);
  const task = tasks.find((t) => t.task_id === taskId);
  if (!task) return new Response("task not found", { status: 404 });

  // 2. 收集所有文件到内存（fflate 纯 JS zip）
  const files: { name: string; data: Uint8Array | string }[] = [];

  // 3. README.md
  files.push({ name: "README.md", data: generateReadme(task) });

  // 4. 拉所有原图
  for (const card of task.cards) {
    const att = card.fields?.原图?.[0] || card.fields?.缩略图?.[0];
    if (!att?.url) continue;
    try {
      const buf = await getAttachmentBuffer(
        card.record_id,
        att.file_token,
        att.name || `${card.fields?.卡号}.png`
      );
      files.push({
        name: `${card.fields?.卡号 || card.record_id}.png`,
        data: new Uint8Array(buf),
      });
    } catch (e: any) {
      files.push({
        name: `${card.fields?.卡号 || card.record_id}.ERROR.md`,
        data: `# 下载失败\n${e?.message || e}\n`,
      });
    }
  }

  // 5. 文案
  if (task.copy) {
    const f = task.copy.fields;
    files.push({
      name: "xhs-copy.md",
      data: [
        `# ${f.标题 || task.project_name}`,
        ``,
        `**字数**：${f.字数 || "?"}`,
        ``,
        `## 标签`,
        f.标签 || "",
        ``,
        `## 总文案 (整体写不分页)`,
        f.总文案 || "",
        ``,
        `## 正文 (分页)`,
        f.正文 || "",
      ].join("\n"),
    });
  }

  // 6. 打包
  const zipBuf = await zipFiles(files);

  const safeName = (task.project_name || `task-${taskId}`).replace(/[\\/:*?"<>|]/g, "-");
  const encodedName = encodeURIComponent(safeName);

  return new Response(zipBuf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="CardStudio-task-${taskId}.zip"; filename*=UTF-8''${encodedName}.zip`,
    },
  });
}

function generateReadme(task: any): string {
  const copy = task.copy?.fields;
  return [
    `# Card Studio 资源包`,
    ``,
    `**项目名**：${task.project_name}`,
    `**任务 ID**：${task.task_id}`,
    `**卡片数**：${task.cards.length}`,
    ``,
    `---`,
    ``,
    `## 标题候选`,
    copy?.标题候选 || "(无)",
    ``,
    `## 总文案 (整体写不分页)`,
    copy?.总文案 || "(无)",
    ``,
    `## 标签`,
    copy?.标签 || "(无)",
    ``,
    `---`,
    ``,
    `## 卡片索引`,
    ...task.cards.map(
      (c: any) =>
        `- **${c.fields?.卡号 || "?"}** | ${c.fields?.主题一句话 || "(无标题)"} | \`${c.fields?.卡号 || c.record_id}.png\``
    ),
    ``,
    `---`,
    ``,
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
  ].join("\n");
}
