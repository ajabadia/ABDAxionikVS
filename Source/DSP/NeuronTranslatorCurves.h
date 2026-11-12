#pragma once
/**
 * @file NeuronTranslatorCurves.h
 * @brief Exact stateless translation laws from NeuronVS.dll (Translator.cpp / FUN_10040550).
 *
 * Pure C++20 header — zero JUCE dependencies, 100% constexpr / noexcept.
 * Centralizes:
 *  - Quadratic Resynator volume law (v^2, Translator.cpp:627, 1083)
 *  - Contour == 1 ("Shaper") envelope gate (Translator.cpp:415, 658-688, 1114-1144)
 *  - Symmetric bipolar [-64..+63] -> [-1.0..+1.0] fallback mapping
 *  - ADSR time/sustain laws (FUN_10040550: Attack f^3*20*fs, Decay/Release f^2*20*fs, Sustain 2s-s^2)
 */

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace abd::axionik::NeuronTranslatorCurves {

/**
 * @brief Quadratic Resynator volume law (Translator.cpp:627, 1083): v^2.
 */
[[nodiscard]] constexpr float volumeGainSquared(float norm01) noexcept {
    const float v = std::clamp(norm01, 0.0f, 1.0f);
    return v * v;
}

/**
 * @brief Contour Shaper gate (Translator.cpp:415, 658-688, 1114-1144).
 *
 * Envelope depth applies to Scape/Sphere/Silver coordinates iff Contour == 1 ("Shaper").
 * Contour == 0 ("Stick") and Contour == 2 ("Pedal / LFO") gate envelope depth to 0.0f.
 */
[[nodiscard]] inline float contourShaperGate(float contourRaw) noexcept {
    const int mode = static_cast<int>(std::lround(contourRaw));
    return (mode == 1) ? 1.0f : 0.0f;
}

/**
 * @brief Exact symmetric bipolar mapping for [-64 .. +63] raw values -> [-1.0 .. +1.0].
 * Matches ParameterEngineBridge::remap(raw, -64.0f, 63.0f, -1.0f, 1.0f, SymBipolar).
 */
[[nodiscard]] constexpr float bipolarRawToUnit(float raw64_63) noexcept {
    const float v = (raw64_63 < 0.0f) ? (raw64_63 / 64.0f) : (raw64_63 / 63.0f);
    return std::clamp(v, -1.0f, 1.0f);
}

/**
 * @brief FUN_10040550 Attack sample count: max(1, trunc(a^3 * 20.0 * fs)).
 */
[[nodiscard]] inline double adsrAttackSamples(float aNorm01, double sampleRate) noexcept {
    const double a = static_cast<double>(std::clamp(aNorm01, 0.0f, 1.0f));
    const double fs = (sampleRate > 1.0) ? sampleRate : 44100.0;
    const double raw = std::trunc(a * a * a * 20.0 * fs);
    return std::max(1.0, raw);
}

/**
 * @brief FUN_10040550 Decay sample count: max(1, trunc(d^2 * 20.0 * fs)).
 */
[[nodiscard]] inline double adsrDecaySamples(float dNorm01, double sampleRate) noexcept {
    const double d = static_cast<double>(std::clamp(dNorm01, 0.0f, 1.0f));
    const double fs = (sampleRate > 1.0) ? sampleRate : 44100.0;
    const double raw = std::trunc(d * d * 20.0 * fs);
    return std::max(1.0, raw);
}

/**
 * @brief FUN_10040550 Sustain amplitude curve: max(5e-6f, 2s - s^2).
 */
[[nodiscard]] constexpr float adsrSustainLevel(float sNorm01) noexcept {
    const float s = std::clamp(sNorm01, 0.0f, 1.0f);
    const float shaped = (2.0f * s) - (s * s);
    return (shaped < 5.0e-6f) ? 5.0e-6f : shaped;
}

/**
 * @brief FUN_10040550 Release sample count: max(round(128.0 * fs / 44100.0), trunc(r^2 * 20.0 * fs)).
 */
[[nodiscard]] inline double adsrReleaseSamples(float rNorm01, double sampleRate) noexcept {
    const double r = static_cast<double>(std::clamp(rNorm01, 0.0f, 1.0f));
    const double fs = (sampleRate > 1.0) ? sampleRate : 44100.0;
    const double minSamples = std::max(1.0, std::round(128.0 * (fs / 44100.0)));
    const double raw = std::trunc(r * r * 20.0 * fs);
    return std::max(minSamples, raw);
}

} // namespace abd::axionik::NeuronTranslatorCurves
