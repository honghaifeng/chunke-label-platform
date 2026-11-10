#!/usr/bin/env python3
"""FunASR 预识别 worker（在 voice-repos/FunASR 的 Python 3.10 venv 中运行）。

输入 JSON：{"audio": path, "hotwords": [], "spk_num": 2|null, "emotion": bool}
输出 JSON：{"ok": true, "text": "", "duration": 0, "segments": [...]}
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
import traceback

MODELS = "/Volumes/ORICO/voice-ai/models/modelscope/models"
os.environ.setdefault("MODELSCOPE_CACHE", "/Volumes/ORICO/voice-ai/models/modelscope")
os.environ.setdefault("HF_HOME", "/Volumes/ORICO/voice-ai/models/hf")

PARAFORMER = f"{MODELS}/iic--speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/snapshots/master"
VAD = f"{MODELS}/iic--speech_fsmn_vad_zh-cn-16k-common-pytorch/snapshots/master"
PUNC = f"{MODELS}/iic--punc_ct-transformer_zh-cn-common-vocab272727-pytorch/snapshots/master"
CAMPP = f"{MODELS}/iic--speech_campplus_sv_zh-cn_16k-common/snapshots/master"
EMOTION = f"{MODELS}/iic--emotion2vec_plus_large/snapshots/master"

EMOTION_MAP = {
    "生气": "愤怒",
    "愤怒": "愤怒",
    "厌恶": "不满",
    "难过": "不满",
    "恐惧": "不满",
    "开心": "满意",
    "高兴": "满意",
    "惊讶": "中性",
    "中性": "中性",
    "其他": "中性",
}

_asr = None
_spk = None
_emo = None


def get_asr():
    global _asr
    if _asr is None:
        from funasr import AutoModel

        _asr = AutoModel(
            model=PARAFORMER,
            vad_model=VAD,
            punc_model=PUNC,
            spk_model=CAMPP,
            disable_update=True,
            device="cpu",
        )
    return _asr


def get_spk():
    global _spk
    if _spk is None:
        from funasr import AutoModel

        _spk = AutoModel(model=CAMPP, disable_update=True, device="cpu")
    return _spk


def get_emotion():
    global _emo
    if _emo is None:
        if not os.path.isdir(EMOTION):
            return None
        from funasr import AutoModel

        _emo = AutoModel(model=EMOTION, disable_update=True, device="cpu")
    return _emo


def load_audio(path: str):
    import librosa
    import numpy as np

    wav, sr = librosa.load(path, sr=16000, mono=True)
    return np.asarray(wav, dtype=np.float32), 16000


def write_wav(wav, sr: int, path: str) -> None:
    import soundfile as sf

    sf.write(path, wav, sr)


def cluster_speakers(embeddings, spk_num):
    import numpy as np
    from sklearn.cluster import AgglomerativeClustering

    emb = np.asarray(embeddings, dtype=np.float32)
    if len(emb) <= 1:
        return [0] * len(emb)
    if spk_num and spk_num >= 1:
        n = min(int(spk_num), len(emb))
        model = AgglomerativeClustering(n_clusters=n, metric="cosine", linkage="average")
        labels = model.fit_predict(emb)
    else:
        model = AgglomerativeClustering(
            n_clusters=None, distance_threshold=0.42, metric="cosine", linkage="average"
        )
        labels = model.fit_predict(emb)
    # 按首次出现顺序重排编号，保证稳定
    order: dict[int, int] = {}
    out = []
    for lb in labels:
        if int(lb) not in order:
            order[int(lb)] = len(order) + 1
        out.append(order[int(lb)])
    return out


def run(cfg: dict) -> dict:
    audio = cfg["audio"]
    hotwords = [w for w in (cfg.get("hotwords") or []) if w]
    spk_num = cfg.get("spk_num")
    with_emotion = bool(cfg.get("emotion"))

    wav, sr = load_audio(audio)
    duration = round(len(wav) / sr, 2)

    kwargs = {"input": audio, "batch_size_s": 300}
    if hotwords:
        kwargs["hotword"] = " ".join(hotwords)
    if spk_num:
        kwargs["preset_spk_num"] = int(spk_num)

    res = get_asr().generate(**kwargs)
    item = res[0] if isinstance(res, list) and res else {}
    text = (item.get("text") or "").strip()
    sentences = item.get("sentence_info") or []

    segments = []
    if sentences:
        for s in sentences:
            seg_text = (s.get("text") or "").strip()
            if not seg_text:
                continue
            segments.append(
                {
                    "start": round(float(s.get("start", 0)) / 1000.0, 2),
                    "end": round(float(s.get("end", 0)) / 1000.0, 2),
                    "text": seg_text,
                    "spk": None,
                    "emotion": "中性",
                    "events": [],
                }
            )
    elif text:
        segments = [{"start": 0.0, "end": duration, "text": text, "spk": None, "emotion": "中性", "events": []}]

    # 自建说话人聚类：CAM++ 逐句 embedding + 层次聚类，避免内置阈值在短音频上并簇
    if len(segments) >= 2:
        tmpdir = tempfile.mkdtemp(prefix="chunke-spk-")
        paths = []
        try:
            for i, seg in enumerate(segments):
                a = max(0, int(seg["start"] * sr))
                b = min(len(wav), int(seg["end"] * sr))
                if b - a < int(0.3 * sr):
                    a = max(0, a - int(0.1 * sr))
                    b = min(len(wav), max(b, a + int(0.3 * sr)))
                p = os.path.join(tmpdir, f"seg{i}.wav")
                write_wav(wav[a:b], sr, p)
                paths.append(p)
            emb_res = get_spk().generate(input=paths)
            embeddings = []
            for r in emb_res:
                import numpy as np

                embeddings.append(np.asarray(r["spk_embedding"]).squeeze())
            labels = cluster_speakers(embeddings, spk_num)
            for seg, lb in zip(segments, labels):
                seg["spk"] = f"说话人{lb}"
        except Exception:
            for seg in segments:
                seg["spk"] = "说话人1"
        finally:
            for p in paths:
                try:
                    os.remove(p)
                except OSError:
                    pass
            try:
                os.rmdir(tmpdir)
            except OSError:
                pass
    else:
        for seg in segments:
            seg["spk"] = seg["spk"] or "说话人1"

    if with_emotion:
        emo = get_emotion()
        if emo is not None and segments:
            tmpdir = tempfile.mkdtemp(prefix="chunke-emo-")
            try:
                for i, seg in enumerate(segments):
                    a = max(0, int(seg["start"] * sr))
                    b = min(len(wav), int(seg["end"] * sr))
                    if b <= a:
                        continue
                    p = os.path.join(tmpdir, f"emo{i}.wav")
                    write_wav(wav[a:b], sr, p)
                    try:
                        r = emo.generate(input=p, granularity="utterance", extract_embedding=False)
                        labels = r[0].get("labels") or []
                        if labels:
                            seg["emotion"] = EMOTION_MAP.get(str(labels[0]), "中性")
                    except Exception:
                        pass
                    finally:
                        try:
                            os.remove(p)
                        except OSError:
                            pass
            finally:
                try:
                    os.rmdir(tmpdir)
                except OSError:
                    pass

    for seg in segments:
        if seg["end"] <= seg["start"]:
            seg["end"] = min(duration, round(seg["start"] + 0.5, 2))

    return {
        "ok": True,
        "text": text,
        "duration": duration,
        "segments": segments,
        "engine": "FunASR Paraformer-large + FSMN-VAD + CT-Punc + CAM++",
        "hotwords": hotwords,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    args = ap.parse_args()
    try:
        with open(args.inp, encoding="utf-8") as f:
            cfg = json.load(f)
        result = run(cfg)
    except Exception as exc:  # noqa: BLE001
        result = {"ok": False, "error": f"{exc}", "traceback": traceback.format_exc()[-1500:]}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
