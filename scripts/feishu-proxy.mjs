#!/usr/bin/env node
/**
 * feishu-proxy server
 * Listen on 0.0.0.0:7788, forward any /open-apis/* path to lark-cli as bot.
 * This lets remote services (e.g. Vercel cloud) reach Feishu through our local lark-cli,
 * which holds the appSecret in macOS Keychain (we can't access it directly).
 */
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 7788);
const HOST = "0.0.0.0";

const server = createServer(async (req, res) => {
  const ts = new Date().toISOString().slice(11, 19);
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname + url.search;

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, mode: "feishu-proxy", port: PORT, ts }));
      return;
    }

    // Only forward /open-apis/* to lark-cli
    if (!url.pathname.startsWith("/open-apis/")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not found (only /open-apis/* proxied)" }));
      return;
    }

    // Read body
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    await new Promise((resolve) => req.on("end", resolve));

    // Build lark-cli command
    const identity = req.headers["x-feishu-identity"] === "user" ? "user" : "bot";
    const dataArg = body ? ` --data '${body.replace(/'/g, "'\\''")}'` : "";
    const cmd = `lark-cli api ${req.method} "${path}"${dataArg} --as ${identity} --json`;

    console.log(`[${ts}] ${req.method} ${path} (as ${identity}, body=${body.length}b)`);

    const out = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024,
    });

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(out);
  } catch (e) {
    console.error(`[${ts}] ERROR:`, e.message?.slice(0, 200) || e);
    res.writeHead(500, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ ok: false, error: e.message?.slice(0, 500) || String(e) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`feishu-proxy listening on http://${HOST}:${PORT}`);
});
