/**
 * Feishu Bitable client.
 * App credentials: 本地走 .env.local, Vercel 云端走 dashboard 环境变量.
 * 这样部署后能直接跑, 不依赖 macOS Keychain.
 */

export function getAppCredentials() {
  const appId = process.env.FEISHU_APP_ID || "";
  const appSecret = process.env.FEISHU_APP_SECRET || "";
  return { appId, appSecret };
}

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

export async function getTenantAccessToken(): Promise<string> {
  const { appId, appSecret } = getAppCredentials();
  if (!appId || !appSecret) throw new Error("Missing feishu app credentials in Keychain");

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

/* ---- Bitable constants (the user's vault) ---- */
export const BITABLE_BASE_TOKEN = process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh";
export const TABLE_GRAPHS = process.env.BITABLE_TABLE_GRAPHS || "tblYWFt0cNPvIKb8"; // 信息图库
export const TABLE_COPY = process.env.BITABLE_TABLE_COPY || "tblRSEX8K3mvKpix"; // 小红书文案库

/* ---- Bitable REST helpers ---- */
async function bitable(path: string, token: string, init: RequestInit = {}) {
  const resp = await fetch(`${FEISHU_BASE}/bitable/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const json: any = await resp.json();
  if (json.code !== 0) {
    throw new Error(`Bitable ${path} failed: ${json.code} ${json.msg}`);
  }
  return json.data;
}

export interface Card {
  record_id: string;
  fields: Record<string, any>;
}

export async function listCards(): Promise<Card[]> {
  const token = await getTenantAccessToken();
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records?page_size=100`,
    token
  );
  return data.items as Card[];
}

export async function listCopy(): Promise<Card[]> {
  const token = await getTenantAccessToken();
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records?page_size=100`,
    token
  );
  return data.items as Card[];
}

export async function getAttachmentDownloadUrl(recordId: string, fileToken: string): Promise<string> {
  const token = await getTenantAccessToken();
  const data: any = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records/${recordId}/attachments/${fileToken}`,
    token
  );
  // API returns either { temp_download_url } or { url } depending on version
  return (data.temp_download_url || data.url || data.download_url) as string;
}

/* ---- Write operations ---- */

export async function updateCardFields(recordId: string, fields: Record<string, any>): Promise<void> {
  const token = await getTenantAccessToken();
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records/${recordId}`,
    token,
    { method: "PUT", body: JSON.stringify({ fields }) }
  );
}

export async function updateCopyFields(recordId: string, fields: Record<string, any>): Promise<void> {
  const token = await getTenantAccessToken();
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records/${recordId}`,
    token,
    { method: "PUT", body: JSON.stringify({ fields }) }
  );
}

export async function createCard(fields: Record<string, any>): Promise<{ record_id: string }> {
  const token = await getTenantAccessToken();
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records`,
    token,
    { method: "POST", body: JSON.stringify({ fields }) }
  );
  return { record_id: data.record.record_id };
}

export async function createCopy(fields: Record<string, any>): Promise<{ record_id: string }> {
  const token = await getTenantAccessToken();
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records`,
    token,
    { method: "POST", body: JSON.stringify({ fields }) }
  );
  return { record_id: data.record.record_id };
}

export async function deleteCard(recordId: string): Promise<void> {
  const token = await getTenantAccessToken();
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records/${recordId}`,
    token,
    { method: "DELETE" }
  );
}

export async function deleteCopy(recordId: string): Promise<void> {
  const token = await getTenantAccessToken();
  await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_COPY}/records/${recordId}`,
    token,
    { method: "DELETE" }
  );
}

export async function nextAutoNumber(taskId: number): Promise<number> {
  // compute next task_id = max(task_id) + 1 across all cards
  const token = await getTenantAccessToken();
  const data = await bitable(
    `/apps/${BITABLE_BASE_TOKEN}/tables/${TABLE_GRAPHS}/records?page_size=100&fields=task_id`,
    token
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
 * 拿 user_access_token —— 优先从 macOS Keychain 读 card-studio-feishu-user-token，
 * 否则调 lark-cli 内置 token（通过 exec 调用），最后 fallback 跑 lark-cli auth token 子命令。
 */
export async function getUserAccessToken(): Promise<string> {
  // 方案 A: Keychain
  try {
    const v = execSync(
      'security find-generic-password -a "card-studio-feishu" -s "card-studio-feishu-user-token" -w',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (v) return v;
  } catch {}

  // 方案 B: lark-cli auth token（直接调子命令拿 access_token JSON）
  try {
    const out = execSync(
      'lark-cli auth token --json 2>/dev/null || lark-cli auth status --json 2>/dev/null',
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    // 试图从 output 抽 access_token / user_access_token
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
