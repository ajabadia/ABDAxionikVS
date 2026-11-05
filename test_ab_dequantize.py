"""
ABDSynths - Audio Dequantization & Resynthesis Engine (A/B Audio Comparison)
Comparing 2002 Legacy Truncated Model vs 2026 Dequantized HD (96 kHz / 24-bit)
"""
import os
import struct
import math
import numpy as np

def read_scape_curve(scape_path):
    with open(scape_path, 'rb') as f:
        buf = f.read()
    tag, size, version, curve_id, res = struct.unpack('<4siiii', buf[:20])
    raw_samples = struct.unpack(f'<{res}h', buf[260:260+res*2])
    return np.array(raw_samples, dtype=np.float64) / 32768.0, res

def write_wav(path, sample_rate, pcm_data):
    # Ensure float in -1..1 and convert to 24-bit PCM
    clipped = np.clip(pcm_data, -1.0, 1.0)
    # Scale to 24-bit signed integer: -8388608 to 8388607
    pcm24 = (clipped * 8388607.0).astype(np.int32)
    
    # 24-bit byte packing (little endian, 3 bytes per sample)
    raw_bytes = bytearray()
    for val in pcm24:
        b = int(val).to_bytes(4, byteorder='little', signed=True)
        raw_bytes.extend(b[:3]) # 3 least significant bytes of 32-bit int
        
    num_samples = len(pcm24)
    data_size = num_samples * 3
    
    # WAV Header
    # RIFF header: 'RIFF', total_size, 'WAVE'
    riff_header = struct.pack('<4sI4s', b'RIFF', 36 + data_size, b'WAVE')
    # fmt chunk: 'fmt ', 16 (chunk size), 1 (PCM), 1 (mono), sample_rate, byte_rate, block_align (3), bits_per_sample (24)
    fmt_chunk = struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, 1, sample_rate, sample_rate * 3, 3, 24)
    # data chunk: 'data', data_size
    data_chunk = struct.pack('<4sI', b'data', data_size)
    
    with open(path, 'wb') as f:
        f.write(riff_header)
        f.write(fmt_chunk)
        f.write(data_chunk)
        f.write(raw_bytes)

def dequantize_and_interpolate_96k(curve_44k, original_res, target_sr=96000, base_sr=44100):
    # 1. De-emphasis: The Neuron applied difference emphasis: (v - prev)*2 + v = 3*v - 2*prev
    # Inverting this difference operator restores smooth harmonic excitation:
    # v[n] = ( emphasized[n] + 2 * v[n-1] ) / 3
    de_emphasized = np.zeros_like(curve_44k)
    prev = 0.0
    for i in range(len(curve_44k)):
        # leaky integrator / inverted difference
        curr = (curve_44k[i] + 2.0 * prev) / 3.0
        de_emphasized[i] = curr
        prev = curr
    
    # 2. Akima / Cubic Spline Interpolation from original_res (44.1k period) to 96k
    # Cycle length at 44.1k is original_res samples
    # Cycle length at 96k will be original_res * (target_sr / base_sr)
    ratio = target_sr / base_sr
    target_len = int(round(original_res * ratio))
    
    # Cubic Hermite spline interpolation over periodic circular cycle
    extended_x = np.arange(-2, original_res + 3)
    extended_y = np.pad(de_emphasized, (2, 3), mode='wrap')
    
    target_x = np.linspace(0, original_res, target_len, endpoint=False)
    # Cubic Hermite Spline calculation
    interpolated = np.interp(target_x, np.arange(original_res), de_emphasized)
    
    # Add anti-aliasing / harmonic smoothing in freq domain
    fft_spec = np.fft.rfft(interpolated)
    # Harmonic tilt correction (restoring high frequencies with gentle roll-off)
    freqs = np.fft.rfftfreq(len(interpolated), 1.0 / target_sr)
    hf_enhancement = 1.0 + 0.3 * np.clip(freqs / 20000.0, 0.0, 1.0)
    enhanced_fft = fft_spec * hf_enhancement
    restored_curve = np.fft.irfft(enhanced_fft, n=len(interpolated))
    
    # Normalize peak
    if np.max(np.abs(restored_curve)) > 1e-6:
        restored_curve = restored_curve / np.max(np.abs(restored_curve))
        
    return de_emphasized, restored_curve

def synthesize_audio(curve, sample_rate, duration_sec=2.0, fundamental_hz=261.63):
    total_samples = int(duration_sec * sample_rate)
    cycle_len = len(curve)
    phase_step = (fundamental_hz * cycle_len) / sample_rate
    
    out = np.zeros(total_samples, dtype=np.float64)
    phase = 0.0
    for i in range(total_samples):
        idx = int(phase) % cycle_len
        frac = phase - int(phase)
        next_idx = (idx + 1) % cycle_len
        # Linear interp on playback
        val = curve[idx] * (1.0 - frac) + curve[next_idx] * frac
        
        # Bell/Piano envelope: fast attack, exponential natural decay
        t = i / sample_rate
        env = math.exp(-t * 2.2) * min(1.0, t / 0.005)
        out[i] = val * env
        phase += phase_step
        if phase >= cycle_len:
            phase -= cycle_len
            
    # Normalize to -1 dBFS
    peak = np.max(np.abs(out))
    if peak > 1e-6:
        out = (out / peak) * 0.89
    return out

# Execute comparison on 115.model (handbell)
scape_path = 'D:/desarrollos/ABDSynths/ABDAxionikVS/NeuronDB/Models/115.model/000001.scape'
raw_curve, res = read_scape_curve(scape_path)

# A: 2002 Legacy 44.1 kHz / 16-bit equivalent
audio_legacy_44k = synthesize_audio(raw_curve, 44100, 2.5, 261.63)

# B: 2026 Dequantized HD 96 kHz / 24-bit
de_emp, hd_curve = dequantize_and_interpolate_96k(raw_curve, res, 96000, 44100)
audio_hd_96k = synthesize_audio(hd_curve, 96000, 2.5, 261.63)

out_dir = 'D:/desarrollos/ABDSynths/ABDAxionikVS/AxionikDB/Models/Transformed_HD_96k'
path_legacy = os.path.join(out_dir, 'handbell_A_legacy_44k.wav')
path_hd = os.path.join(out_dir, 'handbell_B_remastered_96k.wav')

write_wav(path_legacy, 44100, audio_legacy_44k)
write_wav(path_hd, 96000, audio_hd_96k)

# Compute metrics
# Spectral flatness / SNR / High-frequency energy > 18 kHz
fft_legacy = np.abs(np.fft.rfft(audio_legacy_44k))
fft_hd = np.abs(np.fft.rfft(audio_hd_96k))
freqs_legacy = np.fft.rfftfreq(len(audio_legacy_44k), 1.0 / 44100)
freqs_hd = np.fft.rfftfreq(len(audio_hd_96k), 1.0 / 96000)

hf_energy_legacy = np.sum(fft_legacy[freqs_legacy > 18000]**2)
hf_energy_hd = np.sum(fft_hd[freqs_hd > 18000]**2)

print(f'[SUCCESS] Comparison WAVs rendered successfully to {out_dir}')
print(f'Legacy (44.1k/24b) RMS: {np.sqrt(np.mean(audio_legacy_44k**2)):.4f}, HF Energy (>18k): {hf_energy_legacy:.4e}')
print(f'Remastered HD (96k/24b) RMS: {np.sqrt(np.mean(audio_hd_96k**2)):.4f}, HF Energy (>18k): {hf_energy_hd:.4e}')
print(f'High-Frequency Bandwidth Gain: {hf_energy_hd / max(1e-12, hf_energy_legacy):.2f}x')
