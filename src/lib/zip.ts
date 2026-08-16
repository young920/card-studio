import archiver from "archiver";
import { getTenantAccessToken } from "./feishu";

/** Sanitize filename for ASCII-only zip headers (non-ASCII filenames break
 * archiver's ByteString coercion on macOS Node 24). */
function sanitizeFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_");
}

/** Build a CardStudio zip for one task and return Buffer. */
export async function buildTaskZip(args: {
  projectName: string;
  taskId: number;
  cards: Array<{ cardNo: string; pngUrl: string }>;
  copy?: {
    title: string;
    fullCopy: string;
    tags: string[];
  };
}): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    // Append each card PNG (fetched from feishu — requires tenant_access_token
    // AND drive:drive:readonly scope on the app)
    const token = await getTenantAccessToken();
    for (const c of args.cards) {
      try {
        const r = await fetch(c.pngUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          const isScopeErr = txt.includes("99991672") || txt.includes("Access denied");
          if (isScopeErr) {
            throw new Error(
              `card ${c.cardNo}: missing drive:drive:readonly scope — ` +
              `open https://open.feishu.cn/app/cli_aaf5646a44789bcf/auth and grant it. ` +
              `(feishu: ${r.status})`
            );
          }
          console.warn(`skip card ${c.cardNo}: HTTP ${r.status} ${txt.slice(0, 100)}`);
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        archive.append(buf, { name: sanitizeFilename(`${c.cardNo}.png`) });
      } catch (e: any) {
        console.warn(`skip card ${c.cardNo}: ${e.message}`);
      }
    }

    // Append README.md (one big block, not sectioned)
    const md = renderReadme(args);
    archive.append(md, { name: "README.md" });

    archive.finalize();
  });
}

function renderReadme(args: {
  projectName: string;
  taskId: number;
  copy?: { title: string; fullCopy: string; tags: string[] };
}): string {
  const c = args.copy;
  const lines: string[] = [];
  lines.push(`# ${c?.title || args.projectName}`);
  lines.push("");
  lines.push(`<!-- task_id: NO.${String(args.taskId).padStart(3, "0")} -->`);
  lines.push("");
  if (c?.fullCopy) {
    lines.push(c.fullCopy);
    lines.push("");
  }
  if (c?.tags?.length) {
    lines.push(c.tags.join(" "));
    lines.push("");
  }
  return lines.join("\n");
}