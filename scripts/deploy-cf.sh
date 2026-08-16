#!/bin/bash
# 用法：./deploy-cf.sh （脚本会 prompt 输入 CF API token，避开 runtime mask）
set -e

WORK_DIR=${WORKER_DEPLOY_DIR:-/System/Volumes/Data/private/tmp/worker-deploy}
ACCOUNT_ID="0d6dc8048f35f5ec2e143bfe4da79f98"
WORKER_NAME="bitable-vault-site"

echo "=== 读 CF API Token（read -s 不显示）==="
read -s CF_TOKEN
echo "len=$(echo -n "$CF_TOKEN" | wc -c)"

cd "$WORK_DIR"

# 拼 multipart body
python3 - << 'PYEOF'
import uuid
b = "----WebKitFormBoundary" + uuid.uuid4().hex
CRLF = b"\r\n"
with open('worker.mjs', 'rb') as f: wb = f.read()
with open('metadata.json', 'rb') as f: mb = f.read()
body = b""
body += (f"--{b}\r\n").encode()
body += b'Content-Disposition: form-data; name="worker.mjs"; filename="worker.mjs"\r\n'
body += b"Content-Type: application/javascript+module\r\n\r\n"
body += wb + CRLF
body += (f"--{b}\r\n").encode()
body += b'Content-Disposition: form-data; name="metadata"; filename="metadata.json"\r\n'
body += b"Content-Type: application/json\r\n\r\n"
body += mb + CRLF
body += (f"--{b}--\r\n").encode()
with open('/tmp/multipart.bin', 'wb') as f: f.write(body)
with open('/tmp/boundary.txt', 'w') as f: f.write(b)
print(f"multipart body: {len(body)} bytes")
PYEOF

BOUNDARY=$(cat /tmp/boundary.txt)

echo ""
echo "=== curl PUT deploy ==="
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: multipart/form-data; boundary=${BOUNDARY}" \
  --data-binary @/tmp/multipart.bin \
  -w "\nHTTP %{http_code}\n" \
  -o /tmp/deploy-result.json

cat /tmp/deploy-result.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('success'):
    r = d['result']
    print(f\"  ✅ modified: {r.get('modified_on')}\")
    print(f\"  etag: {r.get('etag')[:30]}...\")
else:
    print(f\"  ❌ {d.get('errors')}\")
"

echo ""
echo "=== 自查公网 4 端点 ==="
for p in "/" "/api/list" "/auth/login" "/api/save"; do
  case "$p" in
    "/api/save") M="-X POST -H Content-Type:application/json -d {}" ;;
    *) M="" ;;
  esac
  curl -s --resolve "${WORKER_NAME}.yuyangiws.workers.dev:443:198.18.0.9" \
    "https://${WORKER_NAME}.yuyangiws.workers.dev${p}" -w "  $p: HTTP %{http_code}\n" -o /dev/null
done
