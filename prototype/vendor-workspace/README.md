# 钉钉 ding-tag 供应商工作台 · 高保真原型

面向语音数据标注供应商的 **Vue 3 高保真交互原型**，还原钉钉「ding-tag」标注平台供应商侧（`/vendor/*`）的信息架构、页面布局、组件尺寸与交互流程，覆盖 **任务领取 → 长音频拉框标注 → 质检 → 返修 → 交付验收 → 数据统计 → 组织管理** 的完整业务闭环。

> 本目录是独立的纯前端原型，与仓库根目录的 FastAPI 正式平台（`app/`）**不是同一套代码**，无需后端即可运行。
> 所有成员、任务、统计数据均为演示数据，不连接真实环境，也不包含任何真实账号或凭据。

---

## 1. 技术栈

| 分类 | 选型 |
|---|---|
| 框架 | Vue 3.5（`<script setup>` + Composition API） |
| 构建 | Vite 6 |
| 语言 | TypeScript 5.6（`strict`） |
| 路由 | vue-router 4（HTML5 History 模式） |
| 状态 | Pinia 2（会话状态持久化到 `localStorage`） |
| 样式 | 原生 CSS + CSS 变量（无 UI 组件库） |
| 图标 | 自绘 SVG 图标组件（不使用字体图标 / Emoji） |

---

## 2. 快速开始

### 2.1 环境要求

- Node.js ≥ 18（开发环境实测 v24）
- npm ≥ 9

### 2.2 安装与启动

```bash
cd prototype/vendor-workspace
npm install
npm run dev
```

启动后访问：<http://127.0.0.1:5173>

登录页已预填演示账号，直接点击「登 录」即可；密码不做校验。

### 2.3 构建与预览

```bash
npm run build     # 产物输出到 dist/
npm run preview   # 本地预览构建产物
```

### 2.4 演示账号

| 项目 | 值 |
|---|---|
| 账号 | `chunke_001`（可任意填写） |
| 密码 | `demo123456`（任意值均可） |
| 默认用户 | 陈可 · 组织管理员 |
| 可选组织 | 杭州春客 / 杭州春客-安全屋项目 |

> 登录态保存在 `localStorage` 的 `dingtag-vendor-demo-session` 中。需要重置演示状态时，清除该键或使用浏览器无痕窗口。

---

## 3. 目录结构

```text
prototype/vendor-workspace/
├── index.html                  # 入口 HTML（标题：数据标注平台 · 供应商工作台）
├── vite.config.ts              # 端口 5173、@ -> src 别名
├── tsconfig.json
├── package.json
└── src/
    ├── main.ts                 # 应用入口：Pinia + Router + 全局样式
    ├── App.vue
    ├── router/index.ts         # 全部路由与登录/组织守卫
    ├── stores/session.ts       # 登录态、用户、当前组织
    ├── mock/
    │   ├── index.ts            # 响应式数据库 db、查询与格式化工具
    │   ├── data.ts             # 组织 / 项目 / 任务 / 分段 / 成员 / 批次等演示数据
    │   ├── pages.ts            # 通用管理页的表格配置数据
    │   └── types.ts            # 领域类型定义
    ├── components/
    │   ├── AppShell.vue        # 侧边栏 + 顶栏 + 内容区，组织级/项目级两套导航
    │   ├── DataTable.vue       # 通用表格（列配置、空态、分页）
    │   ├── Waveform.vue        # 多说话人音频轨道、拉框、缩放、播放头
    │   ├── Icon.vue            # SVG 图标集
    │   ├── Modal.vue / StatCard.vue / StatusTag.vue / ToastHost.vue
    │   └── stats/              # StatTile / TrendChart / FunnelRows
    ├── composables/            # toast、download 工具
    ├── styles/
    │   ├── base.css            # 设计令牌、按钮、表单、表格、页面骨架
    │   └── stats.css           # 统计页专用样式
    └── views/                  # 50+ 页面组件（见下节）
```

---

## 4. 路由与页面清单

所有业务页均挂载在 `AppShell` 下，路径前缀 `/vendor`。

### 4.1 账号与全局

| 路径 | 页面 | 说明 |
|---|---|---|
| `/login` | 登录 | 左侧品牌介绍 + 右侧登录卡片，演示账号预填 |
| `/orgs` | 选择组织 | 登录后选择当前组织，进入工作台 |
| `/vendor/projects` | 项目列表 | 项目卡片/表格，进入项目详情 |
| `/help-center` | 帮助中心 | 独立页（不带侧边栏） |
| `/:pathMatch(.*)*` | 404 | 未匹配路由兜底 |

### 4.2 项目与团队

| 路径 | 页面 |
|---|---|
| `/vendor/project/:pid` | 项目详情 |
| `/vendor/projects/:pid/allocate`、`/vendor/project/:pid/allocate` | 任务分配 |
| `/vendor/project/:pid/members` | 项目成员管理 |
| `/vendor/project/:pid/suspended-tasks`、`/vendor/suspended-tasks` | 挂起任务管理 |
| `/vendor/project/:pid/project-config`、`/vendor/project-config` | 项目配置 |

### 4.3 任务与数据

| 路径 | 页面 |
|---|---|
| `/vendor/project/:pid/recordings` | 标注数据管理 |
| `/vendor/project/:pid/recordings/record` | 页面录音 |
| `/vendor/project/:pid/recordings/folder-upload` | 上传文件夹 |
| `/vendor/project/:pid/long-audio-tasks` | 长音频标注任务 |
| `/vendor/project/:pid/work-details` | 标注和质检明细 |
| `/vendor/project/:pid/long-audio-work-details` | 长音频标注和质检明细 |
| `/vendor/project/:pid/my-annotations` | 我的标注 |

### 4.4 生产工作台

| 路径 | 页面 | 说明 |
|---|---|---|
| `/vendor/project/:pid/long-audio` | 长音频工作台 | 我标注中的任务 + 待领取任务池 |
| `/vendor/project/:pid/long-audio/annotate/:tid` | 标注编辑器 | 波形拉框、说话人、转写联动（无侧边栏全屏） |
| `/vendor/project/:pid/long-audio-review` | 长音频质检工作台 | 待质检队列、质检节点 |
| `/vendor/project/:pid/long-audio-review/:tid` | 质检编辑器 | 逐框通过/驳回、左右区间对比试听（全屏） |
| `/vendor/project/:pid/rework` | 返修工作台 | 返修任务列表、连续返修 |
| `/vendor/project/:pid/rework-management` | 返修管理 | 返修分配与进度 |
| `/vendor/project/:pid/acceptance` | 交付工作台 | 交付批次 / 节点管理 |
| `/vendor/project/:pid/acceptance/batches` | 交付批次管理 | 复用交付工作台 |
| `/vendor/project/:pid/acceptance/nodes` | 交付节点管理 | 复用交付工作台 |
| `/vendor/project/:pid/audit` | 审核工作台 | 抽审任务 |
| `/vendor/project/:pid/validations` | AI 质检结果 | 机器质检结论 |

### 4.5 数据统计

| 路径 | 页面 |
|---|---|
| `/vendor/project/:pid/stats`、`/vendor/stats` | 项目统计 |
| `/vendor/project/:pid/my-stats`、`/vendor/my-stats` | 我的统计 |
| `/vendor/org-stats` | 团队工作统计 |
| `/vendor/quality-dashboard` | 质效看板 |

### 4.6 错题与学习

| 路径 | 页面 |
|---|---|
| `/vendor/mistake-square`、`/vendor/project/:pid/mistake-square` | 错题广场 |
| `/vendor/my-mistakes`、`/vendor/project/:pid/my-mistakes` | 我的错题集 |
| `/vendor/project/:pid/mistake-management` | 错题管理 |
| `/vendor/exam/gate` | 入职考试 |
| `/vendor/script-review` | 台本评审 |
| `/vendor/annotation-rules`（`/vendor/tools` 重定向） | 我的快捷工具 |

### 4.7 组织管理

| 路径 | 页面 |
|---|---|
| `/vendor/org/settings` | 组织设置 |
| `/vendor/org/member-center` | 成员管理 |
| `/vendor/org/sub-orgs` | 子组织管理 |
| `/vendor/org/departments` | 部门管理 |
| `/vendor/org/invitations` | 邀请成员 |
| `/vendor/org/approvals` | 审批管理 |
| `/vendor/org/permissions` | 权限矩阵 |
| `/vendor/org/partnerships` | 服务商列表 |
| `/vendor/org/partnerships/requests` | 合作申请 |

### 4.8 个人配置

| 路径 | 页面 |
|---|---|
| `/vendor/my-config`（`/vendor/my-settings` 重定向） | 我的配置 |
| `/vendor/user-configs` | 用户配置管理 |

---

## 5. 核心页面说明

### 5.1 长音频标注编辑器

- 多说话人彩色轨道波形，支持缩放（1x–6x）、播放头拖动、倍速（0.5x–2x）。
- 在轨道空白处拖拽即可新建拉框；选中分段后可修改说话人、起止时间与转写文本。
- 分段状态分为 **待标注 / 草稿 / 已完成**，顶部实时统计并支持按状态、说话人、易标注筛选。
- 保存草稿、提交标注、重置重做、方言辞典、作业规则等操作均有完整反馈（Toast / 弹窗）。
- 头部提供任务号、时长、标注方式、自动保存状态与返回入口。

### 5.2 长音频质检编辑器

- 逐框「通过 / 驳回」，驳回需选择错误类型；支持整体打回与逐节点提交。
- 左右区间对比试听，质检视图使用独立配色区分已通过、已驳回与待质检。
- 顶部可切换质检节点（A/B），提交后回到质检工作台。

### 5.3 返修工作台 / 返修管理

- 工具栏：任务 ID 搜索、返修原因筛选、刷新、连续返修。
- 表格列为任务、返修方式、来源、返修原因、返修次数、操作；当前演示账号下返修数据为空，展示空表结构。

### 5.4 交付工作台

- 四张统计卡（待交付 / 已交付 / 验收中 / 已通过），卡片右上角配对应图标。
- 交付批次表与验收节点表，覆盖「待提交 → 验收中 → 通过 / 驳回」状态流转。

### 5.5 统计页

- 项目统计：指标卡、趋势图、漏斗、成员明细，支持时间范围切换。
- 我的统计：左侧统计导航、概览指标、个人产出明细、空态面板。
- 团队统计 / 质效看板：团队维度产出、质量分布与趋势。

### 5.6 错题广场 / 我的错题集

- 错题广场按错误类型聚合，支持筛选与学习状态。
- 我的错题集为真实站同款整体布局：顶部分段切换、日期区间查询、空态卡片（48px 圆形图标 + 双行文案）。

---

## 6. 演示数据

全部数据位于 `src/mock/data.ts`，通过 `src/mock/index.ts` 包装为响应式 `db`，页面内修改即时生效（刷新后还原）。

### 6.1 组织与项目

| 组织编码 | 名称 | 成员数 |
|---|---|---|
| `ORG24f966c4` | 杭州春客 | 27 |
| `ORGa7afda9d` | 杭州春客-安全屋项目 | 9 |

演示项目：`435004`、`434004`、`434005`（长音频拉框 · 普通话 · 进行中）。

### 6.2 演示账号相关数据（与真实账号口径一致）

| 任务号 | 时长 | 状态 | 负责人 | 说明 |
|---|---|---|---|---|
| 11074116 | 12:11 | 待质检 | 泽漆 | 已完成标注，90 个分段全部通过 |
| 11676028 | 13:50 | 待领取 | denice | 121 个待标注分段 |
| 11676027 | 11:56 | 待领取 | denice | 104 个待标注分段 |
| 11676026 | 11:32 | 待领取 | denice | 16 个待标注分段 |
| 11676025 | 13:59 | 待领取 | denice | 93 个待标注分段 |

- 项目成员管理页固定展示 4 名成员：**泽漆、唐舞麟、柠檬、胡军**（均具备标注员 + 质检员角色）。
- 返修任务、错题、挂起任务在当前账号下均为 **0 条**，对应页面展示真实站同款空态，而不是填充假数据。

### 6.3 其他演示数据

- 交付批次 5 条（验收中 / 待分配验收员 / 待提交 / 通过 / 驳回）。
- 组织成员 27 人、部门、子组织、角色与权限矩阵、错题样例等用于管理页展示。
- 音频为波形示意，不加载真实音频文件。

---

## 7. 设计还原规范

设计令牌集中在 `src/styles/base.css` 的 `:root`，页面级差异使用 `scoped` 样式覆盖。

### 7.1 色彩

| 令牌 | 值 | 用途 |
|---|---|---|
| `--primary` | `#3b82f6` | 主按钮、链接、选中态 |
| `--primary-hover` | `#2563eb` | 主按钮悬停 |
| `--primary-weak` | `#eff6ff` | 主色浅底 |
| `--ink-1` ~ `--ink-4` | `#111827` / `#1e293b` / `#6b7280` / `#9ca3af` | 标题 → 正文 → 辅助 → 占位 |
| `--line` | `#e5e7eb` | 分割线、表格边框 |
| `--bg` | `#f9fafb` | 页面底色 / 页面头背景 |
| `--success` / `--warning` / `--danger` | `#22c55e` / `#f59e0b` / `#ef4444` | 状态语义色 |
| `--brand` | `#ef4444` | 品牌红（登录页渐变、强调） |

### 7.2 字体与尺寸

- 正文 14px / 辅助 12px / 页面标题 20px / 卡片标题 14–16px。
- 表格：表头高 40px，行高 37.5–55px，边框 `1px solid #e5e7eb`，容器圆角 8px。
- 小按钮：高 28px、字号 12.8px、圆角 4.8px；工具按钮：高 32px、字号 14px。
- 分段切换（seg）：容器底色 `#f3f4f6`、高 40px、内边距 4px；选中项底色 `#f9fafb`。
- 页面头：默认通栏，`margin: -24px -24px 24px; padding: 16px 32px; background: var(--bg)`。

### 7.3 空态与反馈

- 空态卡片：居中双行文案，标题 28px 行高、描述 20px 行高，大间距留白；部分页面使用 48px 圆形图标。
- 所有操作通过 `toast()` 给出成功 / 失败 / 提示反馈；危险操作使用 `Modal` 二次确认。

> 视觉与文案不得使用无关图片或伪造证明性数据；图标统一使用 `Icon.vue` 的 SVG，不使用字符图标。

---

## 8. 已验证范围

### 8.1 逐像素校准页面（1440×1000 DOM 实测）

以下 15 个页面已与真实站点 `https://ding-tag.dingtalk.com/vendor/*` 的实测几何与样式对齐：

`交付工作台`、`任务分配`、`长音频工作台`、`长音频质检工作台`、`长音频标注任务`、`项目成员管理`、`错题广场`、`我的错题集`、`我的统计`、`标注数据管理`、`返修工作台`、`返修管理`、`项目统计`、`挂起任务`、`标注和质检明细`。

校准项包括：页面头通栏与内边距、表格容器/表头/行高、工具栏与按钮尺寸、分段切换容器与选中态、卡片间距（含相邻外边距合并）、空态高度与字号行高、分页位置。

### 8.2 全量回归

- 路由扫描覆盖 47 个页面入口（含项目作用域），无白屏、无 Vite 错误浮层。
- 项目详情与两个编辑器使用自定义头部，不显示通用 `h1`，属预期行为。
- `npm run build` 通过：JS 约 363 kB（gzip 115 kB），CSS 约 114 kB。

### 8.3 尚未逐像素比对的页面

项目列表/详情、组织设置、邀请、审批、权限矩阵、服务商、子组织、部门、各类配置页、质效看板、AI 质检结果、审核工作台等页面，按同一套设计令牌与组件规范实现，交互完整，但真实站未提供可直接访问的对照页面，因此未做逐像素校准。

---

## 9. 已知边界

- **无后端**：所有读写发生在内存中的响应式 `db`，刷新页面即还原；不发起任何网络请求。
- **无真实鉴权**：登录仅切换本地状态，密码不校验，仅用于演示体验流程。
- **无真实音频**：波形与播放头为可视化模拟，不播放声音。
- **数据隔离**：演示数据与真实业务无关，不包含真实手机号、账号、密钥或个人信息。
- **路由模式**：使用 HTML5 History，部署到静态服务器时需将未匹配路径回退到 `index.html`；本地 `vite preview` 已内置该行为。
- **浏览器支持**：面向现代浏览器（Chrome / Edge / Safari 最近两个大版本）。

---

## 10. 开发约定

- 新增页面统一放在 `src/views/`，在 `src/router/index.ts` 注册，并补充 `meta.title`。
- 页面均挂载在 `AppShell` 下；需要全屏工作台时在路由 `meta` 中标记 `flush: true`。
- 数据优先复用 `src/mock/index.ts` 的查询与格式化函数（`fmtTime`、`fmtDuration`、`segmentStats`、`taskStatusTag` 等）。
- 图标统一在 `Icon.vue` 中扩展 SVG path，禁止引入图片图标或字符图标。
- 样式优先使用 `base.css` 的设计令牌，避免在页面内硬编码新的主色与圆角。

---

## 11. 许可

本原型仅用于项目内部演示与设计评审，随仓库整体授权使用；演示数据不构成任何真实业务承诺。
