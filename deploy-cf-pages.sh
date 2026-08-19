#!/bin/bash
# 一键部署 Card Studio 到 Cloudflare Pages
# 用法: ./deploy-cf-pages.sh <CLOUDFLARE_API_TOKEN>
# 前置: npm install 已完成

set -e

if [ -z "$1" ]; then
  echo "用法: $0 <CLOUDFLARE_API_TOKEN>"
  echo "Token 需要 Pages:Edit 权限"
  exit 1
fi

CF_TOKEN="$1"
PROJECT_NAME="card-studio"

echo "=== Step 1: 构建 Next.js (Cloudflare Pages 模式) ==="
npx @cloudflare/next-on-pages

echo ""
echo "=== Step 2: 部署到 Cloudflare Pages ==="
CLOUDFLARE_API_TOKEN="$CF_TOKEN" npx wrangler pages deploy .vercel/output/static \
  --project-name="$PROJECT_NAME" \
  --compatibility-date=2024-11-20 \
  --branch=main

echo ""
echo "=== Step 3: 配置环境变量 ==="
echo "部署成功后，请到 Cloudflare Pages 控制台 -> card-studio -> Settings -> Environment variables 添加："
echo "  - FEISHU_APP_ID"
echo "  - FEISHU_APP_SECRET"
echo "  - BITABLE_BASE_TOKEN (已在 wrangler.toml 默认值)"
echo "  - BITABLE_TABLE_GRAPHS (已在 wrangler.toml 默认值)"
echo "  - BITABLE_TABLE_COPY (已在 wrangler.toml 默认值)"
echo ""
echo "添加后重新部署一次生效。"
