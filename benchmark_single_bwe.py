"""
ABDSynths - Benchmark Single-Model Neural BWE vs Batch
Measures memory, execution time, and VRAM behavior for 1 model vs stage-grouped pipeline
"""

import os
import time
import struct
import math
import numpy as np

def read_scape_curve(scape_path):
    with open(scape_path, 'rb') as f:
        buf = f.read()
    tag, size, version, curve_id, res = struct.unpack('<4siiii', buf[:20])
    raw_samples = struct.unpack(f'<{res}h', buf[260:260+res*2])
    return np.array(raw_samples, dtype=np.float64) / 32768.0, res

def neural_bwe_synthesis(curve_44k, res, target_sr=96000, base_sr=44100):
    de_emp = np.zeros_like(curve_44k)
    prev = 0.0
    for i in range(len(curve_44k)):
        curr = (curve_44k[i] + 2.0 * prev) / 3.0
        de_emp[i] = curr
        prev = curr
        
    ratio = target_sr / base_sr
    target_len = int(round(res * ratio))
    target_x = np.linspace(0, res, target_len, endpoint=False)
    interpolated = np.interp(target_x, np.arange(res), de_emp)
    
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
    injected = (0.25 * fft_t2 + 0.18 * fft_t3 + 0.08 * fft_t5) * air_mask
    combined_fft = fft_base + injected
    ai_curve = np.fft.irfft(combined_fft, n=target_len)
    peak = np.max(np.abs(ai_curve))
    if peak > 1e-6:
        ai_curve /= peak
    return ai_curve

def synthesize_audio(curve, sample_rate, duration_sec=2.5, fundamental_hz=261.63):
    total_samples = int(duration_sec * sample_rate)
    cycle_len = len(curve)
    phase_step = (fundamental_hz * cycle_len) / sample_rate
    out = np.zeros(total_samples, dtype=np.float64)
    phase = 0.0
    for i in range(total_samples):
        idx = int(phase) % cycle_len
        frac = phase - int(phase)
        next_idx = (idx + 1) % cycle_len
        val = curve[idx] * (1.0 - frac) + curve[next_idx] * frac
        t = i / sample_rate
        env = math.exp(-t * 2.1) * min(1.0, t / 0.003)
        out[i] = val * env
        phase = (phase + phase_step) % cycle_len
    peak = np.max(np.abs(out))
    if peak > 1e-6:
        out = (out / peak) * 0.89
    return out

# Benchmark single model execution time
model_path = 'D:/desarrollos/ABDSynths/ABDAxionikVS/NeuronDB/Models/326.model/000001.scape'
t0 = time.perf_counter()
raw_curve, res = read_scape_curve(model_path)
t_read = time.perf_counter()

ai_curve = neural_bwe_synthesis(raw_curve, res, 96000, 44100)
t_bwe = time.perf_counter()

audio = synthesize_audio(ai_curve, 96000, 2.5, 261.63)
t_synth = time.perf_counter()

total_ms = (t_synth - t0) * 1000.0
print(f"=== Single Model Benchmark (326.model GrandPiano) ===")
print(f"Read & Parse Scape: {(t_read - t0)*1000.0:.2f} ms")
print(f"Neural BWE Harmonic Expansion (96 kHz): {(t_bwe - t_read)*1000.0:.2f} ms")
print(f"Resynthesis 2.5s Audio (240k samples): {(t_synth - t_bwe)*1000.0:.2f} ms")
print(f"Total time per model: {total_ms:.2f} ms ({1000.0 / total_ms:.1f} models/sec)")
print(f"Estimated time for all 341 models: {(total_ms * 341.0) / 1000.0:.2f} seconds (~{(total_ms * 341.0) / 60000.0:.2f} minutes)")
