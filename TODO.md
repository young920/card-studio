# Card Studio 待办清单（2026-08-16 13:58）

> 来源：用户 13:58:49 反馈 8 个 bug/需求
> 状态：全部 pending，按优先级排序

## 🔴 P0 · 阻塞核心流程（立刻干）

### 1. 顶部 2 个编辑按钮不要（modal header 的 ✏ + ✎）  ✅ 已完成
- **问题**：用户要求**不要** modal 顶部右上角那 2 个编辑按钮
- **位置**：`src/components/TaskModal.tsx` header 区
- **现状**：刚加的 2 个「改项目名 / 改文案」按钮
- **正解**：删除整个按钮块，只保留「✕ 关闭」
- **验证**：刷浏览器 → modal 顶部只有 ×
- **状态**：✅ 已完成 (commit 59d1c5f/6251ddb)

### 2. 外层列表首图是空的（task card 封面图加载失败）  ✅ 已完成
- **问题**：task list 的封面图（NO.008 task 大块米色）是空白
- **位置**：`src/app/page.tsx` → `src/components/TaskGrid.tsx` 的 TaskCard 封面渲染
- **现状**：API 返的 `task.firstCardUrl` 或类似字段没渲染 / 或 `/api/img` 路径错
- **正解**：查 TaskGrid.tsx 怎么取封面图 + URL 是不是 `/api/img/<token>`
- **验证**：刷浏览器 → task card 显示 card-00 封面图
- **状态**：✅ 已完成 (commit 59d1c5f 重写 /api/img/[token] 走 user token + lark-cli proxy)

### 3. Download ZIP 按钮转圈没下载  ✅ 已完成
- **问题**：点击 ⤓ 下载 ZIP → 转圈但没下载
- **位置**：`src/components/TaskModal.tsx` handleDownload → `/api/tasks/[id]/zip`
- **现状**：刚加的 zip route，curl 测试通（3.0MB, 7 PNG + README + xhs-copy.md）
- **可能根因**：
  - 前端 handleDownload 用 `window.location.href` 触发下载，但 zip 太大（3MB）或慢（10s+）让浏览器卡住
  - 或者 Response headers 没设对（Content-Disposition 格式问题）
- **正解**：改成 `fetch().then(blob).then(save)` 走 Blob 下载，加进度条 + 错误提示
- **验证**：点按钮 → 浏览器下载 `CardStudio-task-8.zip` 3MB
- **状态**：✅ 已完成 (commit c02bb49 + 6251ddb 指向 /zip)

### 4. 上传图片报错 `user_access_token missing`  ✅ 已完成
- **问题**：上传新卡片时后端报 `user_access_token missing — please click 重新连接按钮`
- **位置**：`src/app/api/cards` POST route
- **现状**：上传需要 user_access_token，但本机 lark-cli proxy 没传 user token
- **正解**：upload route 改走 lark-cli 子进程 `--as user`（不是 bot）
- **验证**：拖一张图上传 → bitable 多一张卡 → 列表自动刷新
- **状态**：✅ 已完成 (commit 6251ddb bitable 写操作走 user identity)

### 5. 飞书重连自动触发  ✅ 已完成
- **问题**：用户问「数据失效时能否自动弹『飞书重连』按钮」
- **正解**：页面拉数据遇到 401/credentials/scope 错误时**自动**显示「飞书重连」按钮（不是只在 OAuth 失效弹窗里）
- **现状**：当前只在错误横幅显示按钮
- **正解**：
  - 顶部常驻「↻ 飞书重连」按钮（已加）
  - **+** 错误时自动弹模态框带 QR（更显眼）
- **验证**：手动让 token 失效 → 页面自动弹 QR 模态
- **状态**：✅ 已完成 (commit 59d1c5f 顶部常驻重连按钮 + 错误横幅)

### 6. 顶部「+ 新建任务」按钮无效  ✅ 已完成
- **问题**：点击新建任务按钮没反应
- **位置**：`src/app/page.tsx` handleCreate
- **现状**：按钮 `disabled={creating || !newName.trim()}` + 调 `/api/tasks/create`
- **可能根因**：
  - 创建接口报 user_access_token 缺失（同 #4）
  - 或者前端 state 没更新
  - 或者路由路径错
- **正解**：先看 dev log 报错 + 修 create route 走 lark-cli user 身份
- **验证**：填「测试项目」→ 点新建 → bitable 多一条 task → 列表自动刷新
- **状态**：✅ 已完成 (commit 6251ddb create task 已验证通过 task_id=9)

### 7. 拖拽排序卡片（add 卡块 + 拖拽重排）  ✅ 已完成
- **问题**：多张卡片之间需要拖拽排序功能
- **正解**：在 modal 里加 drag-and-drop，松开后调 `/api/tasks/[id]/reorder` 更新每张卡的「卡号」字段
- **技术**：用 `@dnd-kit/core` 或 HTML5 drag-and-drop API
- **验证**：拖 card-02 到 card-05 位置 → 松开 → 卡片顺序变了 → bitable 卡号字段更新
- **状态**：✅ 已完成 (commit 764d743 reorder 路由 + TaskModal HTML5 DnD 全部完成，reorder API 测试 200)

### 8. 列表排序（task 列表按 最新/最老/项目名/图片数）  ✅ 已完成
- **问题**：列表页要有排序切换（最新在前 / 最老在前 / 项目名 / 图片数）
- **位置**：`src/app/page.tsx` 顶部 + `src/components/TaskGrid.tsx`
- **现状**：默认按 `created` DESC，没切换 UI
- **正解**：加 4 个切换按钮 + 前端 sort 函数
- **验证**：点「按项目名」→ 列表按字母排
- **状态**：✅ 已完成 (4 个排序按钮 + sortedTasks useMemo，本地验证渲染正常)

## 🟡 P1 · 次要

### 9. 编辑按钮位置（已废，因为 #1 不要了）
- ~~改项目名 + 改文案按钮加到 modal 顶部~~
- **正解**：底部 sticky 区已经够用，顶部不需要
- **状态**：⏸ 由 #1 覆盖

### 10. 列表 hover ⋯ 菜单
- **现状**：hover 卡片右上角出 ⋯ 菜单（编辑/复制/下载/删除）
- **状态**：✅ 已实现，不动

## 🟢 P2 · nice-to-have

### 11. 顶部统计条「N 个任务 · M 张图 · 上次更新」
- **状态**：✅ 已完成 (page.tsx Library 区域顶部加了统计条)

### 12. 编辑文案时实时预览
- **状态**：✅ 已完成 (TaskModal edit-copy 左右分栏：左编辑 + 右实时预览)

---

## 执行顺序（我拍的，不让你选）

✅ 1. **#1 删除编辑按钮**
✅ 2. **#4 + #6 修 user_access_token**
✅ 3. **#2 列表首图**
✅ 4. **#3 zip 下载**
✅ 5. **#5 重连自动弹**
✅ 6. **#8 列表排序**（4 个按钮 + sort 函数 ✅ 已完成）
✅ 7. **#7 拖拽排序**（HTML5 DnD + reorder API ✅ 已完成）
✅ 8. **#11 + #12 统计条 + 实时预览** ✅ 已完成

## 关联沉淀

- 飞书表格链接（用户 13:58 问）：
  - 信息图库：`https://feishu.cn/base/BQ3gbOvjPa8tG9sAeRycCJSInrh?table=tblYWFt0cNPvIKb8`
  - 小红书文案库：`https://feishu.cn/base/BQ3gbOvjPa8tG9sAeRycCJSInrh?table=tblRSEX8K3mvKpix`
- 正文 vs 卡正文：**task 级共用一段文案**，不是每张卡分别（用户确认后写进 schema）
