#!/usr/bin/env bash
# 春科数据标注平台启动脚本
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100 --workers 1
