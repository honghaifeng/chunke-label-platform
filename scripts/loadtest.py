#!/usr/bin/env python3
"""平台只读压测：登录、进入工作台、拉取任务列表与任务详情。

用法：
    python3 scripts/loadtest.py --base http://127.0.0.1:8100 \
        --user admin --password chunke123 --concurrency 20 --rounds 10
"""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import statistics
import threading
import time
import urllib.request

RESULTS: list[tuple[str, float, int]] = []
LOCK = threading.Lock()


def _client(base: str) -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def _call(opener, base: str, path: str, method: str = "GET", body: dict | None = None) -> int:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    started = time.perf_counter()
    try:
        with opener.open(req, timeout=30) as resp:
            resp.read()
            code = resp.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    except Exception:  # noqa: BLE001 网络异常按 0 记录
        code = 0
    with LOCK:
        RESULTS.append((path, (time.perf_counter() - started) * 1000, code))


def worker(base: str, user: str, password: str, rounds: int) -> None:
    op = _client(base)
    _call(op, base, "/api/login", "POST", {"username": user, "password": password})
    for _ in range(rounds):
        _call(op, base, "/api/bootstrap")
        _call(op, base, "/api/tasks?limit=30")
        _call(op, base, "/api/my/todo")
        _call(op, base, "/api/tasks/1")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8100")
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", default="chunke123")
    ap.add_argument("--concurrency", type=int, default=10)
    ap.add_argument("--rounds", type=int, default=5)
    args = ap.parse_args()

    threads = [threading.Thread(target=worker, args=(args.base, args.user, args.password, args.rounds))
               for _ in range(args.concurrency)]
    started = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.perf_counter() - started

    times = [r[1] for r in RESULTS]
    errors = [r for r in RESULTS if r[2] >= 400 or r[2] == 0]
    times.sort()
    p95 = times[int(len(times) * 0.95) - 1] if times else 0
    print(f"请求数 {len(RESULTS)} · 并发 {args.concurrency} · 耗时 {elapsed:.2f}s "
          f"· QPS {len(RESULTS) / elapsed:.1f}")
    print(f"平均 {statistics.mean(times):.1f}ms · P95 {p95:.1f}ms · 失败 {len(errors)}")
    for path, _, code in errors[:20]:
        print(f"  失败 {code} {path}")


if __name__ == "__main__":
    main()
