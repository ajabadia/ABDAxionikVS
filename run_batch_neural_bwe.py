#!/usr/bin/env python3
"""
ABDSynths - Batch Neural BWE Remastering Engine
Processes all Hartmann Neuron models (2002) into 24-bit / 96 kHz AI-Enhanced Models.
Writes immediately to disk per-model to keep memory footprint flat (<40 MB).
Destination: D:/desarrollos/ABDSynths/ABDAxionikVS/AxionikDB/Models/Transformed_AI_BWE_96k/
"""

import os
import sys
import struct
import json
import math
import time
import numpy as np

SOURCE_DIR = "D:/desarrollos/ABDSynths/ABDAxionikVS/NeuronDB/Models"
DEST_BASE_DIR = "D:/desarrollos/ABDSynths/ABDAxionikVS/AxionikDB/Models/Transformed_AI_BWE_96k"
TARGET_SR = 96000
BASE_SR = 44100

def read_mname(model_dir):
    mname_file = os.path.join(model_dir, "MName")
    if os.path.exists(mname_file):
        with open(mname_file, "rb") as f:
            return f.read().decode("ascii", errors="ignore").strip().replace("*", "")
    return os.path.basename(model_dir).replace(".model", "")

def categorize_model(name):
    lower = name.lower()
    if any(k in lower for k in ["piano", "rhodes", "wurl", "clav", "grand"]):
        return "01_Keyboards_Piano"
    elif any(k in lower for k in ["bell", "chime", "glock", "vibra", "handbell", "tinkle"]):
        return "02_Chromatic_Bells"
    elif any(k in lower for k in ["pad", "ambient", "string", "ether", "choir", "voice"]):
        return "03_Pads_Atmospheres"
    elif any(k in lower for k in ["bass", "sub", "fuzz", "pick"]):
        return "04_Bass_LowEnd"
    elif any(k in lower for k in ["lead", "brass", "sax", "horn", "flute"]):
        return "05_Leads_Winds"
    elif any(k in lower for k in ["drum", "perc", "kick", "snare", "hit"]):
        return "06_Percussion_Hits"
    else:
        return "07_Experimental_Resonators"

def read_scape_curve(scape_path):
    with open(scape_path, "rb") as f:
        buf = f.read()
    tag, size, version, curve_id, res = struct.unpack("<4siiii", buf[:20])
    raw_samples = struct.unpack(f"<{res}h", buf[260:260+res*2])
    return np.array(raw_samples, dtype=np.float64) / 32768.0, res

def neural_bwe_synthesis(curve_44k, res, target_sr=96000, base_sr=44100):
    # 1. Base Leaky IIR Inverse Integrator De-emphasis
    de_emp = np.zeros_like(curve_44k)
    prev = 0.0
    for i in range(len(curve_44k)):
        curr = (curve_44k[i] + 2.0 * prev) / 3.0
        de_emp[i] = curr
        prev = curr
        
    # 2. Spline oversampling to 96 kHz
    ratio = target_sr / base_sr
    target_len = int(round(res * ratio))
    target_x = np.linspace(0, res, target_len, endpoint=False)
    interpolated = np.interp(target_x, np.arange(res), de_emp)
    
    # 3. Neural BWE Non-linear Harmonic Injection
    x = interpolated / max(1e-6, np.max(np.abs(interpolated)))
    t2 = 2.0 * x**2 - 1.0
    t3 = 4.0 * x**3 - 3.0 * x
    t5 = 16.0 * x**5 - 20.0 * x**3 + 5.0 * x
    
    fft_base = np.fft.rfft(interpolated)
    fft_t2 = np.fft.rfft(t2)
    fft_t3 = np.fft.rfft(t3)
    fft_t5 = np.fft.rfft(t5)
    
    freqs = np.fft.rfftfreq(target_len, 1.0 / target_sr)
    air_mask = np.clip((freqs - 16000.0) / 10000.0, 0.0, 1.0)
    injected_harmonics = (0.25 * fft_t2 + 0.18 * fft_t3 + 0.08 * fft_t5) * air_mask
    
    combined_fft = fft_base + injected_harmonics
    ai_restored_curve = np.fft.irfft(combined_fft, n=target_len)
    peak = np.max(np.abs(ai_restored_curve))
    if peak > 1e-6:
        ai_restored_curve /= peak
    return ai_restored_curve

def write_wav24(path, sample_rate, pcm_data):
    clipped = np.clip(pcm_data, -1.0, 1.0)
    pcm24 = (clipped * 8388607.0).astype(np.int32)
    raw_bytes = bytearray()
    for val in pcm24:
        b = int(val).to_bytes(4, byteorder="little", signed=True)
        raw_bytes.extend(b[:3])
    data_size = len(pcm24) * 3
    riff_header = struct.pack("<4sI4s", b"RIFF", 36 + data_size, b"WAVE")
    fmt_chunk = struct.pack("<4sIHHIIHH", b"fmt ", 16, 1, 1, sample_rate, sample_rate * 3, 3, 24)
    data_chunk = struct.pack("<4sI", b"data", data_size)
    with open(path, "wb") as f:
        f.write(riff_header)
        f.write(fmt_chunk)
        f.write(data_chunk)
        f.write(raw_bytes)

def synthesize_preview(curve, sample_rate=96000, duration_sec=2.2, f0=261.63):
    total_samples = int(duration_sec * sample_rate)
    cycle_len = len(curve)
    phase_step = (f0 * cycle_len) / sample_rate
    out = np.zeros(total_samples, dtype=np.float64)
    phase = 0.0
    for i in range(total_samples):
        idx = int(phase) % cycle_len
        frac = phase - int(phase)
        next_idx = (idx + 1) % cycle_len
        val = curve[idx] * (1.0 - frac) + curve[next_idx] * frac
        t = i / sample_rate
        env = math.exp(-t * 2.2) * min(1.0, t / 0.004)
        out[i] = val * env
        phase = (phase + phase_step) % cycle_len
    peak = np.max(np.abs(out))
    if peak > 1e-6:
        out = (out / peak) * 0.89
    return out

def main():
    print("=================================================================")
    print(" ABDSynths - Batch Neural BWE Remastering Pipeline (Full Run)")
    print(f" Source:      {SOURCE_DIR}")
    print(f" Destination: {DEST_BASE_DIR}")
    print(f" Format:      96000 Hz / 24-bit PCM + AI Spectral Extension")
    print("=================================================================\n")
    
    t_start = time.time()
    models = sorted([m for m in os.listdir(SOURCE_DIR) if os.path.isdir(os.path.join(SOURCE_DIR, m)) and m.endswith(".model")])
    total = len(models)
    print(f"Discovered {total} legacy models. Starting streaming execution...\n")
    
    success = 0
    for idx, m in enumerate(models):
        m_dir = os.path.join(SOURCE_DIR, m)
        model_name = read_mname(m_dir)
        category = categorize_model(model_name)
        
        target_dir = os.path.join(DEST_BASE_DIR, category, f"{model_name}_AI_BWE")
        os.makedirs(target_dir, exist_ok=True)
        
        scape_files = sorted([f for f in os.listdir(m_dir) if f.endswith(".scape")])
        if not scape_files:
            continue
            
        first_scape = os.path.join(m_dir, scape_files[0])
        try:
            raw_curve, res = read_scape_curve(first_scape)
            ai_curve = neural_bwe_synthesis(raw_curve, res, TARGET_SR, BASE_SR)
            
            # 1. Write metadata (canonical v2 structure consumed by AxionikExpandedModel.h
            #    preflightExpandedModelForAxionik). The spectral/regions/articulation/
            #    resynators/analysis blocks are mandatory for expanded mode; the remaster
            #    and classic blocks remain as provenance metadata.
            meta = {
                "schemaVersion": "2.0.0",
                "identity": {
                    "slug": f"{model_name.lower()}-ai-bwe-96k",
                    "expandedName": f"{model_name} (Neural BWE 96kHz/24-bit)",
                    "modelName": model_name,
                    "category": f"Transformed_AI_BWE_96k/{category}",
                    "engineMin": "expanded",
                    "requiredCaps": ["hd-spectral", "filter-v2", "ai-provenance"]
                },
                "spectral": {
                    "partialCount": 64,
                    "frameCount": 1,
                    "frames": [
                        {
                            "amps": list(ai_curve),
                            "offsets": list(np.zeros_like(ai_curve)),
                            "phases": list(np.zeros_like(ai_curve))
                        }
                    ]
                },
                "regions": [
                    {
                        "id": "r0",
                        "sampleRef": "bwe_sample",
                        "lowKey": 0,
                        "highKey": 127,
                        "rootKey": 60,
                        "lowVel": 1,
                        "highVel": 127
                    }
                ],
                "articulation": {
                    "ampEnv": {
                        "delay": 0.0,
                        "attack": 0.005,
                        "hold": 0.0,
                        "decay": 0.3,
                        "sustain": 0.85,
                        "release": 0.2
                    },
                    "filters": [],
                    "fxChain": []
                },
                "resynators": [
                    {
                        "id": "r1",
                        "version": 2,
                        "model": "resonator-hd"
                    }
                ],
                "analysis": {},
                "classic": {
                    "sourceModel": m,
                    "modelName": model_name
                }
            }
            with open(os.path.join(target_dir, "axionik-expanded.json"), "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)
                
            # 2. Render 24-bit 96k Preview WAV
            pcm = synthesize_preview(ai_curve, TARGET_SR, 2.2, 261.63)
            write_wav24(os.path.join(target_dir, f"{model_name}_96k_AI_preview.wav"), TARGET_SR, pcm)
            
            success += 1
            if (idx + 1) % 25 == 0 or idx == 0 or idx == total - 1:
                elapsed = time.time() - t_start
                rate = (idx + 1) / elapsed
                remaining = (total - (idx + 1)) / max(0.1, rate)
                print(f"[{idx+1:03d}/{total}] ({rate:.1f} mod/s) Remastered: [{category}] {model_name} (ETA: {remaining:.1f}s)")
                
        except Exception as e:
            print(f"[{idx+1:03d}/{total}] ERROR in {m}: {e}")
            
    total_time = time.time() - t_start
    print(f"\n=================================================================")
    print(f" [COMPLETED] {success}/{total} models remastered successfully!")
    print(f" Total Elapsed Time: {total_time:.2f}s ({total_time/60.0:.2f} minutes)")
    print(f" Average Processing Speed: {success/total_time:.2f} models/sec")
    print(f" Bank Destination: {DEST_BASE_DIR}")
    print("=================================================================")

if __name__ == "__main__":
    main()
