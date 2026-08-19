/**
 * ZIP 打包工具 — Cloudflare Pages Edge Runtime 兼容版
 * 使用 fflate（纯 JS，无 Node 依赖）替代 archiver
 */
import { zipSync, strToU8 } from 'fflate';

/**
 * 内存中打包 zip，返回 ArrayBuffer（同步，适合小文件）
 */
export function zipFiles(
  files: { name: string; data: Uint8Array | string }[]
): ArrayBuffer {
  const zipInput: Record<string, Uint8Array> = {};
  for (const f of files) {
    const data = typeof f.data === 'string' ? strToU8(f.data) : f.data;
    zipInput[f.name] = data;
  }
  const result = zipSync(zipInput, { level: 6 });
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

/**
 * 打包整个 task 的资源（供 download/route.ts 用）
 */
export async function buildTaskZip(opts: {
  projectName: string;
  taskId: number;
  cards: { cardNo: string; pngUrl: string }[];
  copy?: { title: string; fullCopy: string; tags: string[] };
}): Promise<ArrayBuffer> {
  const files: { name: string; data: Uint8Array | string }[] = [];

  // README
  const readme = [
    `# Card Studio 资源包`,
    ``,
    `**项目名**：${opts.projectName}`,
    `**任务 ID**：${opts.taskId}`,
    `**卡片数**：${opts.cards.length}`,
    ``,
    `---`,
    ``,
    ...(opts.copy ? [
      `## 标题`,
      opts.copy.title,
      ``,
      `## 总文案`,
      opts.copy.fullCopy,
      ``,
      `## 标签`,
      opts.copy.tags.join('、'),
      ``,
      `---`,
      ``,
    ] : []),
    `## 卡片索引`,
    ...opts.cards.map((c) => `- **${c.cardNo}** → \`${c.cardNo}.png\``),
    ``,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n');
  files.push({ name: 'README.md', data: readme });

  // 文案
  if (opts.copy) {
    files.push({
      name: 'xhs-copy.md',
      data: [
        `# ${opts.copy.title}`,
        ``,
        `## 标签`,
        opts.copy.tags.join('、'),
        ``,
        `## 总文案`,
        opts.copy.fullCopy,
      ].join('\n'),
    });
  }

  // 拉所有原图
  for (const card of opts.cards) {
    if (!card.pngUrl) continue;
    try {
      const resp = await fetch(card.pngUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = new Uint8Array(await resp.arrayBuffer());
      files.push({ name: `${card.cardNo}.png`, data: buf });
    } catch (e: any) {
      files.push({ name: `${card.cardNo}.ERROR.md`, data: `# 下载失败\n${e?.message || e}\n` });
    }
  }

  return zipFiles(files);
}
