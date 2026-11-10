# 春科数据标注平台

> 为**语音质检**、**图片检测**、**视频审核**、**点云**四大业务场景设计的一站式内部标注平台。后端 FastAPI + SQLite，前端纯原生 JS（无构建工具），语音预识别集成本地 FunASR，图片标注在 Canvas 上绘制矩形框。

- 访问入口：`http://127.0.0.1:8100`
- 技术栈：Python 3.10 + FastAPI · SQLite（Py 3.12 venv 运行）· 原生 HTML/CSS/JS
- 设计方向：深色 B2B 工作台（density 8），主色 `#3B82F6`，单页 hash 路由

---

## 快速开始

```bash
# 1. 克隆仓库并进入项目根目录
git clone https://github.com/honghaifeng/chunke-label-platform.git
cd chunke-label-platform

# 2. 建立 Python 虚拟环境并装依赖（任选其一）
python3 -m venv .venv && . .venv/bin/activate
pip install fastapi uvicorn python-multipart aiofiles onnxruntime scikit-learn numpy pydantic

# 或用 uv（推荐）
/Volumes/ORICO/toolchain/bin/uv venv .venv --python 3.12
/Volumes/ORICO/toolchain/bin/uv pip install fastapi uvicorn python-multipart aiofiles onnxruntime scikit-learn numpy pydantic

# 3. 启动服务
bash scripts/run.sh

# 4. 浏览器打开 http://127.0.0.1:8100
```

> **语音预识别 FunASR 需要 Python 3.10 单独的 venv**，本项目自带的 worker 脚本 `scripts/asr_worker.py` 会自动 `subprocess` 调起 `voice-repos/FunASR/.venv/bin/python`（路径见 `app/prelabel.py` 顶部常量 `FUNASR_PY`）。如果本机 FunASR venv 不在该位置，请改 `app/prelabel.py` 的路径常量。

### 体验账号（密码均为 `chunke123`）

| 账号 | 平台角色 | 可做什么 |
|---|---|---|
| `admin` | platform_admin | 全部 |
| `honghaifeng` | platform_admin | 全部 |
| `liuxiao` | project_manager | 所管项目全部任务 |
| `wangmin` / `liqiang` | annotator | 只看到分派给自己的任务 |
| `zhoulan` | reviewer | 只看到待质检的任务 |
| `client` | client | 只读 |

种子数据由 `app/db.py::init_db()` 首次启动时写入 SQLite（`data/chunke.db`），包含 3 个项目、5 张真实货架图、4 段客服通话。若要重置：

```bash
rm -f data/chunke.db* data/tmp/*
# 重启服务
```

---

## 能力总览

### 1. 权限体系（双重）

| 层级 | 值 |
|---|---|
| 平台角色 | `platform_admin` / `project_manager` / `annotator` / `reviewer` / `client` |
| 项目角色 | `manager` / `annotator` / `reviewer` / `viewer` |

`app/auth.py::task_scope_sql()` 在 SQL 层按角色过滤可见任务：annotator → `assignee_id = me`，reviewer → `reviewer_id = me`，manager → 项目内全部，admin 放行全部。不是前端隐藏，是数据库层硬过滤。

### 2. 工作台

按 `media_type` 分支渲染两种不同的标注界面：

#### 音频标注（wave + 分段编辑）

- Canvas 波形 + 分段轨道（按说话人着色）+ 播放指针
- 工具栏：播放/暂停 / ±10s / 倍速 0.5x~2.0x / 跳转段落
- 段落行：序号 · 说话人胶囊（彩色点 + 下拉改名）· 起止秒数输入 · 时长 · 情绪 · 事件标签（笑声/静音/重叠发言/噪音/打断）· 删除
- 播放到某段时该行高亮（`.playing`），点行空白处跳到段落起点
- 4 秒无操作自动保存草稿（`POST /api/tasks/{tid}/annotation`）
- 快捷键：`Space` 播放/暂停，`←/→` ±1s

#### 图片标注（Canvas 画框）

- `<img>` 底图 + 全屏覆盖 `<canvas>`，canvas 接收鼠标事件
- 归一化坐标存储 `{x,y,w,h}` ∈ [0,1]，缩放自适应，不依赖源图尺寸
- 右侧目标类别按钮（商品主体 / 价签 / 货架 / 遮挡 等，来自项目 `label_config`）
- 拖拽画矩形框 → 松开按当前选中类别入库；实时状态「N 个框」
- 点击已有框 → confirm 删除；侧栏列表也能删、能改类别
- Canvas 顶部带颜色编码的 `#N 类别` 标签

### 3. AI 预识别（语音）

```
音频输入（16k 单声道）
  │
  ├── FSMN-VAD 切分（FunASR 内置）
  ├── Paraformer-large ASR + 字级时间戳
  ├── CT-Transformer 标点
  ├── CAM++ 声纹 embedding + AgglomerativeClustering(cosine, average) 聚类
  │     └── FunASR 内置聚类在短音频上容易并簇，改为自建 sklearn 聚类
  ├── emotion2vec_plus_large → 情绪映射
  │     生气→愤怒、厌恶/难过/恐惧→不满、开心→满意、惊讶/中性→中性
  └── pyannote segmentation-3.0 ONNX → 重叠发言检测
        powerset 7 类 → 帧级 speaker count ≥ 2 → 命中段打标
```

性能：纯 CPU，RTF ≈ 0.075，10s 音频约 0.75s 出结果（首次加载模型 ~10-20s）。

入口：`POST /api/tasks/{tid}/prelabel`（body: `{ emotion: true/false }`）。

### 4. 质检闭环

- 标注员提交后状态 → `reviewing`
- 质检员在 `#/qc` 并排查看「人工结果 vs AI 预识别」，可打分 / 写 comment
- 结果写 `qc_records` 表 + `audit_log`

### 5. 后端 API

| 方法 | 路径 | 作用 |
|---|---|---|
| POST | `/api/login` | PBKDF2 校验，cookie session |
| GET | `/api/me` | 当前用户 + 可见项目列表 |
| GET | `/api/tasks?status=&project_id=&q=` | 任务清单（SQL 过滤） |
| GET | `/api/tasks/{tid}` | 任务详情 + 标注 + 质检 |
| POST | `/api/tasks/{tid}/media` | 上传媒体（ffmpeg 转 16k mono） |
| POST | `/api/tasks/{tid}/prelabel` | FunASR 预识别（可选含情绪） |
| POST | `/api/tasks/{tid}/annotation` | 保存标注 payload（audio: `segments[]`, image: `boxes[]`） |
| POST | `/api/tasks/{tid}/submit` | 提交质检（`status → reviewing`） |
| POST | `/api/tasks/{tid}/review` | 质检结论（`approved` / `rejected` + 分数 + comment） |
| GET | `/api/qc` | 待质检队列 |
| GET | `/api/stats` | KPI + 趋势 + 项目进度 |

payload 格式自动随 `media_type` 切换：

```json
// 音频
{ "segments": [{ "start": 0.0, "end": 2.55, "text": "您好", "spk": "坐席", "emotion": "中性", "events": [] }], ... }

// 图片
{ "img_size": { "w": 1400, "h": 933 }, "boxes": [{ "cls": "商品主体", "x": 0.12, "y": 0.23, "w": 0.18, "h": 0.41 }] }
```

---

## 目录结构

```text
chunke-label-platform/
├── app/
│   ├── __init__.py
│   ├── auth.py              # 会话、角色、权限
│   ├── db.py                # SQLite schema + 种子数据
│   ├── main.py              # FastAPI 路由（≈600 行）
│   ├── overlap.py           # pyannote ONNX 重叠发言检测
│   ├── prelabel.py          # FunASR worker 子进程包装
│   └── static/
│       ├── index.html
│       ├── styles.css
│       └── app.js           # 1200+ 行，hash 路由 + 音频/图片标注
├── scripts/
│   ├── asr_worker.py        # FunASR 离线转写 worker（py3.10）
│   └── run.sh               # 本地启动脚本
├── data/
│   ├── media/               # 项目媒体（进 git）
│   ├── tmp/                 # 上传中转（被 gitignore）
│   └── chunke.db            # SQLite（被 gitignore）
├── .gitignore
└── README.md
```

---

## 已对接的模型资产

| 模型 | 用途 | 位置 |
|---|---|---|
| Paraformer-large | 中文 ASR + 字级时间戳 | `/Volumes/ORICO/voice-ai/models/modelscope/...` |
| FSMN-VAD | 语音活动检测 | 同上 |
| CT-Transformer punc | 标点恢复 | 同上 |
| CAM++ | 说话人声纹 embedding | 同上 |
| emotion2vec_plus_large | 情绪识别（9 类） | 同上 |
| pyannote segmentation-3.0 ONNX | 重叠发言检测 | `/Volumes/ORICO/voice-ai/models/diarization/` |
| 3D-Speaker CAM++ ONNX | 声纹（ONNX 推理版） | 同上 |

若 FunASR venv 不在默认位置，改 `app/prelabel.py` 顶部的 `FUNASR_PY` 常量即可。

---

## 限制与后续

- **CVAT**（点云 3D 框）：镜像未拉取成功，Docker 资源紧张时请清理后 `docker compose up -d` 或单独部署。
- **视频标注**：当前无专用工作台，后续可基于 `<video>` + canvas 帧切片扩展。
- **UVR5 人声分离**：权重已下载，缺 MDX 推理代码，噪音场景预处理暂未接入。
- **真实录音调优**：ASR 对 TTS 音频有识别误差（如「订单」→「订箱单号」），真实录音需配业务热词表（worker 已支持 `hotword` 参数）。

---

## License

Proprietary © 春科科技
