#!/bin/bash
# card-studio-stop.sh - 停止 Card Studio 全栈
# 用法: bash scripts/card-studio-stop.sh

pkill -9 -f "feishu-proxy" 2>/dev/null && echo "stopped feishu-proxy" || true
pkill -9 -f "next dev" 2>/dev/null && echo "stopped next dev" || true
pkill -9 -f "next-server" 2>/dev/null && echo "stopped next-server" || true
pkill -9 -f cloudflared 2>/dev/null && echo "stopped cloudflared" || true
echo "done"
