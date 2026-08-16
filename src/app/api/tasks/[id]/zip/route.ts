import { NextRequest } from "next/server";
import archiver from "archiver";
import { listCards, listCopy, getAttachmentBuffer, groupIntoTasks } from "@/lib/feishu";

export const dynamic = "force-dynamic";
// 关闭缓存, 每次现拉
export const runtime = "nodejs";

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

  // 2. 创建 zip stream (用 transform stream, archiver 直接 pipe)
  const archive = archiver("zip", { zlib: { level: 6 } });

  // 收集所有 chunks → Uint8Array → Response
  const chunks: Uint8Array[] = [];
  archive.on("data", (c: Buffer) => chunks.push(new Uint8Array(c)));

  const done = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", (err) => reject(err));
  });

  // 3. README.md (转 Buffer.from utf-8, 强制是 Uint8Array)
  const readme = generateReadme(task);
  archive.append(Buffer.from(readme, "utf-8"), { name: "README.md" });

  // 4. 拉所有原图 (走 records 现成 url, 飞书直接给完整下载链接)
  for (const card of task.cards) {
    const att = card.fields?.原图?.[0] || card.fields?.缩略图?.[0];
    if (!att?.url) continue;
    try {
      const buf = await getAttachmentBuffer(card.record_id, att.file_token, att.name || `${card.fields?.卡号}.png`);
      const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      archive.append(u8, { name: `${card.fields?.卡号 || card.record_id}.png` });
    } catch (e: any) {
      archive.append(
        Buffer.from(`# 下载失败\n${e?.message || e}\n`, "utf-8"),
        { name: `${card.fields?.卡号 || card.record_id}.ERROR.md` }
      );
    }
  }

  // 5. 文案 (用纯英文名避免 cp437 中文乱码)
  if (task.copy) {
    const f = task.copy.fields;
    archive.append(
      Buffer.from(
        [
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
        "utf-8"
      ),
      { name: "xhs-copy.md" }
    );
  }

  // 6. finalize
  void archive.finalize();
  await done;

  // 7. 合并 chunks → Blob
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const safeName = (task.project_name || `task-${taskId}`).replace(/[\\/:*?"<>|]/g, "-");

  // RFC 5987 编码中文文件名 (避免 header ByteString 报错)
  const encodedName = encodeURIComponent(safeName);

  return new Response(merged, {
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
