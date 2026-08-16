/**
 * Feishu Bitable client.
 * App credentials: 本地走 .env.local, Vercel 云端走 dashboard 环境变量.
 * 这样部署后能直接跑, 不依赖 macOS Keychain.
 */
import { execSync } from "node:child_process";

export function getAppCredentials() {
  const appId = process.env.FEISHU_APP_ID || "";
  const appSecret = process.env.FEISHU_APP_SECRET || "";
  return { appId, appSecret };
}

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

export async function getTenantAccessToken(): Promise<string> {
  const { appId, appSecret } = getAppCredentials();

  // 方案 A: 直接从 env 拿 (Vercel 云端走这条, 用户在 dashboard 配)
  if (appId && appSecret) {
    const resp = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      cache: "no-store",
    });
    const json: any = await resp.json();
    if (json.code !== 0) throw new Error(`tenant_access_token failed: ${json.msg}`);
    return json.tenant_access_token as string;
  }

  // 方案 B: 本地开发走 lark-cli (让 lark-cli 当 backend proxy)
  // lark-cli 内部已经能拿 tenant token, 我们只调一下验证
  try {
    const out = execSync(
      'lark-cli base +table-list --base-token "' + BITABLE_BASE_TOKEN + '" --json 2>&1',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    const json = JSON.parse(out);
    if (json.ok === false) {
      throw new Error(`lark-cli fallback failed: ${json.error?.message || "unknown"}`);
    }
    // 探活成功, 但 lark-cli 没暴露 tenant_token 直接拿法
    // 走真正 proxy 路径: 调飞书 API, 但用 user_access_token 作为 fallback
    // 简化: 跳到方案 C
  } catch {
    // lark-cli 探活失败, 走方案 C
  }

  // 方案 C: 用 user_access_token 直接调飞书 API (不需要 tenant token)
  // 多数 bitable 只读场景 user token 就够了
  const userToken = await getUserAccessToken();
  return userToken; // user_access_token 也能调 bitable API
}

/* ---- Bitable constants (the user's vault) ---- */
export const BITABLE_BASE_TOKEN = process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh";
export const TABLE_GRAPHS = process.env.BITABLE_TABLE_GRAPHS || "tblYWFt0cNPvIKb8"; // 信息图库
export const TABLE_COPY = process.env.BITABLE_TABLE_COPY || "tblRSEX8K3mvKpix"; // 小红书文案库

/* ---- lark-cli proxy helper ---- */
/**
 * 所有飞书 API 调用走 lark-cli 子进程 (本地开发)
 * lark-cli 内部拿 token, 我们不需要知道 app secret / user token
 * Vercel 云端走 env 拿 token, 不走 lark-cli
 *
 * 默认 --as bot (tenant 身份), bitable 不需要 user scope
 */
async function larkApi(method: string, path: string, body?: any, identity: "user" | "bot" = "bot"): Promise<any> {
  // 优先走 env 直接调飞书 API (Vercel 云端)
  const envToken = process.env.FEISHU_USER_TOKEN || process.env.FEISHU_BOT_TOKEN || process.env.FEISHU_APP_ACCESS_TOKEN;
  if (envToken) {
    const resp = await fetch(`${FEISHU_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${envToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return resp.json();
  }

  // 本地走 lark-cli 子进程 (它内部读 keychain)
  const bodyArg = body ? ` --data '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : "";
  const cmd = `lark-cli api ${method} ${path}${bodyArg} --as ${identity} --json 2>&1`;
  try {
    const out = execSync(cmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const json = JSON.parse(out);
    if (json.ok === false) {
      throw new Error(`lark-cli ${path} failed: ${json.error?.message || out.slice(0, 200)}`);
    }
    return json;
  } catch (e: any) {
    throw new Error(`lark-cli proxy error: ${e.message?.slice(0, 300) || e}`);
  }
}

/* ---- Bitable REST helpers ---- */
async function bitable(path: string, init: { method?: string; body?: any } = {}) {
  const method = init.method || "GET";
  // path 已经包含 /apps/.../, 不需要再加 /bitable/v1 前缀
  const fullPath = `/open-apis/bitable/v1${path}`;
  const json: any = await larkApi(method, fullPath, init.body);
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`Bitable ${path} failed: ${json.code} ${json.msg}`);
  }
  return json.data;
}

export interface Card {
  record_id: string;
  fields: Record<string, any>;
}

export async function listCards(): Promise<Card[]> {
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records?page_size=100`
  );
  return data.items as Card[];
}

export async function listCopy(): Promise<Card[]> {
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records?page_size=100`
  );
  return data.items as Card[];
}

export async function getAttachmentDownloadUrl(recordId: string, fileToken: string): Promise<string> {
  const data: any = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records/${recordId}/attachments/${fileToken}`
  );
  // API returns either { temp_download_url } or { url } depending on version
  return (data.temp_download_url || data.url || data.download_url) as string;
}

/* ---- Write operations ---- */

export async function updateCardFields(recordId: string, fields: Record<string, any>): Promise<void> {
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records/${recordId}`,
    { method: "PUT", body: { fields } }
  );
}

export async function updateCopyFields(recordId: string, fields: Record<string, any>): Promise<void> {
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records/${recordId}`,
    { method: "PUT", body: { fields } }
  );
}

export async function createCard(fields: Record<string, any>): Promise<{ record_id: string }> {
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records`,
    { method: "POST", body: { fields } }
  );
  return { record_id: data.record.record_id };
}

export async function createCopy(fields: Record<string, any>): Promise<{ record_id: string }> {
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records`,
    { method: "POST", body: { fields } }
  );
  return { record_id: data.record.record_id };
}

export async function deleteCard(recordId: string): Promise<void> {
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records/${recordId}`,
    { method: "DELETE" }
  );
}

export async function deleteCopy(recordId: string): Promise<void> {
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records/${recordId}`,
    { method: "DELETE" }
  );
}

export async function nextAutoNumber(taskId: number): Promise<number> {
  // compute next task_id = max(task_id) + 1 across all cards
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records?page_size=100&fields=task_id`
  );
  let max = 0;
  for (const r of data.items) {
    const v = Number(r.fields.task_id);
    if (v > max) max = v;
  }
  return max + 1;
}

/** Group raw cards into "tasks" (one task_id = one project bundle). */
export interface Task {
  task_id: number;
  project_name: string;
  cards: Card[]; // sorted by 卡号 asc
  copy?: Card;   // optional 小红书文案 record
}

export function groupIntoTasks(graphCards: Card[], copyCards: Card[]): Task[] {
  const byTask = new Map<number, Task>();
  for (const c of graphCards) {
    const tid = Number(c.fields.task_id);
    if (!tid) continue;
    if (!byTask.has(tid)) {
      byTask.set(tid, { task_id: tid, project_name: c.fields.项目名 || "(未命名)", cards: [], copy: undefined });
    }
    byTask.get(tid)!.cards.push(c);
  }
  for (const cp of copyCards) {
    const tid = Number(cp.fields.task_id);
    if (!tid) continue;
    const t = byTask.get(tid);
    if (t) t.copy = cp;
  }
  // sort cards within each task by 卡号
  for (const t of byTask.values()) {
    t.cards.sort((a, b) => String(a.fields.卡号 || "").localeCompare(String(b.fields.卡号 || "")));
  }
  // sort tasks by task_id desc (newest first)
  return [...byTask.values()].sort((a, b) => b.task_id - a.task_id);
}
/**
 * 拿 user_access_token —— Vercel 云端走 env (FEISHU_USER_TOKEN),
 * 本地开发走 lark-cli auth token (exec 调用).
 */
export async function getUserAccessToken(): Promise<string> {
  // 方案 A: 环境变量 (Vercel 云端必须走这条)
  const envToken = process.env.FEISHU_USER_TOKEN;
  if (envToken && envToken.length > 0) return envToken;

  // 方案 B: 本地开发走 lark-cli auth token（直接调子命令拿 access_token JSON）
  try {
    const out = execSync(
      'lark-cli auth token --json 2>/dev/null || lark-cli auth status --json 2>/dev/null',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    const m = out.match(/"user_access_token"\s*:\s*"([^"]+)"/) ||
              out.match(/"access_token"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}

  // 方案 C: 都没有 → 让前端弹「重连飞书」按钮
  throw new Error("user_access_token missing — please click 重新连接按钮");
}

/**
 * 飞书 drive batch_get_tmp_download_url（不需 recordId，用 file_token 直接拿 2 小时有效下载 URL）
 */
export async function getAttachmentTmpUrl(fileToken: string, userToken: string): Promise<string> {
  const resp = await fetch(`${FEISHU_BASE}/drive/v1/medias/batch_get_tmp_download_url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_tokens: [fileToken],
    }),
    cache: "no-store",
  });
  const json: any = await resp.json();
  if (json.code !== 0) throw new Error(`tmp_download_url failed: ${json.code} ${json.msg}`);
  const item = json.data?.tmp_download_urls?.[0];
  if (!item?.tmp_download_url) throw new Error("no tmp_download_url in response");
  return item.tmp_download_url as string;
}
