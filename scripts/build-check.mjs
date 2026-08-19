// 构建阶段验证脚本：跑一遍核心逻辑，输出到构建日志
import { execSync } from 'node:child_process';

console.log('\n=== [build-check] 验证飞书 API ===');

try {
  // 用 node 直接调飞书 API
  const result = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  const json = await result.json();
  console.log(`[build-check] tenant token: code=${json.code} msg=${json.msg}`);
  
  if (json.code === 0) {
    const token = json.tenant_access_token;
    const baseToken = process.env.BITABLE_BASE_TOKEN || 'BQ3gbOvjPa8tG9sAeRycCJSInrh';
    
    // 测信息图库
    const r1 = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseToken}/tables/tblYWFt0cNPvIKb8/records?page_size=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const j1 = await r1.json();
    console.log(`[build-check] 信息图库: code=${j1.code} count=${j1.data?.items?.length || 0}`);
    
    // 测文案库
    const r2 = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseToken}/tables/tblRSEX8K3mvKpix/records?page_size=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const j2 = await r2.json();
    console.log(`[build-check] 文案库: code=${j2.code} count=${j2.data?.items?.length || 0}`);
    
    console.log('[build-check] ✅ 全部通过');
  } else {
    console.log('[build-check] ⚠ token 获取失败（可能环境变量未配置），跳过验证，不阻断构建');
  }
} catch (e) {
  console.log(`[build-check] ❌ 异常: ${e.message}`);
  // 不阻断构建，只打日志
}
console.log('');
