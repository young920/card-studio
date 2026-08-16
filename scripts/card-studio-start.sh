#!/bin/bash
# card-studio-start.sh - 一键启动 Card Studio 本地开发全栈
# 包括: feishu-proxy (7788) + next dev (3000) + cloudflared tunnel (公网)
#
# 用法: bash scripts/card-studio-start.sh
#
# 启动后:
#   本机:    http://localhost:3000
#   公网:    https://<random>.trycloudflare.com (会打印)
#
# 停止:    bash scripts/card-studio-stop.sh

set -e
cd "$(dirname "$0")/.."

# 1. 清理旧进程
echo "[1/5] 清理旧进程..."
pkill -9 -f "feishu-proxy" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f cloudflared 2>/dev/null || true
sleep 2

# 2. 启动 feishu-proxy (Node 常驻, 转发 /open-apis/* 到 lark-cli)
echo "[2/5] 启动 feishu-proxy (port 7788)..."
nohup node scripts/feishu-proxy.mjs > /tmp/feishu-proxy.log 2>&1 &
PROXY_PID=$!
echo "  feishu-proxy PID: $PROXY_PID"
sleep 2

# 验证 proxy
if ! curl -sf http://localhost:7788/health > /dev/null; then
  echo "  ❌ feishu-proxy 启动失败, 看 /tmp/feishu-proxy.log"
  exit 1
fi
echo "  ✓ feishu-proxy OK"

# 3. 启动 next dev (port 3000)
echo "[3/5] 启动 next dev (port 3000)..."
# 清掉 build 残留 (防止 webpack 找不到模块)
rm -rf .next
nohup npm run dev > /tmp/card-studio-dev.log 2>&1 &
DEV_PID=$!
echo "  next dev PID: $DEV_PID"
sleep 6

# 验证 next dev
if ! curl -sf http://localhost:3000/api/health > /dev/null; then
  echo "  ❌ next dev 启动失败, 看 /tmp/card-studio-dev.log"
  tail -20 /tmp/card-studio-dev.log
  exit 1
fi
echo "  ✓ next dev OK"

# 4. 验证数据同步
echo "[4/5] 验证数据同步..."
TASKS=$(curl -s http://localhost:3000/api/tasks 2>&1)
if echo "$TASKS" | grep -q '"ok":true'; then
  COUNT=$(echo "$TASKS" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('tasks',[])))")
  echo "  ✓ 拉到 $COUNT 个 task"
else
  echo "  ❌ 数据拉取失败: $(echo $TASKS | head -c 200)"
fi

# 5. (可选) 起 cloudflared 公网 tunnel
echo "[5/5] 公网 tunnel (可选)..."
PUBLIC_URL_FILE=/tmp/card-studio-public-url.txt
if [ -f "$HOME/.cloudflared/cert.pem" ]; then
  # 有 cert 才起 named tunnel
  echo "  用 named tunnel..."
  nohup ~/.local/bin/cloudflared tunnel --config ~/.cloudflared/config.yml card-studio > /tmp/cf-tunnel.log 2>&1 &
  echo "  named tunnel PID: $!"
else
  # 起 quick tunnel (random hostname, 30 秒握手)
  echo "  起 quick tunnel (30 秒握手)..."
  nohup ~/.local/bin/cloudflared tunnel --url http://localhost:3000 > /tmp/cf-tunnel.log 2>&1 &
  echo "  quick tunnel PID: $!"
fi
sleep 12

URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cf-tunnel.log 2>/dev/null | head -1)
if [ -n "$URL" ]; then
  echo "$URL" > $PUBLIC_URL_FILE
  echo "  ✓ 公网 URL: $URL"
else
  echo "  ⚠ 公网 URL 未生成 (tunnel 30 秒握手失败), 本机仍可用 http://localhost:3000"
fi

echo ""
echo "=== Card Studio 已启动 ==="
echo "  本机:    http://localhost:3000"
[ -n "$URL" ] && echo "  公网:    $URL"
echo ""
echo "  进程:"
echo "    next dev      PID $DEV_PID  log: /tmp/card-studio-dev.log"
echo "    feishu-proxy  PID $PROXY_PID  log: /tmp/feishu-proxy.log"
echo "  停止:    bash scripts/card-studio-stop.sh"
