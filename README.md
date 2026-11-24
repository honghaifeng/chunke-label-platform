# 春科数据标注平台 v4

面向国家人工智能应用中试基地（消费领域·家居家电方向）的数据标注平台，覆盖 **数据导入 → 数据集版本 → 任务分派/领取 → 多模态标注 → 智能质检 → 导出与集成** 全链路。

后端 **FastAPI + SQLite（WAL）**，前端 **原生 HTML/CSS/JS（无构建工具，hash 路由 SPA）**，支持本地部署与 Docker Compose 部署。

- 访问入口：`http://127.0.0.1:8100`
- 健康检查：`GET /health`
- 指标端点：`GET /metrics`（Prometheus 文本格式）
- 缺口分析与演示清单：[docs/bid-gap-analysis/bid-gap-analysis.html](docs/bid-gap-analysis/bid-gap-analysis.html)

### 三级平台入口

登录后按角色自动进入对应工作台，三套入口共享同一账号体系与数据隔离规则：

| 入口 | 路由前缀 | 面向角色 | 主要功能 |
|---|---|---|---|
| 管理平台 | `#/admin/*` | 平台管理员 | 租户、组织、用户、RBAC、安全合规、平台监控 |
| 租户平台 | `#/tenant/*` | 租户管理员 | 本租户项目/团队/成员、租户内统计、验收中心 |
| 项目平台 | `#/project/:pid/*` | 项目经理、标注员、质检员、验收员 | 我的任务、标注工作台、质检、验收、数据集 |

旧链接（如 `#/tasks`、`#/qc`）会自动重定向到当前入口对应的三段式路由，不影响已有书签。

---

## 1. 核心能力

| 能力域 | 主要内容 |
|---|---|
| 多租户与平台控制台 | 管理平台 / 租户平台 / 项目平台三套入口；平台 → 租户 → 项目三级隔离；`tenant_members` 多对多成员关系；用户/项目/存储配额；用量计量与计费策略；会话级租户切换 |
| 组织与权限 | 平台角色 + 项目角色 + 自定义角色；超级管理员、租户管理员、项目经理、标注员、质检员、验收员；任务级角色授权；RBAC 权限矩阵 |
| 数据集与作业 | ZIP/URL/FTP/HDFS/S3-兼容导入、分片续传、版本快照/diff/回滚、生命周期与回收站 |
| 任务治理 | 任务大厅、任务包、领取锁、条件工作流、暂停/恢复/终止、包级退回与返工历史；质检通过后进入待验收，验收通过才完成 |
| 模板编排 | 组件库、嵌套容器、属性与校验、版本升版与灰度投放、模板驱动表单 |
| 多模态标注 | 图片/音频/视频/文本/点云/LLM/多模态/PDF 八类工作台；文本嵌套实体与语义匹配、语音语种/强度/发音校对、视频行为区间/逐帧、点云关键点/车道线/4D 帧序列 |
| 图片图形工具链 | 画布直绘矩形/多边形/圆形/自由曲线，画笔/填充/橡皮擦分割实例（异色），关键点骨骼连线与批量复刻，整图分类与场景属性，缩放/平移/旋转/镜像/多图对比，区域合并拆分 |
| 3D 点云工作台 | three.js r160 透视渲染（本地 vendor，无 CDN 依赖）；轨道/平移/缩放；3D 框画布交互（放置/拉伸/旋转/复制）；框选/多边形点云分割（RLE 存储）；车道线折线；ROI 裁剪与强度筛选；二进制 PCD/BIN/PLY 解析；**2D 相机双视图 + 标定投影联动**；**内置 AI 预标注**（地面滤除→聚类→PCA 拟合框）；4D 帧序列时间轴 |
| 规范与预警 | 可复用标注规范模板库（示例截图/PDF 附件），绑定项目后工作台实时展示规范要点；保存/提交自动跑规则引擎，违规即时预警（428 确认后强制提交） |
| 批量审核 | 质检/验收队列勾选批量通过/驳回（统一意见+错误类型+退回阶段），逐条失败原因，全部写入审计日志 |
| 生产线与结算 | 任务包**时长配额**（目标/已分配/剩余，领取按 est_minutes 扣减）与**双轨计价**（按件/按时长，项目级 billing.mode）；长音频**切分工序**（作业中心一键切成子任务）；**考试门禁**（项目可选开关，未通过不能领取）；**申诉仲裁**（验收驳回可申诉，仲裁留痕）；**错题本**（驳回错误类型按人聚合）；**AI 助手**（读取任务规范与质检记录问答，可接大模型） |
| 交互式算子 | SAM 分割、OCR、视频跟踪、文档问答、ASR、开放词检测、文本润色（内置降级 + 外部服务） |
| 智能质检 | 规则引擎 + 质检算子库 + 阈值/权重/组合规则 + 字符级定位高亮；驳回错误类型（漏标/错标/框选偏差等）与分布统计 |
| 集成与运维 | 双向集成端点、Prometheus/Loki/数据湖、备份恢复、升级回滚、TLS 反向代理 |
| 安全合规 | PBKDF2 口令、SQLite 持久化会话（12h 过期）、IP 白名单、TOTP MFA、OIDC SSO、SCIM 2.0、API Key、媒体短时 Token、水印、审计导出 |

> 算法类能力默认提供**内置降级实现**，配置 `operator.<name>.url` 后自动切换到真实推理服务；不配置也能完整走通业务流程与演示。

---

## 2. 技术架构

```text
┌──────────────────────────────────────────────────────────────────┐
│  浏览器 SPA（原生 JS，hash 路由）                                │
│  app.js（框架/工作台） pages_v3.js（作业/大厅/算子/运维）         │
│  pages_v4.js（控制台/模板编排/高级标注/质检算子）                 │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS / JSON / multipart
┌───────────────────────────────▼──────────────────────────────────┐
│ FastAPI                                                          │
│  main.py        入口、会话、任务、标注、质检、统计、设置          │
│  enterprise.py  RBAC、组织、数据集、任务包、工作流、API v1、SCIM  │
│  workbench.py   模板、版本、导出、预标注、点云、时序、偏好         │
│  ops.py         品牌、存储、MFA/SSO、审计、监控、备份升级          │
│  extras.py      扩展标注、作业队列、通知、抽审、模型仓库           │
│  advanced.py    平台控制台、模板编排、交互算子、质检算子、集成      │
│  editing.py     图像编辑指令标注与规范校验                         │
│  serviceops.py  运营月报、工单 SLA、保密协议、培训考核              │
└───────────────┬───────────────────────────────┬──────────────────┘
                │                               │
        ┌───────▼────────┐              ┌───────▼──────────────┐
        │ SQLite (WAL)   │              │ data/media 本地媒体   │
        │ data/chunke.db │              │ 可选 S3/MinIO 预签名  │
        └────────────────┘              └──────────────────────┘
                │
        ┌───────▼───────────────────────────────────────────────┐
        │ 可选外部服务：SAM / OCR / Track / QA / LLM / ASR       │
        │ Prometheus / Loki / 数据湖 / 集成端点 / OIDC IdP       │
        └───────────────────────────────────────────────────────┘
```

**技术栈**

- Python 3.12 + FastAPI + Uvicorn
- SQLite（WAL 模式，单机零依赖）
- 原生 HTML/CSS/JS，无 Node 构建步骤（点云工作台使用 three.js r160，已 vendor 至 `app/static/vendor/three.module.js`）
- 可选：ffmpeg（音视频预处理）、onnxruntime/scikit-learn（本地预标注）、FunASR 独立 venv（语音转写）
- 部署：Docker / Docker Compose + Nginx TLS

---

## 3. 目录结构

```text
chunke-label-platform/
├── app/
│   ├── main.py            # FastAPI 入口、中间件、核心业务 API
│   ├── auth.py            # 会话、角色、权限、任务数据范围
│   ├── db.py              # SQLite schema、迁移、种子数据
│   ├── enterprise.py      # 组织/RBAC/数据集/任务包/工作流/API v1/SCIM
│   ├── workbench.py       # 模板/版本/导出/预标注/点云/时序
│   ├── ops.py             # 品牌/存储/MFA/SSO/审计/监控/备份升级
│   ├── extras.py          # 扩展标注/作业/通知/抽审/模型仓库
│   ├── advanced.py        # 平台控制台/模板编排/交互算子/质检算子/集成
│   ├── prelabel.py        # 预标注调度与 ASR worker 包装
│   ├── overlap.py         # 重叠发言检测（ONNX）
│   ├── editing.py         # 图像编辑指令标注、规范校验、体检与 JSONL 导出
│   ├── serviceops.py      # 运营月报、工单 SLA、保密协议、培训考核
│   └── static/
│       ├── index.html
│       ├── styles.css
│       ├── app.js         # SPA 框架、任务、图片工作台（图形工具链/规范面板）
│       ├── pages_v3.js    # 作业中心/任务大厅/three.js 点云工作台/质检/运维
│       ├── pages_v4.js    # 控制台/模板编排/高级标注/质检算子
│       └── vendor/
│           └── three.module.js  # three.js r160（本地 vendor，点云渲染）
├── scripts/
│   ├── run.sh             # 本地启动
│   ├── asr_worker.py      # FunASR 离线转写 worker
│   ├── detect_worker.py   # 图片检测 worker
│   ├── loadtest.py        # 只读并发压测
│   └── import_datasets.py # KITTI/nuScenes/DAIR 外部数据集一键导入
├── deploy/
│   └── nginx.conf         # TLS 终止与反向代理
├── docs/
│   ├── bid-gap-analysis/  # 招标需求差距分析与演示清单
│   └── 数据标注平台系统研发汇报-差距分析.md  # 研发汇报需求差距分析（含实施状态）
├── data/
│   ├── media/             # 媒体文件（演示素材入库）
│   ├── backups/           # 运行期备份（gitignore）
│   └── chunke.db          # SQLite（gitignore，首次启动生成）
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## 4. 快速开始

### 4.1 环境要求

- Python 3.10+（推荐 3.12）
- 可选：ffmpeg（音视频转码/抽帧/降噪）
- 可选：FunASR 独立 Python 3.10 venv（语音预识别，非必需）

### 4.2 本地启动

```bash
git clone https://github.com/honghaifeng/chunke-label-platform.git
cd chunke-label-platform

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 启动（默认 127.0.0.1:8100）
bash scripts/run.sh
```

也可以直接运行：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

首次启动会自动创建 `data/chunke.db` 并写入 schema、角色、演示项目与演示任务。

### 4.3 Docker 部署

```bash
# 仅应用
docker build -t chunke/label-platform:1.0.0 .
docker run -d --name chunke-label -p 8100:8100 -v "$PWD/data:/app/data" chunke/label-platform:1.0.0

# 应用 + Nginx TLS（证书放 deploy/certs/{fullchain.pem,privkey.pem}）
docker compose up -d --build
```

Nginx 暴露 `8080`（HTTP 跳转）与 `8443`（HTTPS），反向代理到应用 `8100`；已内置 HSTS、X-Content-Type-Options、X-Frame-Options、Referrer-Policy 与 2G 上传上限。

### 4.4 体验账号

密码均为 `chunke123`（生产环境请立即修改）：

| 账号 | 平台角色 | 登录入口 | 说明 |
|---|---|---|---|
| `admin` | platform_admin | `#/admin/dashboard` | 平台管理员，可进入管理平台 |
| `honghaifeng` | platform_admin | `#/admin/dashboard` | 平台管理员 |
| `tb_admin` | tenant_admin | `#/tenant/dashboard` | 租户管理员（T20261111-01），仅管理本租户 |
| `liuxiao` | project_manager | 项目平台 | 项目经理，管理所辖项目 |
| `wangmin` / `liqiang` | annotator | 项目平台 | 标注员，仅见分派任务 |
| `zhoulan` | reviewer | 项目平台 | 质检员，仅见待质检任务 |
| `acceptor` | acceptor | 项目平台 | 验收员（陈静），仅见待验收任务 |
| `client` | client | 项目平台 | 客户只读 |

> 验收员演示账号 `acceptor` 仅授予语音客服与 v4 演示项目的验收角色，用于走通「质检通过 → 待验收 → 验收」闭环；生产环境请修改默认口令或停用。

### 4.5 重置本地数据

```bash
rm -f data/chunke.db data/chunke.db-* data/tmp/*
# 重启服务，自动重建种子数据
```

---

## 5. 功能详解

### 5.1 多租户平台控制台

入口：`#/console`

- **租户与配额**：租户列表、用户/项目/存储配额与占用百分比，支持在线调整配额。
- **计量计费**：按标注条数计量，配置单价（元/千条）并估算费用。
- **集成同步**：HTTP 端点双向推送/拉取、连通性测试、同步日志。
- **安全合规**：口令策略、会话时长、下载策略、MFA 要求、审计留存。
- **信创与容量**：系统信息、容量快照、备份与版本升级/回滚。
- **文本质检算子**：算子勾选、阈值/权重/自定义词/组合规则与运行结果高亮。

相关接口：`/api/platform/overview`、`/api/tenants/{id}/quota`、`/api/usage`、`/api/billing/policy`、`/api/integrations*`、`/api/monitoring/*`。

### 5.2 组织、角色与任务级权限

- 平台角色：`platform_admin` / `tenant_admin` / `project_manager` / `annotator` / `reviewer` / `acceptor` / `client`
- 项目角色：`manager` / `annotator` / `reviewer` / `acceptor` / `viewer`
- 自定义角色与权限点：`GET/PATCH /api/roles`、`GET /api/rbac/matrix`；仅平台管理员可修改全局矩阵
- 任务级授权：`GET/POST/DELETE /api/tasks/{tid}/roles`，同一用户可在不同任务中担任标注员、质检员或验收员
- 租户成员：`tenant_members` 维护用户与租户的多对多关系，租户切换只允许已加入的租户
- 数据范围在 SQL 层过滤：标注员仅本人任务、质检员仅待质检任务、验收员仅待验收任务、项目经理仅本项目；租户管理员自动拥有本租户全部项目视角

组织与用户：`GET /api/org/tree`、`PATCH /api/org/users/{uid}`、`POST /api/members`、`PATCH /api/members/{uid}`、`POST /api/members/import`（CSV 上传）、`POST /api/members/import-batch`（JSON 批量）。

上下文与租户：`GET /api/context` 返回当前入口空间、租户、组织/团队、项目与待办计数；`GET /api/tenants/switchable`、`POST /api/tenant/switch` 用于切换已加入租户。

### 5.3 数据集与作业中心

- 导入：文件、ZIP、URL、FTP、HDFS、S3/MinIO 兼容源；大文件分片上传与断点续传。
- 版本：快照、逐条 diff、回滚、内容哈希。
- 生命周期：归档、恢复、软删除、回收站。
- 预处理：音频 16k 单声道/降噪、视频抽帧与转码、去重。
- 异步作业：进度、阶段、错误日志、取消、下载。

接口：`/api/import`、`/api/import/url`、`/api/datasets*`、`/api/jobs*`、`GET/POST /api/datasets/{ds_id}/versions`。

### 5.4 任务大厅与任务包

- 任务大厅按项目/模态/优先级筛选，支持勾选领取与整包领取。
- 任务包支持按包分配、提交、质检与包级退回。
- 返工历史：`GET /api/tasks/{tid}/rework-history`。
- 条件工作流：`/api/workflows`，可按条件路由到不同模板与质检策略。

接口：`/api/task-hall`、`/api/task-hall/claim`、`/api/task-packages*`。

### 5.5 模板编排与模板驱动表单

入口：`#/templates` → 模板编排器。

- 组件类型：容器、分栏、单行/多行文本、单选、多选、下拉、标签、时间戳、不定项、多时序对齐、图片、音频、视频、PDF、表格、代码块、LLM 生成。
- 支持最多 5 层嵌套、组件 ID 去重、`props`/`columns`/`language`/`model`/`accept` 等属性校验。
- 版本升版与灰度投放：按任务哈希命中灰度，未命中按空白表单展示。
- **模板驱动表单**：工作台按任务模板自动渲染字段，支持必填校验、媒体文件选择、表格编辑、代码块、LLM 提示，保存回写标注 `extras.form`。

接口：

```text
GET  /api/templates                         模板列表
GET  /api/templates/{tid}/layout            组件树 + 组件类型目录
PUT  /api/templates/{tid}/layout            保存编排（bump=true 升版）
GET  /api/tasks/{tid}/form                  按任务解析模板、灰度与已填值
POST /api/tasks/{tid}/form                  保存表单值
```

### 5.6 多模态工作台

| 模态 | 能力 |
|---|---|
| 图片 | 矩形/多边形/圆形/自由曲线画布直绘（顶点拖拽、RDP 简化），画笔/填充/橡皮擦分割实例（PNG 位图 + 类别异色），关键点骨骼连线与「复刻关键点」，整图分类与场景属性，缩放/WASD 平移/旋转/镜像/多图对比，多边形合并拆分，SAM 交互分割、OCR 区域、开放词检测，OCR 转写校对（字符级高亮） |
| 音频 | **波形可缩放/平移**（滚轮以光标为中心缩放、拖拽平移、视窗刻度自适应，长音频可放大到句子级）、分段轨道、说话人/情绪/事件、语种、情绪强度 1–5、发音校对（错读/漏读/多读/声调）、ASR 转写、音频预处理 |
| 视频 | 逐帧框、关键帧插值、复制上一帧、**内置自动跟踪**（前两关键帧匀速运动估计传播，可接 `operator.track.url`）、0.5–2 倍速、逐帧/10 帧跳转、行为区间（主体+起止帧）、视频分类与属性 |
| 文本 | 字符级 span、嵌套实体（父子层级）、词性、层级分类、情感极性与强度、A/B 语义匹配、**内置实体预识别**（词典 NER，AI 标记供确认）、文本质检 |
| 点云 | **three.js r160 透视渲染**：轨道/平移/缩放、地面网格；3D 框画布放置与把手拖拽（角点拉伸/顶柄调高/前柄旋转/复制参数）；框选/多边形分割（RLE 索引、语义/实例着色）；车道线多点折线与复用；ROI 裁剪 + 强度筛选；**2D 相机双视图联动 + 标定投影（含点云投影开关）**；**内置 AI 预标注**（聚类 + PCA 拟合，置信度可核对）；4D 帧序列时间轴（快照/播放/逐帧写入）；场景分类；二进制 PCD/BIN/PLY 解析 |
| LLM | 问答对生成/采纳、多轮对话、偏好排序、评分、润色、视觉语言 |
| 多模态 | 图/音/视频与文本配对、A/B 时间区间与区域、同步定位/播放、偏差提示 |
| PDF | 文档区域、OCR 字段映射、问答生成、多算子对比与来源标注 |

扩展标注统一保存到 `annotations.extras`：

```json
{
  "events": [{ "start": 1.2, "end": 3.4, "label": "跌倒", "score": 0.88 }],
  "polygons": [{ "label": "商品", "points": [[0.1,0.2],[0.4,0.2],[0.4,0.6]], "holes": [] }],
  "ocr_regions": [{ "page": 1, "bbox": [0.1,0.1,0.5,0.2], "text": "巡检记录", "conf": 0.93, "field": "title" }],
  "pairs": [{ "a": "图像A", "b": "文本B", "verdict": "match", "a_start": 1.0, "a_end": 2.5, "b_start": 1.2, "b_end": 2.8 }],
  "dialog": [{ "role": "user", "content": "如何清洗数据？", "turn": 1 }],
  "ratings": [{ "dimension": "准确性", "score": 9 }],
  "polish": [{ "original": "原文", "polished": "润色后", "style": "简洁", "accepted": true }],
  "form": { "组件ID": "值" }
}
```

接口：`GET/POST /api/tasks/{tid}/annotation/extras`、`/api/tasks/{tid}/annotation/history`、`/api/tasks/{tid}/tracks`。

### 5.7 交互式算子

统一入口：`POST /api/operators/run`

```json
{ "task_id": 16, "operator": "sam", "input": { "boxes": [{ "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4 }] } }
```

| 算子 | 能力 | 外部服务配置 |
|---|---|---|
| `sam` / `segment` | 框/点/混合提示、正负样本、多实例、可编辑多边形与孔洞 | `operator.sam.url` |
| `ocr` | 区域 OCR、置信度、字段映射、平均置信度 | `operator.ocr.url` |
| `track` | 前向/后向/双向传播、`max_gap` 断轨、轨迹合并、步长/时长 | `operator.track.url` |
| `qa` | 文档问答生成、抽取式答案 | `operator.qa.url` |
| `llm` | 文本润色/生成（简洁/学术/口语） | `operator.llm.url` |
| `asr` | 语音转写（本地 FunASR 或外部） | `operator.asr.url` |
| `open_vocab` | 开放词检测 | `operator.open_vocab.url` |

多算子问答对比：`POST /api/qa/compare`，并排返回「内置抽取式 / 模板生成 / 外部模型」结果与来源 `start/end`。

未配置外部地址时返回 `provider=builtin` 与 `note` 字段，说明当前为降级结果。

### 5.8 智能质检

- 算子：错别字/拼写、标点规范、语法与句式、Markdown/HTML、LaTeX 公式。
- 规则配置：启用开关、错误/警告权重、通过阈值、最大问题数、自定义词、组合规则。
- 结果字段：`level`、`op`、`message`、`start`、`end`、`suggestion`、`score`、`passed`、`breakdown`、`weights`。
- 前端按字符位置高亮原文，结果表展示级别/算子/位置/建议/说明。

接口：

```text
GET  /api/qc/rules                 读取质检规则
PUT  /api/qc/rules                 保存质检规则
POST /api/qc/operators/run         对文本运行质检算子
GET  /api/qc/operators             算子目录
```

### 5.9 集成、监控与安全

- **双向集成**：`/api/integrations` 增删改查、`/test` 连通性、`/push`、`/pull`、入站 `/api/integrations/inbound`。
- **监控**：`/metrics`、`/api/monitoring/summary`、Prometheus/Loki/数据湖地址可配置，支持手动推送指标。
- **备份与升级**：`/api/ops/backups`、`/api/ops/backup`、`/api/ops/backups/{bid}/restore`、`/api/ops/version`、`/api/ops/upgrade`、`/api/ops/rollback`。
- **认证**：PBKDF2 口令、HttpOnly Cookie 会话、TOTP MFA、OIDC SSO、SCIM 2.0、API Key。
- **数据保护**：IP 白名单、媒体短时 Token、下载策略、全屏水印、审计 CSV 导出、TC609 证据包。

### 5.10 质检与验收闭环

任务状态机：

```text
待标注 pending → 标注中 annotating → 待质检 submitted → 质检中 review
      → 待验收 review_done → 已完成 done
                ↑ 驳回                    ↑ 验收驳回
                └──────── 标注/质检 ───────┘
```

- 质检通过（含免检自动通过）不再直接完成，而是进入 `review_done`，由验收员确认交付质量。
- 验收通过进入 `done`；验收驳回回到 `annotating`（需重标）或 `review`（仅需复检）。
- 每次验收写入 `acceptance_records`；每次驳回可勾选错误类型，写入 `qc_records.error_types`。
- 验收员只能看到 `review_done` 任务；普通标注员/质检员无法调用验收接口。

接口：

```text
GET  /api/acceptance                 待验收队列
POST /api/tasks/{tid}/accept         验收：{ "result": "approved|rejected", "comment": "", "target": "annotating|review" }
POST /api/tasks/batch-review         批量质检：{ "task_ids": [], "result": "approved|rejected", "score": 90, "comment": "", "error_types": [] }
POST /api/tasks/batch-accept         批量验收：{ "task_ids": [], "result": "approved|rejected", "comment": "", "target": "annotating|review" }
GET  /api/quality/error-types        驳回错误类型分布
```

### 5.11 生产线能力（语音赛道）

- **时长配额任务包**：`task_packages.quota_minutes/used_minutes` + `tasks.est_minutes`（音频任务按时长自动回填）；任务大厅展示「目标时长/已分配/剩余」，领取时校验并扣减，超员拒绝并给出原因。
- **双轨计价**：`billing.mode = per_item | per_hour`，平台控制台分别维护元/千条与元/小时单价，用量看板统计已完成时长。
- **长音频切分工序**：作业中心「长音频切分」上传音频按固定时长切成子任务（wav 原生，其余走 ffmpeg），自动携带时长，可专人切分、分轮标注。
- **考试门禁**：项目级可选开关（默认关）；`exam_papers/exam_records` 试卷与成绩，运营服务「上岗考试」页签管理/应考；开启后未通过考试的任务大厅领取被拦截。
- **申诉仲裁**：验收驳回后标注员可申请仲裁（任务挂起 `appeal` 态、标注锁定），平台/项目经理仲裁「维持驳回/改判通过」，全程留痕并通知双方。
- **错题本**：`/api/my/errors` 把 `qc_records.error_types` 按人聚合（管理角色可查团队成员），「我的错题/团队错题」页支持跳转任务复盘。
- **段级工作明细**：质检可选择「问题段定位」记录到段（`qc_records.item_index`），「明细」弹窗展示每段的起止/文本/质检结论/意见。
- **AI 助手**：右下角悬浮气泡，读取当前任务的规范模板与历史质检意见做检索式问答；配置 `operator.llm.url` 后切换真实大模型。

### 5.12 标注规范模板库与违规预警

- **规范模板库**：模板中心「标注规范模板库」支持创建/编辑可复用规范（适用模态 + 条文 + 示例截图/PDF 附件），并可绑定到项目（`PATCH /api/projects/{pid}` 的 `spec_id`）。
- **工作台实时展示**：图片/语音工作台右侧常驻规范面板，逐条展示规范要点，示例图点击放大。
- **违规即时预警**：保存标注时自动运行项目规则引擎（`quality_rules`），响应携带 `violations` 并在工作台顶部弹预警条；提交时若有 error 级违规返回 `428 confirm_required`，确认后可 `force` 强制提交交由质检复核。

### 5.13 外部数据集导入

`scripts/import_datasets.py` 把本机已下载的公开数据集一键导入为标注任务（幂等，按项目+任务名去重）：

```bash
python3 scripts/import_datasets.py --root /Volumes/ORICO/data/datasets --only all
```

| 数据源 | 目标项目 | 说明 |
|---|---|---|
| `kitti_image` | 城市治理-人车流量检测 | KITTI object/training 图片 + label_2 二维真值框（AI 预识别 + 部分人工确认） |
| `kitti_lidar` | 智驾-点云目标标框 | velodyne 点云（3 万点）+ 标定矩阵精确换算 3D 框 + 同帧相机图（双视图投影联动） |
| `nuscenes` | 智驾-点云目标标框 | nuScenes mini LIDAR_TOP 点云，按微秒时间戳匹配 CAM_FRONT 图作为附件 |
| `dair` | 城市治理-人车流量检测 | DAIR-V2X-C（需镜像包含图像文件；仅标注包的镜像会自动跳过） |

---

## 6. 演示路径

三大基础场景（语音 / 图片 / 文本）已预置真实演示数据，登录 `wangmin` 即可在「我的任务」中直接标注：

| 场景 | 项目 | 演示任务 | 演示点 |
|---|---|---|---|
| 语音 | 语音-客服话术质检 | 客服来电-20261123-001/002 | 波形播放、FunASR 预识别、分段转写、说话人/情绪/事件、业务分类 |
| 图片 | 城市治理-人车流量检测 | 路口抓拍-曼哈顿-001 等 | 画布直绘多边形/分割/关键点、Grounding DINO 预识别、名称下拉、CSV 导出、类别筛选、整图分类 |
| 文本 | 文本-用户评论标注 | 评论标注-0001/0002 | 语料自动加载、嵌套实体、预识别实体、情感极性/强度、层级分类、语义匹配 |
| 3D 点云 | 智驾-点云目标标框 | kitti-点云-000006 等 | three.js 透视渲染、双视图 2D 投影联动、AI 预标注、框拖拽/分割、4D 帧序列 |

多模态演示项目：`demo-v4-multi`（演示-视频/文档/大模型/多模态）

| 任务 | 模态 | 演示点 |
|---|---|---|
| 16 | 视频 | 事件区间时间轴、逐帧框、跟踪方向/断轨/合并、SAM 多实例 |
| 17 | PDF | 模板表单、文档区域、OCR 字段映射、问答对比与来源 |
| 18 | LLM | 问答对、多轮对话、评分、润色采纳、模板表单 |
| 19 | 多模态 | A/B 时间区间与区域配对、双色时间条、同步定位、偏差提示 |

推荐演示顺序（约 15 分钟）：

1. 登录 `admin` → 自动进入管理平台 `#/admin/dashboard`，查看平台总览、租户与 RBAC 矩阵。
2. 切换到 `tb_admin` 登录 → 租户平台 `#/tenant/dashboard`，展示本租户项目/团队/成员与租户切换器。
3. 切换到 `wangmin` 登录 → 项目平台 `#/project/1/dashboard`，展示“我的任务/任务大厅”。
4. 基础场景三件套：打开「客服来电」任务演示波形与预识别；打开「路口抓拍-曼哈顿」演示人/车画框与 AI 预识别；打开「评论标注-0001」演示实体高亮与情感标注。
5. 平台控制台 → 租户配额、计量计费、安全合规基线。
6. 模板中心 → 打开任一模板编排器，展示组件库、嵌套、灰度与版本。
7. 任务中心 → 打开任务 16，演示时间轴、SAM 与跟踪参数。
8. 打开任务 17，演示 PDF 区域、OCR 字段映射、问答对比。
9. 打开任务 18，演示问答对、多轮对话、润色采纳。
10. 打开任务 19，演示跨模态配对与同步定位。
11. 平台控制台 → 文本质检算子，输入 `这个帐号登陆失败,,请检查.` 运行，展示得分、位置与高亮。
12. 质检驳回：勾选“漏标/框选偏差”等错误类型，展示质检页错误类型分布。
13. 验收闭环：质检通过 → 待验收 → `acceptor`（陈静）验收通过进入已完成；验收驳回退回标注/质检。
14. 成员管理 → 批量导入，粘贴 `zhangsan,张三,标注员,chunke123` 演示逐行校验。
15. 运维：监控摘要、备份、审计导出。

---

## 7. API 摘要

完整 OpenAPI：`GET /docs`（Swagger UI）或 `GET /api/v1/openapi.json`。

| 分组 | 代表接口 |
|---|---|
| 认证与上下文 | `POST /api/login`、`GET /api/me`、`GET /api/context`、`GET /api/tenants/switchable`、`POST /api/tenant/switch`、`GET /api/auth/mfa/*`、`GET /api/auth/sso/start` |
| 任务 | `GET /api/tasks`、`GET /api/tasks/{tid}`、`POST /api/tasks/{tid}/annotation`、`/submit`、`/review`、`/accept`、`GET /api/acceptance` |
| 组织与成员 | `GET /api/org/tree`、`POST /api/members`、`PATCH /api/members/{uid}`、`POST /api/members/import`、`POST /api/members/import-batch` |
| 模板 | `GET/PUT /api/templates/{tid}/layout`、`GET/POST /api/tasks/{tid}/form` |
| 扩展标注 | `GET/POST /api/tasks/{tid}/annotation/extras` |
| 算子 | `POST /api/operators/run`、`POST /api/qa/compare`、`GET /api/operators/catalog` |
| 质检 | `GET/PUT /api/qc/rules`、`POST /api/qc/operators/run`、`GET /api/quality/error-types` |
| 数据集 | `GET/POST /api/datasets`、`/versions`、`/export`、`/import` |
| 任务治理 | `/api/task-hall`、`/api/task-packages`、`/api/workflows` |
| 平台 | `/api/platform/overview`、`/api/usage`、`/api/billing/policy`、`/api/integrations` |
| 运维 | `/metrics`、`/api/monitoring/summary`、`/api/ops/*` |
| 开放 API | `/api/v1/*`（API Key）、`/scim/v2/*`（SCIM Token） |

分页与错误约定：列表接口使用 `page`/`limit`，错误统一返回 `{"detail": "..."}` 并带对应 HTTP 状态码。

---

## 8. 配置项

配置写入 `settings` 表，可在平台控制台/设置页维护，也可通过对应运维接口保存。

| 配置键 | 说明 |
|---|---|
| `operator.<name>.url` | 外部算子地址（sam/ocr/track/qa/llm/asr/open_vocab） |
| `qc.rules` | 质检规则 JSON（启停、权重、阈值、自定义词、组合规则） |
| `storage.driver` | 存储驱动：local / s3 / minio |
| `monitor.prometheus_url` / `monitor.loki_url` / `monitor.datalake_url` | 监控与数据湖地址 |
| `brand_name` / `brand_short` / `brand_color` / `brand_logo` | 品牌配置 |
| `watermark` | 界面水印内容 |
| `ip_allowlist` | API 访问 IP 白名单（逗号分隔） |
| `mfa_required` | 是否强制 MFA |
| `media_token_ttl` | 媒体短时 Token 有效期 |
| `log_retention_days` | 审计日志留存天数 |
| `sso_provider` / `sso_authorize_url` / `sso_token_url` / `sso_client_id` / `sso_client_secret` / `sso_redirect_uri` | OIDC SSO |
| `scim_token` / `integration.inbound_token` | SCIM 与入站集成 Token |
| `billing.price_per_k` | 计量单价（元/千条） |

环境变量：

| 变量 | 说明 |
|---|---|
| `CK_SECRET_KEY` | 凭据加密主密钥；未设置时使用 `data/secret.key`（首次自动生成） |
| `CK_PUBLIC_URL` | 对外访问地址，用于 OIDC 回调拼接 |

---

## 9. 测试与校验

```bash
# 语法检查
python3 -m py_compile app/*.py
node --check app/static/app.js
node --check app/static/pages_v3.js
node --check app/static/pages_v4.js

# 健康检查
curl -s http://127.0.0.1:8100/health

# 只读并发压测
python3 scripts/loadtest.py --base http://127.0.0.1:8100 \
  --user admin --password chunke123 --concurrency 20 --rounds 10
```

接口冒烟示例：

```bash
# 登录并保存 Cookie
curl -s -c /tmp/ck.jar -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"chunke123"}' \
  http://127.0.0.1:8100/api/login

# 模板表单
curl -s -b /tmp/ck.jar http://127.0.0.1:8100/api/tasks/17/form

# SAM 多实例
curl -s -b /tmp/ck.jar -H 'Content-Type: application/json' \
  -d '{"task_id":16,"operator":"sam","input":{"boxes":[{"x":0.1,"y":0.2,"w":0.3,"h":0.4}]}}' \
  http://127.0.0.1:8100/api/operators/run

# 文本质检
curl -s -b /tmp/ck.jar -H 'Content-Type: application/json' \
  -d '{"text":"这个帐号登陆失败,,请检查.","threshold":80}' \
  http://127.0.0.1:8100/api/qc/operators/run
```

---

## 10. 数据与存储

- 默认数据库：`data/chunke.db`（WAL），启动时自动迁移与补齐 schema。
- 媒体目录：`data/media/`，任务媒体经 `task_media` 关联；支持本地与 S3 兼容存储。
- 备份目录：`data/backups/`（已被 `.gitignore` 忽略）。
- 凭据加密密钥：`data/secret.key` 或 `CK_SECRET_KEY`（不入库）。
- 主要数据表：`tenants`、`tenant_members`、`users`、`orgs`、`teams`、`projects`、`project_members`、`task_roles`、`tasks`、`annotations`、`annotation_versions`、`acceptance_records`、`templates`、`template_layouts`、`template_versions`、`datasets`、`dataset_versions`、`dataset_items`、`workflows`、`task_packages`、`rework_events`、`qc_records`、`quality_rules`、`spec_templates`、`sessions`、`operators`、`operator_runs`、`integration_endpoints`、`sync_logs`、`secret_vault`、`api_keys`、`security_events`、`capacity_snapshots`。

---

## 11. 外部依赖与已知限制

**需要外部条件的能力**

- SAM/OCR/跟踪/文档问答/LLM/ASR：默认内置降级；生产精度需接入对应推理服务并配置 `operator.<name>.url`。
- 等保三级测评、信创硬件实测、200 用户压测：需在交付环境执行并出具报告。
- FunASR 语音转写：需要独立 Python 3.10 venv 与模型权重，路径见 `app/prelabel.py` 顶部常量；未安装时不影响其他模态。
- 点云渲染/大模型评测等重依赖能力，建议在具备 GPU 的环境部署。

**当前限制**

- 单机 SQLite 架构，超大规模并发建议迁移 PostgreSQL 并增加对象存储。
- 视频抽帧与转码依赖本机 ffmpeg。
- 内置算法为规则/几何降级实现，精度不等同于生产模型；点云 AI 预标注为聚类启发式，仅作预识别供人工核对。
- 点云工作台已支持 3D 框交互、点云分割（RLE）、车道线、4D 帧序列与 2D 投影联动；**点级语义分割**与真实连续点云序列（流式 PCD 帧）尚未实现。
- 视频跟踪内置匀速运动估计降级，生产精度可接 `operator.track.url`。
- 多语言目前提供语言偏好字段与数据集 `lang` 标记，**全站中英文词条翻译**尚未完成。
- 页面水印已实现；导出 CSV/JSON 文件内嵌水印未实现，避免破坏训练数据格式。
- 批量导入支持 CSV 上传与 JSON 批量；百万级性能、平板适配与私有化安装包需在交付环境专项验证。

---

## 12. License

Proprietary © 杭州春科数据科技有限公司。未经授权不得复制、分发或用于商业用途。
