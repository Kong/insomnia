# Test Plan: HTTP Requests & Responses — core@13.0.0-beta.1

**对比基线:** core@12.6.0 → core@13.0.0-beta.1  
**测试范围:** Request URL bar, methods, send/cancel; Headers/params/body editors, request settings, authentication; Request groups/folders; Response pane + response history  
**测试人:** yaoweiprc  
**日期:** 2026-06-15

---

## 一、高风险变更（最可能产生 bug）

### 1. 模板引擎从 Nunjucks 迁移到 LiquidJS (`e038e317f`)

**影响范围：** URL、Headers、Body 中所有使用 `{{ }}` 模板变量渲染的地方。

**测试用例：**
- [ ] 在 URL 中使用环境变量 `{{ _.variable }}` 是否正常渲染
- [ ] 在 Headers 中使用环境变量
- [ ] 在 Body 中使用环境变量
- [ ] 嵌套变量（变量的值本身也包含模板标签）
- [ ] 模板标签语法错误时的错误提示
- [ ] 使用 `{% if %}` / `{% for %}` 等 liquid 语法
- [ ] **回归：** 原来 Nunjucks 的 `{{ variable | filter }}` 类语法还能否正常工作

### 2. User-Agent 默认处理机制重构 (`b81957245`)

**影响范围：** 新建请求不再自动携带 `User-Agent` header，改为 read-only 行显示并可 toggle 禁用。

**测试用例：**
- [ ] 新建 HTTP 请求：不再自动添加 `User-Agent` header 到 headers 列表
- [ ] 新建 WebSocket 请求：同上
- [ ] 新建 Socket.IO 请求：同上
- [ ] Headers 面板中出现一个 read-only 的 `User-Agent: insomnia/<version>` 行，带复选框可禁用
- [ ] 勾选禁用后发送请求，抓包确认请求中**不携带** User-Agent
- [ ] 启用状态下发送请求，抓包确认 User-Agent 正确
- [ ] 用户手动添加自定义 `User-Agent` header → read-only 行消失
- [ ] 用户删除自定义 `User-Agent` header → read-only 行重新出现但**默认禁用**（不会静默发送）
- [ ] **回归：** 已有的旧请求如果手动设置了 User-Agent，行为是否正确

### 3. nodeIntegration 禁用 + IoC Runtime 重构 (`79c544238`, `af0001c13`, `002ae2f9f`)

**影响范围：** 所有网络请求执行路径从直接调用 Node.js API 改为通过 IPC Bridge。

**测试用例：**
- [ ] 正常发送 GET 请求
- [ ] 正常发送 POST 请求（JSON body）
- [ ] 正常发送 PUT 请求
- [ ] 正常发送 DELETE 请求
- [ ] 正常发送 PATCH 请求
- [ ] 请求取消（Cancel）功能
- [ ] 请求超时处理
- [ ] 文件上传（multipart/form-data）
- [ ] 下载响应（Send and Download）
- [ ] 延迟发送（Send After Delay）
- [ ] 重复发送（Repeat on Interval）
- [ ] Copy as cURL（现在通过 `window.main.exportHarRequest` + `window.main.generateCodeSnippet` IPC）
- [ ] Generate Code（生成代码片段）

### 4. 继承文件夹认证修复 (`26020af10`)

**影响范围：** OAuth2 请求使用继承自父文件夹的认证。

**代码变更细节：**
- `getOrInheritAuthentication` 之前对 requestGroups 做 `.reverse().find()`，现在直接 `.find()`
- 假设列表已经是 leaf-to-root 顺序

**测试用例：**
- [ ] 文件夹设置 OAuth2 认证 → 子请求设置为 "Inherit from parent" → 发送请求确认使用文件夹认证
- [ ] 多层嵌套文件夹：认证应从**最近的**父文件夹继承（不是最远的）
- [ ] 文件夹设置 Basic Auth → 子请求 inherit → 正确继承
- [ ] 文件夹设置 Bearer Token → 子请求 inherit → 正确继承
- [ ] 子文件夹覆盖父文件夹认证 → 请求 inherit → 应使用子文件夹的认证

### 5. `getOrInheritHeaders` 修改

**代码变更：** `[...requestGroups.reverse(), request]` → `[...requestGroups].reverse().concat(request)`

**测试用例：**
- [ ] 文件夹设置了 Headers → 子请求也设置了同名 Header → 最终发送的是子请求的值（子请求优先）
- [ ] 多层文件夹 Headers 叠加/覆盖行为
- [ ] 文件夹 Header 禁用时不应被继承

---

## 二、中等风险变更

### 6. Body Editor MIME 类型查找缩减 (`body-editor.tsx`)

**变更：** 从完整的 `mime-types` 库的 `lookup()` 函数改为仅支持 9 种扩展名的硬编码映射：
```
json → application/json
xml → application/xml
txt → text/plain
html → text/html
png → image/png
jpg → image/jpeg
jpeg → image/jpeg
gif → image/gif
pdf → application/pdf
```

**测试用例：**
- [ ] File Body：选择 `.json` 文件 → Content-Type 设为 `application/json`
- [ ] File Body：选择 `.xml` 文件 → Content-Type 设为 `application/xml`
- [ ] File Body：选择 `.png` 文件 → Content-Type 设为 `image/png`
- [ ] File Body：选择 `.pdf` 文件 → Content-Type 设为 `application/pdf`
- [ ] **Bug:** 选择 `.yaml` 文件 → Content-Type 应为 `application/x-yaml` 但现在会回退到 `application/octet-stream`
- [ ] **Bug:** 选择 `.css` 文件 → 不再识别
- [ ] **Bug:** 选择 `.js` 文件 → 不再识别
- [ ] **Bug:** 选择 `.svg` 文件 → 不再识别
- [ ] **Bug:** 选择 `.zip` 文件 → 不再识别

### 7. 下载响应时文件扩展名始终为 `.unknown` (`send.tsx`)

**变更：** 移除了 `mimeExtension` 调用，当没有 Content-Disposition header 时，文件名总是以 `.unknown` 结尾。

**测试用例：**
- [ ] "Download After Send"：服务器返回 JSON（无 Content-Disposition）→ 文件被保存为 `request-name.unknown`（之前是 `.json`）
- [ ] "Download After Send"：服务器返回图片（无 Content-Disposition）→ 文件被保存为 `.unknown`（之前是 `.png`）
- [ ] "Download After Send"：服务器返回带 Content-Disposition header → 文件名正确（此路径无变化）
- [ ] **这是一个明确的回归/功能降级，可作为 bug 报告**

### 8. Response History Dropdown 异步加载 (`response-history-dropdown.tsx`)

**变更：** `decompressObject` 改为异步 `services.requestVersion.getRequest()`，使用 `useEffect` + `useState`。

**测试用例：**
- [ ] 打开 Response History dropdown → 历史列表能正确显示每个响应的请求方法/URL
- [ ] 快速切换不同请求 → 历史列表无错乱（有竞态条件保护 `cancelled` flag）
- [ ] 删除单条历史响应
- [ ] 删除全部历史响应
- [ ] 切换到历史响应后查看其详细内容

### 9. Response Pane Timeline 异步加载 (`response-pane.tsx`)

**变更：** `getTimeline` 从同步改为 `useEffect` + `useState` 异步加载。

**测试用例：**
- [ ] 发送请求后查看 Timeline 面板是否正常显示
- [ ] 切换不同请求时 Timeline 是否正确更新（不显示上一个请求的 timeline）
- [ ] 无响应时 Timeline 面板为空

### 10. Key-Value Editor Grid 布局重构 (`f035abb8d`, `b81957245`)

**测试用例：**
- [ ] Headers 编辑器中各列对齐是否正常
- [ ] Parameters 编辑器的列对齐
- [ ] Read-only 行（如 Accept、Host、User-Agent）的视觉样式正确
- [ ] 拖拽排序 Header 是否正常
- [ ] 拖拽排序 Parameter 是否正常
- [ ] Bulk Edit 模式切换

---

## 三、请求组/文件夹相关

### 11. 新侧边栏实现 (`d1f039bf1`) + 拖拽重排扩展 (`debug.reorder.tsx`)

**变更：** 全新侧边栏 + 拖拽支持在 workspace 之间移动。

**测试用例：**
- [ ] 新建文件夹
- [ ] 删除文件夹
- [ ] 重命名文件夹
- [ ] 复制文件夹（Duplicate）
- [ ] 拖拽请求到不同文件夹
- [ ] 拖拽请求到 workspace 根级（现在支持 `targetId` 为 workspaceId）
- [ ] 拖拽文件夹重排序
- [ ] **新功能：** 拖拽 workspace 到不同 project（reorder 路由现在支持 workspace → project 的移动）
- [ ] 右键菜单打开/关闭正常
- [ ] 展开/折叠文件夹

### 12. RequestGroupActionsDropdown 接口变更

**变更：** `activeProject` 和 `activeWorkspace` 改为 props 传入而非从 loader 获取；`triggerRef` 变为可选；图标从 `caret-down` 改为 `ellipsis`。

**测试用例：**
- [ ] 文件夹右键菜单 → 新建 HTTP 请求
- [ ] 文件夹右键菜单 → 新建 GraphQL 请求
- [ ] 文件夹右键菜单 → 新建 WebSocket 请求
- [ ] 文件夹右键菜单 → 新建 Event Stream
- [ ] 文件夹右键菜单 → 新建子文件夹
- [ ] 文件夹右键菜单 → 复制
- [ ] 文件夹右键菜单 → 删除
- [ ] 文件夹右键菜单 → 设置
- [ ] 插件相关的 action 按钮（如果有插件安装的话）

### 13. RequestActionsDropdown 变更

**变更：** `copyAsCurl` 通过 IPC 导出 HAR（`window.main.exportHarRequest`）；不再需要 `activeEnvironment` prop。

**测试用例：**
- [ ] 右键请求 → Copy as cURL → 剪贴板中的 curl 命令正确
- [ ] 右键请求 → Duplicate
- [ ] 右键请求 → Generate Code
- [ ] 右键请求 → Pin/Unpin
- [ ] 右键请求 → Delete
- [ ] 右键请求 → Settings
- [ ] 右键请求 → Open in New Tab
- [ ] 右键请求 → Rename

---

## 四、已发现的潜在 Bug

| # | 严重度 | 描述 | 相关文件 | 相关 Commit |
|---|--------|------|----------|-------------|
| 1 | **高** | 下载响应文件时扩展名始终为 `.unknown`（无 Content-Disposition 时），之前会根据 Content-Type 推断正确扩展名 | `send.tsx` L315 | `f36e1a840` (Remove mime-types) |
| 2 | **中** | Body Editor 选择文件时，`.yaml/.yml/.css/.js/.svg/.mp4/.zip` 等常见类型不再正确识别 MIME type，硬编码只有 9 种 | `body-editor.tsx` | `f36e1a840` |
| 3 | **中** | 删除自定义 User-Agent header 后 `disableUserAgentHeader` 被设为 true，如果用户后来又想要默认 User-Agent，需要通过 read-only 行的 checkbox 重新启用（交互是否清晰？） | `request-headers-editor.tsx` | `b81957245` |
| 4 | **低** | Response plugin hook 失败时错误信息不再包含插件名（`plugin=${err.plugin?.name}` → `err=${err.message}`） | `network.ts` | IoC refactor |

---

## 五、测试执行顺序建议

1. **第一轮（Smoke）：** 基本发送 GET/POST、查看响应、切换历史响应
2. **第二轮（User-Agent）：** 重点测试新/旧请求的 User-Agent 行为
3. **第三轮（模板变量）：** URL / Header / Body 中使用环境变量（Liquid 引擎）
4. **第四轮（文件夹继承）：** Auth + Headers 继承链（多层嵌套）
5. **第五轮（文件操作）：** File body MIME type、Download After Send 文件扩展名
6. **第六轮（侧边栏）：** 拖拽排序、新建/删除/复制文件夹
7. **第七轮（边缘场景）：** 请求取消、超时、延迟发送、重复发送

---

## 六、关键 Commits 索引

| Commit | 标题 | 风险等级 |
|--------|------|----------|
| `e038e317f` | feat: migrate templating engine from Nunjucks to LiquidJS | 高 |
| `b81957245` | feat: user-agent default handling for v13 | 高 |
| `79c544238` | feat: disable nodeIntegration in renderer mainWindow | 高 |
| `26020af10` | Fix inherited folder auth not applied correctly for OAuth2 requests | 高 |
| `af0001c13` | refactor(runtime): extend IoC runtime to 3 new capabilities | 高 |
| `f36e1a840` | Remove heavyweight third-party imports: mime-types, tough-cookie... | 中 |
| `f035abb8d` | fix(ui): align header editors using grid | 中 |
| `d1f039bf1` | feat: New navigation sidebar | 中 |
| `4bc34bba9` | fix: remove Buffer class usage in renderer code | 中 |
| `7cd8854f2` | feat: lift network.ts fs/path behind window.main.timeline IPC bridge | 中 |
