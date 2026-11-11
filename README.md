# 春科数据标注平台 v4

面向国家人工智能应用中试基地（消费领域·家居家电方向）的数据标注平台，覆盖 **数据导入 → 数据集版本 → 任务分派/领取 → 多模态标注 → 智能质检 → 导出与集成** 全链路。

后端 **FastAPI + SQLite（WAL）**，前端 **原生 HTML/CSS/JS（无构建工具，hash 路由 SPA）**，支持本地部署与 Docker Compose 部署。

- 访问入口：`http://127.0.0.1:8100`
- 健康检查：`GET /health`
- 指标端点：`GET /metrics`（Prometheus 文本格式）
- 缺口分析与演示清单：[docs/bid-gap-analysis/bid-gap-analysis.html](docs/bid-gap-analysis/bid-gap-analysis.html)

---

## 1. 核心能力

| 能力域 | 主要内容 |
|---|---|
| 多租户与平台控制台 | 平台 → 租户 → 项目三级隔离；用户/项目/存储配额；用量计量与计费策略；租户切换 |
| 组织与权限 | 平台角色 + 项目角色 + 自定义角色；任务级角色授权；RBAC 权限矩阵 |
| 数据集与作业 | ZIP/URL/FTP/HDFS/S3-兼容导入、分片续传、版本快照/diff/回滚、生命周期与回收站 |
| 任务治理 | 任务大厅、任务包、领取锁、条件工作流、暂停/恢复/终止、包级退回与返工历史 |
| 模板编排 | 组件库、嵌套容器、属性与校验、版本升版与灰度投放、模板驱动表单 |
| 多模态标注 | 图片/音频/视频/文本/点云/LLM/多模态/PDF 八类工作台 |
| 交互式算子 | SAM 分割、OCR、视频跟踪、文档问答、ASR、开放词检测、文本润色（内置降级 + 外部服务） |
| 智能质检 | 规则引擎 + 质检算子库 + 阈值/权重/组合规则 + 字符级定位高亮 |
| 集成与运维 | 双向集成端点、Prometheus/Loki/数据湖、备份恢复、升级回滚、TLS 反向代理 |
| 安全合规 | PBKDF2 口令、Cookie 会话、IP 白名单、TOTP MFA、OIDC SSO、SCIM 2.0、API Key、媒体短时 Token、水印、审计导出 |

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
- 原生 HTML/CSS/JS，无 Node 构建步骤
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
│   └── static/
│       ├── index.html
│       ├── styles.css
│       ├── app.js         # SPA 框架、任务、工作台
│       ├── pages_v3.js    # 作业中心/任务大厅/算子/质检/运维
│       └── pages_v4.js    # 控制台/模板编排/高级标注/质检算子
├── scripts/
│   ├── run.sh             # 本地启动
│   ├── asr_worker.py      # FunASR 离线转写 worker
│   ├── detect_worker.py   # 图片检测 worker
│   └── loadtest.py        # 只读并发压测
├── deploy/
│   └── nginx.conf         # TLS 终止与反向代理
├── docs/
│   └── bid-gap-analysis/  # 招标需求差距分析与演示清单
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

| 账号 | 平台角色 | 说明 |
|---|---|---|
| `admin` | platform_admin | 平台管理员，可进入平台控制台 |
| `honghaifeng` | platform_admin | 平台管理员 |
| `liuxiao` | project_manager | 项目经理，管理所辖项目 |
| `wangmin` / `liqiang` | annotator | 标注员，仅见分派任务 |
| `zhoulan` | reviewer | 质检员，仅见待质检任务 |
| `client` | client | 客户只读 |

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

- 平台角色：`platform_admin` / `project_manager` / `annotator` / `reviewer` / `client`
- 项目角色：`manager` / `annotator` / `reviewer` / `viewer`
- 自定义角色与权限点：`GET/PATCH /api/roles`、`GET /api/rbac/matrix`
- 任务级授权：`GET/POST/DELETE /api/tasks/{tid}/roles`
- 数据范围在 SQL 层过滤：标注员仅本人任务、质检员仅待质检任务、项目经理仅本项目。

组织与用户：`GET /api/org/tree`、`PATCH /api/org/users/{uid}`、`POST /api/members/import`、`POST /api/members/bulk`。

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
| 图片 | 矩形框、多边形/孔洞、掩码、关键点、SAM 交互分割、OCR 区域、开放词检测 |
| 音频 | 波形 + 分段轨道、说话人/情绪/事件、ASR 转写、音频预处理 |
| 视频 | 逐帧框、关键帧插值、事件区间时间轴、跟踪方向/断轨/合并、抽帧 |
| 文本 | 字符级 span、分类/实体/关系、文本质检 |
| 点云 | 3D 投影框、语义分割、多传感器融合 |
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

---

## 6. 演示路径

演示项目：`demo-v4-multi`（演示-视频/文档/大模型/多模态）

| 任务 | 模态 | 演示点 |
|---|---|---|
| 16 | 视频 | 事件区间时间轴、逐帧框、跟踪方向/断轨/合并、SAM 多实例 |
| 17 | PDF | 模板表单、文档区域、OCR 字段映射、问答对比与来源 |
| 18 | LLM | 问答对、多轮对话、评分、润色采纳、模板表单 |
| 19 | 多模态 | A/B 时间区间与区域配对、双色时间条、同步定位、偏差提示 |

推荐的 10 分钟演示顺序：

1. 登录 `admin` → 工作台查看项目与统计。
2. 平台控制台 → 租户配额、计量计费、安全合规基线。
3. 模板中心 → 打开任一模板编排器，展示组件库、嵌套、灰度与版本。
4. 任务中心 → 打开任务 16，演示时间轴、SAM 与跟踪参数。
5. 打开任务 17，演示 PDF 区域、OCR 字段映射、问答对比。
6. 打开任务 18，演示问答对、多轮对话、润色采纳。
7. 打开任务 19，演示跨模态配对与同步定位。
8. 平台控制台 → 文本质检算子，输入 `这个帐号登陆失败,,请检查.` 运行，展示得分、位置与高亮。
9. 导出/集成：任务提交质检 → 质检通过 → 数据集导出。
10. 运维：监控摘要、备份、审计导出。

---

## 7. API 摘要

完整 OpenAPI：`GET /docs`（Swagger UI）或 `GET /api/v1/openapi.json`。

| 分组 | 代表接口 |
|---|---|
| 认证 | `POST /api/login`、`GET /api/me`、`GET /api/auth/mfa/*`、`GET /api/auth/sso/start` |
| 任务 | `GET /api/tasks`、`GET /api/tasks/{tid}`、`POST /api/tasks/{tid}/annotation`、`/submit`、`/review` |
| 模板 | `GET/PUT /api/templates/{tid}/layout`、`GET/POST /api/tasks/{tid}/form` |
| 扩展标注 | `GET/POST /api/tasks/{tid}/annotation/extras` |
| 算子 | `POST /api/operators/run`、`POST /api/qa/compare`、`GET /api/operators/catalog` |
| 质检 | `GET/PUT /api/qc/rules`、`POST /api/qc/operators/run` |
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
- 主要数据表：`tenants`、`users`、`projects`、`tasks`、`annotations`、`annotation_versions`、`templates`、`template_layouts`、`template_versions`、`datasets`、`dataset_versions`、`dataset_items`、`workflows`、`task_packages`、`rework_events`、`qc_records`、`quality_rules`、`operators`、`operator_runs`、`integration_endpoints`、`sync_logs`、`secret_vault`、`api_keys`、`security_events`、`capacity_snapshots`。

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
- 内置算法为规则/几何降级实现，精度不等同于生产模型。

---

## 12. License

Proprietary © 春科科技。未经授权不得复制、分发或用于商业用途。
