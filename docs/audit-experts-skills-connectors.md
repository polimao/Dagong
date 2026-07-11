# 专家 / 专家团 / 技能 / 连接器 代码审查报告

> 审查日期：2026-07-09
> 审查范围：`expert-team-store` + 专家团视图、技能（plugins/skill）面板、连接器（MCP）面板与 Settings 编辑器
> 审查方式：只读代码探索（架构、数据流、类型安全、i18n、错误处理、可访问性、性能、死代码）

## 问题总览

| 模块 | Bug | 优化 | 小问题 | 合计 |
|------|-----|------|--------|------|
| 专家与专家团 | 5 | 10 | 6 | 21 |
| 技能（Skill） | 4 | 3 | 10 | 17 |
| 连接器（MCP） | 6 | 8 | 4 | 18 |
| **合计** | **15** | **21** | **20** | **56** |

---

## 一、专家与专家团

### Bug

#### E-B1 ｜ 启动协作失败时，collaborationContext 错误绑定到旧线程
- 文件：`src/renderer/src/components/expert-team/ExpertDetailModal.tsx:18-46`；`TeamDetailModal.tsx:34-63`
- `handleStart` 先 `onClose()` 再 `await createThread()`。`createThread` 失败时内部 catch 不抛出，也不清除 `activeThreadId`。后续读取 `useChatStore.getState().activeThreadId` 拿到的是**上一个线程 ID**，于是把当前专家的协作上下文错误地绑到了旧线程上。
- 影响：旧线程会显示不属于自己的专家 badge，发消息时被误导。
- 修复：把 `onClose()` 移到 `createThread` 成功之后；或让 `createThread` 返回新线程 ID。

#### E-B2 ｜ Modal 的 catch 块是死代码，错误永不在 Modal 内展示
- 文件：`ExpertDetailModal.tsx:42-45`；`TeamDetailModal.tsx:59-62`
- `createThread` 内部 catch 所有异常不 re-throw，外层 `try/catch` 的 `setError`/`setLaunching(false)` 永不执行。错误只能在跳转到 chat 后通过 store 的 `error` 状态看到，Modal 内无任何失败反馈。
- 修复：调用前检查 `runtimeConnection === 'ready'`；或让 `createThread` 返回成功/失败状态。

#### E-B3 ｜ collaborationContext 在线程切换后未清除，badge 错误持续显示
- 文件：`src/renderer/src/components/chat/FloatingComposer.tsx:2160`
- FloatingComposer 仅判断 `collaborationContext ?` 就显示 badge，**未校验 `collaborationContext.threadId === activeThreadId`**；`selectThread` 也不清除该上下文。
- 场景：启动专家协作（thread A）→ 切到 thread B → badge 仍显示，发消息时误导用户。
- 修复：渲染前加 `collaborationContext.threadId === activeThreadId` 判断；或在 `selectThread` 中清除上下文。

#### E-B4 ｜ Modal 缺少 Escape 键关闭
- 文件：`ExpertDetailModal.tsx`、`TeamDetailModal.tsx`
- 仅支持点击背景关闭，未注册 `keydown` 监听 Escape。不符合 WAI-ARIA Dialog 模式。
- 修复：`useEffect` 注册 `keydown` → `Escape` → `onClose()`。

#### E-B5 ｜ Modal 缺少 role/aria 与焦点管理
- 文件：`ExpertDetailModal.tsx`、`TeamDetailModal.tsx`
- 缺 `role="dialog"`、`aria-modal`、`aria-labelledby`；打开未移入焦点、关闭未归还焦点、背景未 `aria-hidden`。
- 修复：补全 ARIA 属性 + 焦点陷阱/归还。

### 优化

#### E-O1 ｜ 大量硬编码中文，几乎不走 i18n
- 文件：`ExpertTeamView.tsx`、`ExpertLibraryTab.tsx`、`ExpertTeamsTab.tsx`、`ExpertDetailModal.tsx`、`TeamDetailModal.tsx`、`parts.tsx`、`FloatingComposer.tsx:2164-2176`
- 仅 `ExpertTeamView` 标题与侧边栏 `t('experts')` 走 i18n，其余（"专家 ({n})"、"搜索专家…"、"简介"、"擅长领域"、"开始协作"、"正在准备…"、"专家团"、"成员 N" 等）全部硬编码。
- 修复：补 i18n key 到 `zh/en/common.json`。

#### E-O2 ｜ parts.tsx 中 7 个组件从未被使用（死代码）
- 文件：`src/renderer/src/components/expert-team/parts.tsx`
- `Stat`、`Section`、`CategoryChip`、`RatingBadge`、`UsageText`、`PrimaryButton`、`SecondaryButton` 从未被导入；`formatUsed`（store:585）仅被未使用的 `UsageText` 调用。
- 修复：删除，或标注预留。

#### E-O3 ｜ `formatRelativeTime`（store:590-601）为死代码
- 文件：`src/renderer/src/store/expert-team-store.ts:590-601`
- 与 `src/renderer/src/lib/format-relative-time.ts` 同名但签名/实现不同，易混淆。
- 修复：删除。

#### E-O4 ｜ 图标映射重复定义
- 文件：`ExpertTeamsTab.tsx:28-43`（ICON_MAP）与 `TeamDetailModal.tsx:103-108`（内联 map）
- 两处 14 个 icon 映射内容相同，独立维护，新增模板需同步改两处。
- 修复：提取到 `expert-team/icons.ts`。

#### E-O5 ｜ `usageCount`/`rating` 字段有数据但 UI 从不展示
- 文件：`expert-team-store.ts:27-28`
- 22 个内置专家都填充了这两个值，但展示它们的 `RatingBadge`/`UsageText` 从未使用 → 死数据。
- 修复：在卡片/详情中展示，或移除字段。

#### E-O6 ｜ Store 纯只读，不支持自定义专家/团队
- 文件：`expert-team-store.ts:580`
- `create(() => ({...}))` 未传 `set`，无任何 action。但 `Expert.builtin: boolean` 字段暗示应支持自定义。
- 修复：补 `addExpert`/`updateExpert`/`removeExpert` + persist；或移除 `builtin` 字段。

#### E-O7 ｜ `ExpertCategory` 用中文联合字面量，i18n 不友好
- 文件：`expert-team-store.ts:3-13`
- `'战略' | '研究' | ...` 直接作为 `CATEGORY_META` 的 key 和 `CategoryChip` 显示文本，英文 locale 下仍显示中文。
- 修复：改英文 key（`'strategy' | 'research' | ...`），`CATEGORY_META` 加 `labelKey`。

#### E-O8 ｜ ExpertTeamsTab 缺少空状态处理
- 文件：`ExpertTeamsTab.tsx:109-118`
- `filtered` 为空时渲染空 grid，无提示（ExpertLibraryTab 有 EmptyState）。
- 修复：补 `EmptyState`。

#### E-O9 ｜ FloatingComposer 协作 badge 文案硬编码
- 文件：`FloatingComposer.tsx:2164-2176`
- `title`/`aria-label` 中 "专家团"/"专家"/"团"/"移除协作上下文" 硬编码。
- 修复：走 i18n。

### 小问题

#### E-S1 ｜ ExpertTeamsTab 的 `filter` 状态类型过宽
- `ExpertTeamsTab.tsx:73` `useState<string>('全部')`，魔法字符串 `'全部'` 应提常量。

#### E-S2 ｜ Tab 切换未清除已打开的 Modal
- `ExpertTeamView.tsx:62-76`：切 tab 时 `expertDetailId`/`teamDetailId` 不清空，Modal 仍浮在上层。

#### E-S3 ｜ `buildTeamSystemPrompt` 假设 members[0] 为团长，无显式 leader 字段
- `expert-team-store.ts:621-652`：`expertIds` 数组顺序变化则团长跟着变。建议 `TeamTemplate` 加 `leaderId?`。

#### E-S4 ｜ 模板引用不存在的专家 ID 时静默过滤
- `ExpertTeamsTab.tsx:132-134`、`TeamDetailModal.tsx:29-32`：`.filter(m => m != null)` 无告警。建议开发模式 `console.warn`。

#### E-S5 ｜ `ExpertLibraryTab` 的 `as Filter[]` 类型断言不必要
- `ExpertLibraryTab.tsx:25-28`：改 `useMemo<Filter[]>` 更安全。

#### E-S6 ｜ Suspense fallback 为空白 div，无 loading 指示
- `WorkbenchStageRouter.tsx:94`：建议加 spinner/骨架屏。

---

## 二、技能（Skill）

### Bug

#### S-B1 ｜ 切换 tab 时 OAuth 预览对话框不关闭
- 文件：`PluginMarketplaceView.tsx:1138-1143`（reset effect）、`1644-1651`（dialog render）
- `activeKind` 变化时清空了 `notice`/`customOpen`/`githubImportOpen` 等，但**未清空 `oauthPreviewItem`**。MCP tab 打开 OAuth 预览后切到「技能」tab，对话框仍渲染（跨 tab 残留）。
- 修复：reset effect 加 `setOauthPreviewItem(null)`（1 行）。

#### S-B2 ｜ `disabledSkillIds` 本地状态与 chat-store 不同步
- 文件：`PluginMarketplaceView.tsx:997`、`1124-1136`、`1372`
- `disabledSkillIds` 是组件本地 `useState`，仅在 `activeKind` 变化时拉一次，不订阅 chat-store。若面板打开期间其他流程更新了该值，面板内徽标/计数显示陈旧。
- 修复：改为订阅 `useChatStore((s) => s.disabledSkillIds)`。

#### S-B3 ｜ 推荐技能 frontmatter `name` 写入本地化标题
- 文件：`PluginMarketplaceView.tsx:1271-1278`、`544-555`
- `addItem` 用 `itemTitle(item, t)`（当前语言标题，如中文"代码审查"）写入 `SKILL.md` frontmatter `name`。后端 `loadSkillSummary` 读该字段作显示名。结果：同一推荐技能，中/英用户装出的 `name` 不同，切语言后已安装技能显示名不跟随。
- 修复：frontmatter 写入语言中性标识（英文标题或 slug），display name 由后端 titleFromSlug 处理。

#### S-B4 ｜ `selectedSkillRoot` 可选中已禁用目录并写入文件
- 文件：`PluginMarketplaceView.tsx:1006-1009`、`1266-1283`、`1331-1344`
- 回退链「匹配 skillRootId → 第一个 enabled → `skillRootOptions[0]`」。所有 root 被禁用时 `skillRootOptions[0]` 可能 `enabled: false`，仍会向禁用目录写入文件 → "安装成功但运行时不扫描"，用户困惑。
- 修复：回退时过滤 `enabled && exists`；或禁用时给出明确提示。

### 优化

#### S-O1 ｜ 后端 `magicpocket:config:write` 缺 HTTPS / 供应链深度校验
- 文件：`src/main/ipc/register-app-ipc-handlers.ts:335-348`、`1007-1026`
- 渲染层有 `validateMcpServersHttps`/`auditMcpConfigSupplyChain`，但后端 `validateMcpConfigContent` 仅校验"是 JSON 对象"。任何绕过渲染层的直接 IPC 调用都能写 `http://` MCP url。
- 修复：后端复用 HTTPS 校验逻辑（提到 shared），形成纵深防御。

#### S-O2 ｜ 技能列表无虚拟化
- 文件：`PluginMarketplaceView.tsx:2034-2158`
- `PluginSection` 全量 `.map` 渲染。Codex 插件缓存可能累积大量目录，极端场景卡顿。
- 修复：引入 `react-window` 或对 discoveredSkills 分页/上限。

#### S-O3 ｜ 30+ useState 无独立 store，状态散落
- 文件：`PluginMarketplaceView.tsx:962-999`
- 无专属 store（对比 chat-store、expert-team-store）。状态无法跨挂载保持，无法被其他视图订阅，组件 2262 行难维护。
- 修复：抽取 `useSkillMarketplaceStore`（zustand）。

### 小问题

- **S-S1** ｜ `normalizeSkillId`（`PluginMarketplaceView.tsx:125-135`）与 `app-settings-normalize.ts:182-187` 重复且基本 no-op（后端 slug 从不带 `skill:` 前缀）。统一到 shared。
- **S-S2** ｜ `TabButton` 的 `tone` prop（`PluginMarketplaceParts.tsx:8-35`）是死代码，无调用方传 `tone='skill'`。
- **S-S3** ｜ 3 个未使用 i18n key：`pluginBuiltIn`、`pluginSkillDiscoveredCount`、`sidebarSkill`（zh/en common.json:1337/1387/1324）。
- **S-S4** ｜ OAuth 关闭按钮用字符 `x` 而非 `X` 图标（`PluginMarketplaceView.tsx:1925`）。
- **S-S5** ｜ `appendMcpConfig` 并发写竞态（`PluginMarketplaceView.tsx:1230-1243`）：OAuth 安装与自定义安装可并发，第二次写覆盖第一次。用 ref 维护最新 configText。
- **S-S6** ｜ OAuth 预览 `item.mcpConfig('')` 传空 workspaceRoot（`1965`），实际安装传 `workspaceRoot`（`1249`），调用不一致。
- **S-S7** ｜ `SkillGithubImportResult.paths` 后端返回但前端未用（`magicpocket-gui-api.ts:155`）。
- **S-S8** ｜ Settings `toggleSkillRoot` 只写 `claw.skills.disabledDirs`，后端同时合并 `schedule.skills.disabledDirs`（`skill-service.ts:220-232`），存在不一致隐患。
- **S-S9** ｜ localStorage installed 标记与磁盘脱节：手动删 skill 文件后 localStorage 仍记已安装，`isInstalled` fallback 到 localStorage 返回 true，按钮 disabled 无法重装。
- **S-S10** ｜ `DeepseekConfigFileResult`/`DeepseekConfigSaveResult` 类型名遗留（`magicpocket-gui-api.ts:192-193`），应改 `MagicPocketConfig*`。

---

## 三、连接器（MCP）

### Bug

#### C-B1 ｜ SettingsView 与 PluginMarketplaceView 的 mcpConfigText 不同步
- 文件：`SettingsView.tsx:175-181,479-553`；`PluginMarketplaceView.tsx:986-987,1023-1036`
- 两个视图各自维护 `mcpConfigText` + `mcpLoaded` 标志，无跨组件通知。在 Settings 保存后切到面板，后者 `mcpLoaded` 已为 true 不重载，显示**旧内容**；反之亦然。
- 修复：引入全局事件（IPC 广播 `magicpocket:config:written`，或 zustand/context 共享状态），写入后使另一处 `mcpLoaded` 失效。

#### C-B2 ｜ gui_schedule 系统服务器在 SettingsView 可被误编辑/删除
- 文件：`src/main/claw-schedule-mcp-config.ts:98-142`；`mcp/McpServersEditor.tsx:149-179`
- `syncClawScheduleMcpConfig` 把 `gui_schedule` 写入 mcp.json。面板列表过滤了它（`PluginMarketplaceView.tsx:1170`），但 `McpServersEditor` 显示它且**无只读/删除保护**。用户删除保存后该条目消失，定时任务 MCP 工具不可用，直到下次 sync 触发才恢复。
- 修复：McpServersEditor 对 `gui_schedule`（或 `systemManaged` server）加只读/隐藏标记。

#### C-B3 ｜ readJsonObjectIfExists 静默吞掉 mcp.json 的 JSON 解析错误
- 文件：`src/main/magicpocket-process.ts:1268-1278`
- mcp.json 损坏（SyntaxError）时返回 `null`，runtime 当作"无任何 server"静默启动，用户无反馈——所有连接器消失但无错误提示。对比 `claw-schedule-mcp-config.ts:192-207` 会抛带路径的错误，行为不一致。
- 修复：不静默返回 null，向上抛出或记录日志并反馈 GUI。

#### C-B4 ｜ KeyValueEditor 用数组 index 作 React key
- 文件：`mcp/McpServersEditor.tsx:420-421`
- 删除中间 env/header 条目时按 index 匹配 DOM，导致输入焦点和光标位置错乱（删第 2 个后，第 3 个的光标跳到第 2 个）。
- 修复：为 `McpKeyValue` 加稳定 `id`（类似 `McpFormServer.rowId`）。

#### C-B5 ｜ localStorage installed 列表不随 mcp.json 删除同步
- 文件：`PluginMarketplaceView.tsx:1145-1151,1184-1194,106-119`
- `markInstalled` 写 `mcp:<id>` 到 localStorage，但无"取消安装"逻辑。用户在 Settings 删除 server 后，`isInstalled` 中 localStorage 检查在 `mcpConfigHasServer` 之前，已删除 server 仍被判为已安装，显示错误勾选。
- 修复：调整 `isInstalled` 优先级（localStorage 放 mcpConfigHasServer 之后）；或删除时主动清理 localStorage。

#### C-B6 ｜ setMcpServerEnabled 禁用时不清除冗余 disabled 字段
- 文件：`PluginMarketplaceView.tsx:505-542`
- 启用时设 `disabled: undefined`（正确），但禁用时只设 `enabled: false`，不清除可能已存在的 `disabled: true`，两字段并存冗余，手动编辑 JSON 用户困惑。
- 修复：禁用时也显式 `disabled: undefined`，或统一只用 `enabled`。

### 优化

#### C-O1 ｜ i18n 命名严重不一致：「连接器」「MCP」「外部工具」三种叫法混用
- 文件：`zh/common.json:1326,1346,1353,1354`；`en/common.json:1326`（英文 tab 仍是 "MCP" 未改名）；`zh/settings.json:10,68,849,859,863`
- 项目要求 tab「MCP」→「连接器」，zh tab 已改，但：英文 tab 未同步；同文件内 `pluginMcpAdded` 等仍用"MCP"；settings.json 用"外部工具"且内部混用。用户在同一产品看到三种称呼指同一概念。
- 修复：全局统一为"连接器"（技术 key 保留，只改 value）；英文同步 "Connector"。

#### C-O2 ｜ AgentsSettingsSection 的 ctx 用 `Record<string, any>`，类型不安全
- 文件：`settings-section-agents.tsx:284`，另有 `memory: any`（1777）
- 解构 40+ 字段全部无类型检查，mcp 相关字段拼错不报错，重构易引入 bug。
- 修复：定义 `AgentsSettingsContext` interface。

#### C-O3 ｜ syncClawScheduleMcpConfig 与用户保存 mcp.json 存在潜在竞态
- 文件：`claw-schedule-mcp-config.ts:232-250`；`register-app-ipc-handlers.ts:1007-1026`；`index.ts:1807`
- 两者都是独立 read-modify-write，无文件锁/互斥。设置变更触发 sync 与 GUI 保存几乎同时时，可能丢失更新（sync 用旧内容覆盖用户编辑）。
- 修复：对 mcp.json 读写引入串行化队列，或原子写 + 读取重试。

#### C-O4 ｜ McpServersEditor 中 env/headers value 明文显示
- 文件：`mcp/McpServersEditor.tsx:422-435`
- env 常含 `API_KEY`/`TOKEN`/`SECRET`，用普通 `<input>` 明文，屏幕共享/截图时暴露。项目已有 `SecretInput`（`settings-section-agents.tsx:712`）未复用。
- 修复：value 提供"显示/隐藏"切换，key 匹配 `/token|secret|key|password/i` 的默认遮罩。

#### C-O5 ｜ mcpConfigText 被多处重复 parse
- 文件：`McpServersEditor.tsx:54-57,60-64,80-83`；`settings-section-agents.tsx:164-195,397-400`；`PluginMarketplaceView.tsx:623,1190,1193`
- 同一字符串在多处独立 `parseMcpConfigText`，每次输入触发多轮 JSON.parse + 遍历。
- 修复：SettingsView 层 parse 一次并 memo，传 model 给子组件；或 debounce。

#### C-O6 ｜ mcpPermissionSummary 的 parseError 不显示具体错误信息
- 文件：`settings-section-agents.tsx:1195-1198`
- `summarizeMcpPermissionSources` 已捕获具体 parseError 字符串（168），但渲染只用固定文案 `mcpPermissionParseError`，丢弃具体信息。用户不知 JSON 哪里错。
- 修复：`t('mcpPermissionParseError', { error: summary.parseError })`。

#### C-O7 ｜ rowIdCounter 是模块级全局变量
- 文件：`mcp/mcp-config-form.ts:55-59`
- 多次挂载/多实例时持续递增不重置，设计不健壮。
- 修复：用 `crypto.randomUUID()` 或组件内 `useRef` 计数。

#### C-O8 ｜ IPC handler 命名混乱：resolveMagicPocketConfigPath 实指 mcp.json
- 文件：`register-app-ipc-handlers.ts:994-1026,430-431`；`index.ts:1861`
- 参数/调用名 `resolveMagicPocketConfigPath`，实际注入的是 `resolveMagicPocketMcpJsonPath`（返回 mcp.json）；而 `claw-schedule-mcp-config.ts:26-28` 同名函数返回 config.toml。维护者易混淆。
- 修复：统一改 `resolveMagicPocketMcpJsonPath`。

### 小问题

- **C-S1** ｜ `McpServersEditor` 的 `split('\n')` 空输入产生 `['']`（行 289,366,379），序列化时已 filter，状态不干净但功能正确。
- **C-S2** ｜ `McpServerConfig` schema 默认 `trustScope: 'workspace'`（capabilities.ts:141）与表单默认 `'user'`（mcp-config-form.ts:152）不一致，三处默认逻辑不统一。
- **C-S3** ｜ 连接器列表无虚拟化（`PluginMarketplaceView.tsx:2034-2158`、`McpServersEditor.tsx:156-166`），当前数量小可忽略。
- **C-S4** ｜ `McpServersEditor` 外部 reload 覆盖未保存编辑无确认（`60-64`）：reload 前比较 `serializeMcpConfig(model)` 与 `value`，有变更则弹确认。

---

## 四、优先级建议

### 立即修复（影响功能正确性 / 数据一致性）
1. **E-B1** + **E-B3**：协作上下文错误绑定与跨线程残留 badge —— 直接误导用户。
2. **C-B1**：Settings 与面板 mcpConfigText 不同步 —— 显示旧配置。
3. **C-B2**：gui_schedule 可被误删 —— 定时任务失效。
4. **S-B1**：OAuth 预览跨 tab 残留（1 行修复）。

### 短期修复
5. **E-B2**：Modal 错误反馈缺失。
6. **S-B2**、**S-B3**、**S-B4**：disabledSkillIds 同步、frontmatter 本地化、禁用目录写入。
7. **C-B4**、**C-B5**、**C-B6**：key 焦点错乱、installed 标记脱节、enabled 字段冗余。
8. **C-B3**：mcp.json 解析错误静默吞掉。

### 架构改进
9. **S-O3**：抽取技能/连接器独立 store，解决状态散落与多视图同步（C-B1、S-B2 的根因）。
10. **E-O6**：专家团 store 补 CRUD + persist 或移除 `builtin`。
11. **C-O2**：AgentsSettingsSection ctx 去 `any`。

### 一致性 / 清理
12. **C-O1** + **E-O1** + **E-O7**：统一术语"连接器"，专家团全量补 i18n，`ExpertCategory` 改英文 key。
13. **E-O2/O3**、**S-S1/S-S2/S-S3/S-S10**、**C-O7/O8**：批量清理死代码、未使用 i18n key、命名遗留。
14. **E-B4/B5**、**S-S4**、**C-O4/O6**：补 Escape/ARIA/焦点、图标统一、密钥遮罩、错误信息透传。

### 安全加固
15. **S-O1**：后端 config:write 补 HTTPS 校验（纵深防御）。
16. **C-O4**：env/headers 敏感值遮罩。

---

## 五、补充说明（非问题，但值得注意）

- **i18n 已正确覆盖**：面板 tab「技能」/「连接器」已通过 `pluginTabSkill`/`pluginTabMcp` 走 i18n（zh: "技能"/"连接器"），左侧导航 `plugins` = "技能·连接器"，符合需求。
- **安全防护到位**：渲染层对 MCP url 强制 HTTPS、OAuth docs origin 白名单、skill entry 路径遍历防护、prototype pollution 防护、npx 版本锁定审计，均有单测覆盖。
- **测试覆盖良好但缺组件层**：纯函数（MCP config 合并/审计、skill marketplace 映射）单测充分，但 **React 组件交互层（tab 切换、OAuth 流程、toggle 状态同步）无组件测试**，S-B1、S-B2、C-B1 这类 bug 正是缺组件测试导致。
- **`ui-plugin-store.ts` 命名误导**：管理的是"形象工坊"吉祥物/主题插件，与"技能·连接器"无关，仅因都叫 "plugin" 易混淆，建议文件头注释说明。
