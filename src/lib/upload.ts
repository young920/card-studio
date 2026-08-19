/**
 * 飞书分片上传 — 通过 /api/upload/chunk 代理分片转发
 * 每片 ~1MB < Vercel 4.5MB 限制，大文件也能传
 * 有原生 XHR 进度回调
 */

const CHUNK_SIZE = 1024 * 1024; // 1MB 一片

export interface UploadOptions {
  file: File;
  parentType: "bitable_image" | "bitable_file";
  onProgress?: (percent: number) => void;
}

export async function uploadToFeishu(opts: UploadOptions): Promise<string> {
  const { file, parentType, onProgress } = opts;

  // 1. 初始化，拿 upload_id + upload_url
  const initResp = await fetch("/api/upload/chunk?init=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: file.name,
      parent_type: parentType,
      size: file.size,
    }),
  });
  const init = await initResp.json();
  if (!init.ok) throw new Error(init.error || "上传初始化失败");

  const uploadId = init.upload_id;
  // 必须用飞书返回的 block_size，不能自己改大小，否则飞书报 size 不一致
  const chunkSize = init.block_size || 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  const etags: string[] = [];

  onProgress?.(2);

  // 2. 逐片通过代理上传到飞书（按飞书指定的 block_size 切）
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const fd = new FormData();
    fd.append("file", chunk, `part_${i}`);

    const etag = await uploadChunkWithProgress(
      `/api/upload/chunk?upload_id=${encodeURIComponent(uploadId)}&seq=${i}`,
      fd,
      (chunkProgress) => {
        const overall = 2 + ((i + chunkProgress) / totalChunks) * 96;
        onProgress?.(overall);
      }
    );
    etags.push(etag);
  }

  // 3. 完成上传，拿 file_token（对齐 lark-cli：传 block_num）
  const finishResp = await fetch("/api/upload/chunk?finish=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_id: uploadId,
      file_name: file.name,
      parent_type: parentType,
      block_num: totalChunks,
    }),
  });
  const finish = await finishResp.json();
  if (!finish.ok) throw new Error(finish.error || "上传完成失败");

  onProgress?.(100);
  return finish.file_token;
}

/** 单分片上传 + 进度 */
function uploadChunkWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total);
      }
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.ok) {
          resolve(json.etag || "");
        } else {
          reject(new Error(json.error || "分片上传失败"));
        }
      } catch {
        reject(new Error("分片上传响应解析失败: " + xhr.responseText.slice(0, 120)));
      }
    };

    xhr.onerror = () => reject(new Error("分片上传网络错误"));
    xhr.send(formData);
  });
}

/**
 * 从视频文件截取第一帧作为封面图
 * 返回 base64 编码的 PNG
 */
export async function extractVideoCover(file: File, seekSeconds: number = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      // 跳到指定时间
      try {
        video.currentTime = Math.min(seekSeconds, video.duration * 0.1);
      } catch {
        video.currentTime = 0;
      }
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const w = video.videoWidth;
      const h = video.videoHeight;
      // 限制宽度 480，生成小图，传得快
      const scale = Math.min(1, 480 / w);
      canvas.width = Math.floor(w * scale);
      canvas.height = Math.floor(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 不可用"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(video.src);
      resolve(dataUrl);
    };

    video.onerror = () => reject(new Error("视频加载失败"));
    video.src = URL.createObjectURL(file);
  });
}

/** base64 dataURL 转 File */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}
