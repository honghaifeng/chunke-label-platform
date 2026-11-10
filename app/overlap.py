"""重叠语音检测：pyannote segmentation-3.0 (ONNX)，为每个转写段打「重叠发言」事件。"""
from __future__ import annotations

import os
import subprocess
from functools import lru_cache

MODEL = "/Volumes/ORICO/voice-ai/models/diarization/sherpa-onnx-pyannote-segmentation-3-0/model.onnx"
SR = 16000
WINDOW = 160000  # 10s
# powerset 类别 -> 3 个说话人是否激活
POWERSET = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
]
THRESHOLD = 0.15


@lru_cache(maxsize=1)
def _session():
    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 1
    opts.intra_op_num_threads = 2
    opts.log_severity_level = 3
    return ort.InferenceSession(MODEL, sess_options=opts, providers=["CPUExecutionProvider"])


def _load_audio(path: str):
    import numpy as np

    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        timeout=300,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError("音频解码失败")
    return np.frombuffer(proc.stdout, dtype="float32")


def _chunk(audio, start: float, end: float):
    import numpy as np

    lead = 4000
    a = max(0, int(start * SR) - lead)
    offset = max(0, int(start * SR) - a)
    b = min(len(audio), int(end * SR) + 4000)
    clip = audio[a:b]
    if len(clip) < WINDOW:
        clip = np.pad(clip, (0, WINDOW - len(clip)))
    else:
        clip = clip[:WINDOW]
    return clip, offset


def annotate(segments: list[dict], audio_path: str) -> dict:
    """就地给 segments 增加 events / overlap_ratio，返回统计信息。"""
    if not os.path.exists(MODEL) or not segments or not os.path.exists(audio_path):
        return {"ok": False, "reason": "模型或音频缺失"}

    import numpy as np

    session = _session()
    audio = _load_audio(audio_path)
    mapping = np.asarray(POWERSET, dtype="float32")
    frame_shift = 270  # receptive_field_shift，每帧 270 采样点
    flagged = 0
    for seg in segments:
        try:
            clip, offset = _chunk(audio, float(seg["start"]), float(seg["end"]))
            logits = session.run(None, {"x": clip.reshape(1, 1, -1)})[0][0]
            counts = mapping[logits.argmax(axis=-1)].sum(axis=-1)
            f0 = max(0, int(offset / frame_shift))
            f1 = min(len(counts), int((offset + (float(seg["end"]) - float(seg["start"])) * SR) / frame_shift))
            ratio = float((counts[f0:f1] >= 2).mean()) if f1 > f0 else 0.0
        except Exception:
            continue
        seg["overlap_ratio"] = round(ratio, 3)
        if ratio >= THRESHOLD:
            events = seg.setdefault("events", [])
            if "重叠发言" not in events:
                events.append("重叠发言")
            flagged += 1
    return {"ok": True, "overlap_segments": flagged, "threshold": THRESHOLD}
