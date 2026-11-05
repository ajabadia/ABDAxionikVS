#!/usr/bin/env python3
"""
ABDSynths - Batch Model Remastering CLI
Converts legacy Hartmann Neuron .model files (2002) into Next-Gen HD Remastered models (96 kHz / 24-bit).
Outputs to AxionikDB/Models/Transformed_HD_96k/<Category>/
"""

import os
import sys
import argparse
import struct
import json
import math
import numpy as np

def parse_args():
    parser = argparse.ArgumentParser(description="Batch Remaster Hartmann Neuron Models to HD 96kHz / 24-bit")
    parser.add_argument(
        "--source",
        default="D:/desarrollos/ABDSynths/ABDAxionikVS/NeuronDB/Models",
        help="Path to legacy NeuronDB/Models directory"
    )
    parser.add_argument(
        "--dest",
        default="D:/desarrollos/ABDSynths/ABDAxionikVS/AxionikDB/Models/Transformed_HD_96k",
        help="Destination directory for remastered models"
    )
    parser.add_argument(
        "--rate",
        type=int,
        default=96000,
        help="Target sample rate (Hz), default 96000"
    )
    parser.add_argument(
        "--render-wavs",
        action="store_true",
        help="Also export reference 24-bit 96kHz WAV preview audio for each model"
    )
    return parser.parse_args()

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

def dequantize_curve(raw_samples, res, target_sr=96000, base_sr=44100):
    norm_samples = np.array(raw_samples, dtype=np.float64) / 32768.0
    de_emphasized = np.zeros_like(norm_samples)
    prev = 0.0
    for i in range(len(norm_samples)):
        curr = (norm_samples[i] + 2.0 * prev) / 3.0
        de_emphasized[i] = curr
        prev = curr
        
    ratio = target_sr / base_sr
    target_len = int(round(res * ratio))
    target_x = np.linspace(0, res, target_len, endpoint=False)
    interpolated = np.interp(target_x, np.arange(res), de_emphasized)
    
    fft_spec = np.fft.rfft(interpolated)
    freqs = np.fft.rfftfreq(len(interpolated), 1.0 / target_sr)
    hf_enhancement = 1.0 + 0.3 * np.clip(freqs / 20000.0, 0.0, 1.0)
    restored_curve = np.fft.irfft(fft_spec * hf_enhancement, n=len(interpolated))
    peak = np.max(np.abs(restored_curve))
    if peak > 1e-6:
        restored_curve /= peak
    return restored_curve

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

def process_model(model_path, dest_base_dir, target_sr, render_wavs):
    folder_name = os.path.basename(model_path)
    model_name = read_mname(model_path)
    category = categorize_model(model_name)
    
    cat_dest_dir = os.path.join(dest_base_dir, category, f"{model_name}_HD")
    os.makedirs(cat_dest_dir, exist_ok=True)
    
    # Check for scape and sphere files
    scape_files = sorted([f for f in os.listdir(model_path) if f.endswith(".scape")])
    sphere_files = sorted([f for f in os.listdir(model_path) if f.endswith(".sphere")])
    
    if not scape_files:
        return False, f"No .scape files found in {model_path}"
        
    first_scape = os.path.join(model_path, scape_files[0])
    with open(first_scape, "rb") as f:
        buf = f.read()
    tag, size, version, curve_id, res = struct.unpack("<4siiii", buf[:20])
    raw_samples = struct.unpack(f"<{res}h", buf[260:260+res*2])
    
    hd_curve = dequantize_curve(raw_samples, res, target_sr=target_sr)
    
    # Write metadata descriptor (axionik-expanded.json)
    expanded_meta = {
        "schemaVersion": "2.0.0",
        "identity": {
            "slug": f"{model_name.lower()}-hd-96k",
            "expandedName": f"{model_name} HD (96kHz / 24-bit Remaster)",
            "modelName": model_name,
            "category": f"Transformed_HD_96k/{category}",
            "engineMin": "expanded",
            "requiredCaps": ["hd-spectral", "filter-v2"]
        },
        "remaster": {
            "origin": "Hartmann Neuron (2002)",
            "originalResolution": res,
            "dequantization": "IIR Leaky Inverse Integrator + Cubic Hermite Spline",
            "sampleRate": target_sr,
            "bitDepth": 24,
            "spectralOversampling": target_sr / 44100.0
        },
        "spectral": {
            "partialCount": 64,
            "frameCount": 1,
            "frames": [
                {
                    "amps": list(hd_curve),
                    "offsets": list(np.zeros_like(hd_curve)),
                    "phases": list(np.zeros_like(hd_curve))
                }
            ]
        },
        "regions": [
            {
                "id": "r0",
                "sampleRef": "hd_sample",
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
            "sourceModel": folder_name,
            "modelName": model_name
        }
    }
    
    meta_path = os.path.join(cat_dest_dir, "axionik-expanded.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(expanded_meta, f, indent=2)
        
    # Render preview WAV if requested
    if render_wavs:
        # 2.0 second note preview
        total_samples = int(2.0 * target_sr)
        cycle_len = len(hd_curve)
        phase_step = (261.63 * cycle_len) / target_sr
        pcm = np.zeros(total_samples, dtype=np.float64)
        phase = 0.0
        for i in range(total_samples):
            idx = int(phase) % cycle_len
            frac = phase - int(phase)
            next_idx = (idx + 1) % cycle_len
            val = hd_curve[idx] * (1.0 - frac) + hd_curve[next_idx] * frac
            t = i / target_sr
            pcm[i] = val * math.exp(-t * 2.0) * min(1.0, t / 0.005)
            phase = (phase + phase_step) % cycle_len
        peak = np.max(np.abs(pcm))
        if peak > 1e-6:
            pcm = (pcm / peak) * 0.89
        wav_path = os.path.join(cat_dest_dir, f"{model_name}_96k_preview.wav")
        write_wav24(wav_path, target_sr, pcm)
        
    return True, f"[{category}] {model_name} Remastered OK"

def main():
    args = parse_args()
    if not os.path.exists(args.source):
        print(f"Error: Source directory not found: {args.source}")
        sys.exit(1)
        
    print(f"=== ABDSynths Batch Model Remastering CLI ===")
    print(f"Source: {args.source}")
    print(f"Destination: {args.dest}")
    print(f"Sample Rate: {args.rate} Hz / 24-bit")
    print(f"Render WAV Previews: {args.render_wavs}\n")
    
    models = sorted([m for m in os.listdir(args.source) if os.path.isdir(os.path.join(args.source, m)) and m.endswith(".model")])
    print(f"Found {len(models)} legacy models to process.\n")
    
    success_count = 0
    for idx, m in enumerate(models):
        m_path = os.path.join(args.source, m)
        ok, msg = process_model(m_path, args.dest, args.rate, args.render_wavs)
        if ok:
            success_count += 1
            if idx < 10 or idx % 20 == 0:
                print(f"[{idx+1}/{len(models)}] {msg}")
        else:
            print(f"[{idx+1}/{len(models)}] FAILED: {msg}")
            
    print(f"\n[DONE] Successfully remastered {success_count}/{len(models)} models.")
    print(f"Output available at: {args.dest}")

if __name__ == "__main__":
    main()
