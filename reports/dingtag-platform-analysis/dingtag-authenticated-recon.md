# 钉钉数据标注平台 · 登录态 REA 实测分析（供应商侧 · 完整版）

- 采集时间：2026-11-25
- 目标：`https://ding-tag.dingtalk.com`
- 账号能力：供应商管理员（`admin, cap_annotator, cap_reviewer`），2 个组织
- 方式：REA `capture_browser_scenario`（Playwright headless Chrome），登录后逐路由导航，记录 URL / DOM / 页面截图 / 请求
- 数据边界：全程只读，未点击保存、提交、领取、分配、删除、导出等写操作按钮

## 一、账号与角色

| 组织 | orgCode | 角色 | 能力位 |
|---|---|---|---|
| 杭州春客 | ORG24f966c4 | admin, cap_annotator, cap_reviewer | vendor=true, customer=false, acceptance=false |
| 杭州春客-安全屋项目 | ORGa7afda9d | 同上 | vendor=true |

该账号不包含平台运营、客户方、验收方角色，因此 platform(74) / acceptance(23) / client(19) / org(13) / ops(6) 五组路由无法实测。

## 二、实测接口

```
POST /api/auth/login
GET  /api/auth/sso/config
GET  /api/account/profile
GET  /api/account/orgs
GET  /api/auth/session/current
POST /api/auth/session/switch-org
GET  /api/org/current
GET  /api/env/switch-enabled
GET  /api/feature-toggles
GET  /api/vendor-org/script-review/entry
GET  /api/notifications/state
GET  /api/notifications/stream          // SSE
GET  /api/exam/gate-check
GET  /api/vendor-project?offset=0&limit=20
```

`switch-org` 手工裸调返回 500，必须由页面上下文发起；复刻时不能只按路径调用。

## 三、供应商侧页面实测结果（50 个页面）

### 3.1 组织级（16）

| 路由 | 页面 | 状态 |
|---|---|---|
| `/vendor/projects` | 项目列表 | 正常 |
| `/vendor/mistake-square` | 错题广场（标注员错题 / 质检员错题） | 正常 |
| `/vendor/suspended-tasks` | 挂起任务管理 | 正常 |
| `/vendor/project-config` | 项目配置 | 正常 |
| `/vendor/annotation-rules` | 标注规则 | 正常 |
| `/vendor/stats` | 项目统计 | 正常 |
| `/vendor/my-stats` | 我的统计（每日实时 / 历史统计 / 标注统计 / 质检统计） | 正常 |
| `/vendor/org-stats` | 团队统计 | 正常 |
| `/vendor/quality-dashboard` | 质检看板（流转漏斗、四项合格率） | 正常 |
| `/vendor/org/settings` | 组织设置 | 正常 |
| `/vendor/org/member-center` | 成员管理（实测 27 人） | 正常 |
| `/vendor/org/sub-orgs` | 子组织管理 | 正常 |
| `/vendor/org/departments` | 部门管理 | 正常 |
| `/vendor/org/invitations` | 邀请成员 | 正常 |
| `/vendor/org/approvals` | 审批管理 | 正常 |
| `/vendor/user-configs` | 用户配置管理 | 正常 |
| `/vendor/org/permissions` | 权限矩阵 | 正常 |
| `/vendor/org/partnerships` | 服务商列表 | 正常 |
| `/vendor/org/partnerships/requests` | 合作申请（待我处理 / 我的申请） | 正常 |
| `/vendor/script-review` | 台本评审（审核工作台 / 审核统计 / 台本验收 / 开始评审 / 我的评审记录） | 正常 |
| `/vendor/exam/gate` | 入职考试 | 正常 |
| `/vendor/guide` | 帮助中心（中/英/日，按角色与流程） | 重定向 |
| `/vendor/tasks`、`/review`、`/recordings`、`/validations`、`/settlements`、`/data-stats` | — | 重定向到项目列表 |
| `/vendor/org/exam`、`/org/exam/admin`、`/temporary-cer-dashboard` | — | 403 |

### 3.2 项目级（`/vendor/project/434003/*`）

正常渲染：

| 路由 | 页面 |
|---|---|
| `/long-audio` | 长音频拉框标注（任务池） |
| `/long-audio-tasks` | 长音频标注任务 |
| `/long-audio-work-details` | 长音频标注和质检明细 |
| `/work-details` | 标注和质检明细 |
| `/my-annotations` | 我的标注 |
| `/members` | 成员管理 |
| `/suspended-tasks` | 挂起任务管理 |
| `/recordings` | 标注数据管理 |
| `/recordings/record` | 页面录音 |
| `/recordings/folder-upload` | 上传整个文件夹 |
| `/rework` | 返修工作台 |
| `/rework-management` | 返修管理 |
| `/audit` | 审核工作台 |
| `/validations` | AI 质检结果（AI 判定 / 问题数 / 标注文本 / 质检时间） |
| `/mistake-square` | 错题广场 |
| `/mistake-management` | 错题管理 |
| `/my-mistakes` | 我的错题集 |
| `/project-config` | 项目配置 |
| `/acceptance` | 交付工作台 |
| `/acceptance/batches` | 交付批次管理 |
| `/acceptance/nodes` | 交付节点管理 |
| `/projects/434003/allocate` | 转分配给子组织 |

项目类型门控：该项目为「长音频拉框」，以下路由全部重定向到 `/long-audio`：`read-text`、`read-text-tasks`、`review`、`scripts`、`scripts/lobby`、`script-v2`、`script-recordings`、`script-productions`、`script-selection`、`script-rework`。

`/vendor/project/434003/stats` 只渲染「返回首页」，未加载统计内容。

### 3.3 项目详情页结构

- 顶部：项目编号、状态、项目名、语种、项目类型
- 指标卡：目标时长 / 已分配 / 剩余可分配
- Tab：任务总览 / 验收节点
- 子组织分配表：子组织、分配时长、分配时间、状态、转分配
- 任务状态计数：实测 45 个任务，分布 23 / 4 / 5 / 13

### 3.4 标注编辑器（长音频拉框，实测）

入口链路：项目列表 →「进入工作台」→ `/vendor/project/434003/long-audio` → 进行中任务点「继续标注」，待领取池点「开始标注」。

实测任务 `#11074112`（2:04，30 框）：

- 我标注中的任务 6 个：`#11074112`、`#11677010`～`#11677014`
- 待领取任务池 2 个：`#11677015`、`#11677016`
- 当前任务状态：已标注 0、草稿 12、待标注 18

页面结构：

- 顶栏：任务号、时长、人工标注、已保存状态、重置重做、方言辞典、作业规则、保存草稿、提交标注
- 波形区：多说话人轨道（S1/S2/S3/S4 + 新建说话人）、拖拽建框、框选编辑、播放/倍速/缩放/全长
- 右侧拉框列表：全部 / 待标注 / 草稿 / 已完成 四态筛选、按说话人筛选、「下一个待标注」「下一个草稿」、仅看 easy
- 底部全部转写框（共 30 框）：与拉框一一对应，点击跳转，显示时间、说话人、状态、文本
- 编辑规则：在波形上拖拽新建拉框，或点选拉框后点「开始编辑」

打开任务时命中的接口：

```
GET  /api/vendor-project/434003/long-audio/my-tasks
GET  /api/vendor-project/434003/long-audio/pending-tasks
POST /api/vendor-project/434003/annotation/task/11074112/load
GET  /api/vendor-project/434003/long-audio/task/11074112/peaks
GET  /api/vendor-project/434003/long-audio/task/11074112/draft
GET  /api/vendor-project/434003/task/11074112/audio
```

数据影响：进入任务会触发 `annotation/task/:id/load`（归属确认/心跳），任务原本已属于该账号，未做任何编辑与提交，页面关闭后无内容变更。

### 3.5 质检编辑器（长音频质检，实测）

入口：`/vendor/project/434003/long-audio-review` → 待质检任务池「开始质检」。实测认领任务 `#11074114`（1:54，32 框）。池内共 5 条。

页面结构：

- 顶栏：任务号、质检节点、方言辞典、作业规则、整体打回、提交节点
- 波形区：多说话人轨道、拉框片段（#9/#10/#11…）、播放/倍速/缩放/全长、点选片段后区间试听
- 右侧栏：拉框列表 / 标注规则 两个 Tab；统计「已通过 0 / 已拒绝 0 / 待质检 32」；「下一个待质检」「下一个被拒」；筛选 全部 / 待质检 / 已拒绝 / 全部说话人
- 底部全部转写框（32 框）：与拉框一一对应，逐条显示时间、说话人、状态、文本，可直接跳转
- 质检动作：对单框通过/拒绝，或「整体打回」；完成后「提交节点」

接口：

```
GET  /api/vendor-project/434003/long-audio-review/pending-tasks
POST /api/vendor-project/434003/long-audio-review/task/11074114/claim
GET  /api/vendor-project/434003/long-audio-review/task/11074114
GET  /api/vendor-project/434003/long-audio-review/task/11074114/peaks
GET  /api/vendor-project/434003/long-audio-review/task/11074114/audio
```

数据影响：`claim` 会把待质检任务归属到当前账号（这是本轮唯一的业务状态变更），未做通过/拒绝/打回/提交。

### 3.6 返修工作台与返修对比（实测）

- `/rework`：空态「当前没有待返修任务」，支持「连续返修」
- `/rework-management`：全项目返修列表，列为 任务 / 返修方式 / 返修原因 / 返修次数，支持按标注员姓名筛选、批量分配（选中后显示数量）
- 点击任务号进入对比视图：`/rework-management?compareTaskId=11075076`
  - Tab：标注稿 / 质检稿 / 验收稿 / 差异对比
  - 差异模式：标注稿 → 质检稿、提交稿 → 验收稿
  - 播放器：倍速、缩放、全长、「试听左侧区间」
- 接口：

```
GET /api/vendor-project/434003/rework/all?page=1&pageSize=20
GET /api/vendor-project/434003/rework/tasks/11075076/comparison
GET /api/vendor-project/434003/rework/tasks/11075076/peaks
```

返修的实际编辑动作需要把任务「批量分配」给标注员后在 `/rework` 中连续作业，本次未分配，因此未进入编辑态。

## 四、权限矩阵（实测，34 个权限点 × 5 角色）

平台组 4 个权限点（org_create、org_manage、admin_manage、config）在供应商侧全部为空。

| 分组 | 权限点 | 组织管理员 | 项目经理 | 标注员 | 质检员 | 验收员 |
|---|---|---|---|---|---|---|
| 组织 | settings_edit / settings_view / suborg:create / suborg:manage | ✓ | | | | |
| 成员 | invite / remove / disable / enable / role_assign | ✓ | | | | |
| 成员 | member:list | ✓ | ✓ | | | |
| 部门 | create / edit / delete / member_move | ✓ | | | | |
| 项目 | create / edit | ✓ | ✓ | | | |
| 项目 | delete | ✓ | | | | |
| 项目 | view | ✓ | ✓ | ✓ | ✓ | ✓ |
| 项目 | share | ✓ | ✓ | | | |
| 任务 | assign / export | ✓ | ✓ | | | ✓(export) |
| 任务 | view | ✓ | ✓ | ✓ | ✓ | ✓ |
| 标注 | submit | ✓ | ✓ | ✓ | | |
| 标注 | review | ✓ | ✓ | | ✓ | |
| 标注 | accept | ✓ | ✓ | | | ✓ |
| BPO | partner_manage / task_receive | ✓ | | | | |
| 系统 | audit_view / audit_export / integration | ✓ | | | | |

## 五、关键状态枚举

- 交付批次：待提交 / 待分配验收员 / 验收中 / 通过 / 驳回 / 申诉中 / 已废弃
- 交付节点：待提交 / 待分配验收员 / 验收中 / 平台验收通过 / 平台驳回 / 申诉中
- 审核工作台：待提交 / 验收中 / 平台验收通过 / 平台验收不通过 / 模型验收通过 / 模型验收不通过 / 已废弃，另有「退回返修」
- 项目配置无效原因：底噪、没有人说话、音频内容不全、声音听不清、音频经过特殊处理、直接读本、敏感内容、无声音、非目标语种、数据缺失、多人说话

## 六、证据编号

| 内容 | Evidence |
|---|---|
| 登录 + 组织列表 | `ev_9aebc332cd59b075b0d1bdf79d507922e598ab03e52999e938c5c1845da0ab78` |
| 组织选择页 DOM | `ev_752c037636c9e2975f22022537986e2e9069bf31fb8e8aed0ccc5bc0f47a95b0` |
| 进入组织 + 项目列表 + 接口 | `ev_d3f82724088951efb3ac2da5a0ff810006ad95b1b3fee7c9e24f4a323dcd8f21` |
| 挂起任务/项目配置/标注规则 | `ev_e91397e489db8654f0cd4e907f35f7617c4384d20214f44ab09a54c941808d83` |
| 统计四页 | `ev_19709b23ea55daf6f6da203958177e47ba40d832a83f8a66f2651164cf6780aa` |
| 组织管理四页 | `ev_13ba8f234c2621f713d6ce355365ae693ca2e206672bdf89e2924a880e66d329` |
| 邀请/审批/用户配置 | `ev_b6243b672756df8ebd645bf9ce3db41d15e42c647e3527b58007fb569e59d036` |
| 项目详情 | `ev_7f856e8fad8ba0c92803df5dbaab32caa000a4e8efc6962a12721f6cb15f917a` |
| 项目生产页 10 个 | `ev_5a592bff3a9d2137002c157d8e4b57c5e58d8a74598b9e8f76fde3399c8ee29c` |
| 返修/审核/错题/AI质检 | `ev_fa983fb2a851a068bf39de024d1da7642834708b910bc3f72e96a21ae6119845` |
| 剧本重定向/录音/交付 | `ev_fec70287fb5b4393e8f5b02ce9c149f505939b200205b77247788cbf02812a9b` |
| 全局路由重定向/台本评审/交付批次 | `ev_5c95299c3e5d2980d807e2f05847719760d0c9b7d412766c254228aec1dfbed7` |
| 权限矩阵/服务商/合作/入职考试 | `ev_4bc9b7e5c7d9d74b432b9b7ce488a1bef13dc5909a4c4f44957a0d7c83421747` |
| 标注编辑器（任务 #11074112） | `ev_4cdb57a9d0feaa18d316de082789d0ddb679a6fabb1bfa1c4858f5cde33d05d6` |
| 质检工作台/返修工作台/返修管理 | `ev_af963a95e7964e5ee338a12cd1ee516b5d2d24f5cd2ec696f1e730d0d32413d0` |
| 质检编辑器（任务 #11074114） | `ev_ae4cf35ab91fb3652f7e4970a8bce253311a608173a893677d05adb3d92cc43b` |
| 返修对比视图（任务 #11075076） | `ev_28ad30887a37c053182e0131974fddcfb9e9216b6ef48de8beaf6d2e3ec08a73` |

## 七、仍未覆盖

1. 返修编辑态：需要先把返修任务批量分配给标注员，再在 `/rework` 连续作业，本次未分配。
2. 客户方、验收方、平台运营三套工作台，当前账号无权限。
3. 交付批次详情、剧本录制房间（当前项目类型无剧本模块）。
4. 后端规则：抽检比例、CER 口径、结算公式、返修次数上限，前端不可见。
5. 前端 bundle 已升级为 `index-Cd469H9s.js`，与 11-24 静态报告的版本不同，路由总数需重新核对。
