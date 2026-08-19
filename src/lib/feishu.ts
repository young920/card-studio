/**
 * Feishu Bitable client — Edge Runtime 兼容版
 * 纯 fetch + Uint8Array，无 Node 依赖
 */

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

/* ---- Bitable constants ---- */
export const BITABLE_BASE_TOKEN = process.env.BITABLE_BASE_TOKEN || "BQ3gbOvjPa8tG9sAeRycCJSInrh";
export const TABLE_GRAPHS = process.env.BITABLE_TABLE_GRAPHS || "tblYWFt0cNPvIKb8";
export const TABLE_COPY = process.env.BITABLE_TABLE_COPY || "tblRSEX8K3mvKpix";

/* ---- tenant_access_token ---- */
let _cachedTenantToken: string | null = null;
let _cachedTenantTokenExpiry = 0;

export async function getTenantAccessToken(): Promise<string> {
  if (_cachedTenantToken && Date.now() < _cachedTenantTokenExpiry) {
    return _cachedTenantToken;
  }

  const appId = process.env.FEISHU_APP_ID || "";
  const appSecret = process.env.FEISHU_APP_SECRET || "";

  if (!appId || !appSecret) {
    throw new Error("飞书应用凭证未配置（FEISHU_APP_ID / FEISHU_APP_SECRET）");
  }

  const resp = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    cache: "no-store",
  });
  const json: any = await resp.json();
  if (json.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${json.msg} (code=${json.code})`);
  }

  _cachedTenantToken = json.tenant_access_token;
  _cachedTenantTokenExpiry = Date.now() + 50 * 60 * 1000;
  return _cachedTenantToken!;
}

/* ---- 飞书 API 调用 ---- */
async function feishuApi(method: string, path: string, body?: any): Promise<any> {
  const token = await getTenantAccessToken();
  const resp = await fetch(`${FEISHU_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return resp.json();
}

/* ---- Bitable REST helpers ---- */
async function bitable(path: string, init: { method?: string; body?: any } = {}): Promise<any> {
  const method = init.method || "GET";
  const fullPath = `/bitable/v1${path}`;
  const json: any = await feishuApi(method, fullPath, init.body);
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`Bitable 请求失败: ${json.msg} (code=${json.code})`);
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

/* ---- Group into Tasks ---- */
export interface Task {
  task_id: number;
  project_name: string;
  cards: Card[];
  copy?: Card;
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
  for (const t of byTask.values()) {
    t.cards.sort((a, b) => String(a.fields.卡号 || "").localeCompare(String(b.fields.卡号 || "")));
  }
  return [...byTask.values()].sort((a, b) => b.task_id - a.task_id);
}

/* ---- 附件下载（纯 fetch + ArrayBuffer，Edge 兼容）---- */
export async function getAttachmentBuffer(
  _recordId: string,
  fileToken: string,
  _fileName: string = "attachment.png"
): Promise<ArrayBuffer> {
  const token = await getTenantAccessToken();
  const dlResp = await fetch(
    `${FEISHU_BASE}/drive/v1/medias/batch_get_tmp_download_url`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_tokens: [fileToken] }),
      cache: "no-store",
    }
  );
  const dlJson: any = await dlResp.json();
  if (dlJson.code !== 0) throw new Error(`获取下载链接失败: ${dlJson.msg}`);
  const url = dlJson.data?.tmp_download_urls?.[0]?.tmp_download_url;
  if (!url) throw new Error("下载链接为空");

  const fileResp = await fetch(url);
  if (!fileResp.ok) throw new Error(`下载附件失败: ${fileResp.status}`);
  return fileResp.arrayBuffer();
}

export async function getAttachmentTmpUrl(fileToken: string): Promise<string> {
  const token = await getTenantAccessToken();
  const resp = await fetch(`${FEISHU_BASE}/drive/v1/medias/batch_get_tmp_download_url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_tokens: [fileToken] }),
    cache: "no-store",
  });
  const json: any = await resp.json();
  if (json.code !== 0) throw new Error(`tmp_download_url 失败: ${json.code} ${json.msg}`);
  const item = json.data?.tmp_download_urls?.[0];
  if (!item?.tmp_download_url) throw new Error("下载链接为空");
  return item.tmp_download_url as string;
}

/* ---- multipart 构造（Edge 兼容，Uint8Array 版）---- */
export function buildMultipartBody(
  fields: Record<string, string>,
  fileField: string,
  fileName: string,
  fileData: Uint8Array,
  fileType: string = "application/octet-stream"
): { body: ArrayBuffer; contentType: string } {
  const boundary = "----CardStudio" + Math.random().toString(16).slice(2, 10);
  const encoder = new TextEncoder();
  const CRLF = encoder.encode("\r\n");
  const parts: Uint8Array[] = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(encoder.encode(`--${boundary}\r\n`));
    parts.push(encoder.encode(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
    parts.push(encoder.encode(value));
    parts.push(CRLF);
  }

  parts.push(encoder.encode(`--${boundary}\r\n`));
  parts.push(encoder.encode(
    `Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\n` +
    `Content-Type: ${fileType}\r\n\r\n`
  ));
  parts.push(fileData);
  parts.push(CRLF);
  parts.push(encoder.encode(`--${boundary}--\r\n`));

  // 合并
  let total = 0;
  for (const p of parts) total += p.length;
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    merged.set(p, offset);
    offset += p.length;
  }

  return {
    body: merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export function getAuthRestartHint(): string {
  return "使用应用凭证自动认证，无需手动重连。如数据加载失败，请检查环境变量配置。";
}
