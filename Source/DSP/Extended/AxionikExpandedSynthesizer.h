// ============================================================================
// ABDAxionikVS — Source/DSP/Extended/AxionikExpandedSynthesizer.h
// Fase B (11.5.6): C++20 Pure (JUCE-free, RT-Safe) Expanded Synthesizer Engine
//
// Implements:
//   - ExtendedRegionDispatcher (2D Key × Velocity, crossfades, Round-Robin, triggers)
//   - UnifiedSpectralSurfaceEvaluator (melodic 2D Pitch×Vel & drum_kit 1D Vel + TempoSync)
//   - Proprietary Resynator v2 with all 9 AxionikResonatorShapers:
//       inharmonicityB, parity, entropyRoughness, spectralShiftHz, hfRollOffDbPerOct,
//       formantShiftSt, formantPreserve, residualMix (24-Bark DDSP noise), spatialSpread
//   - Phase-aligned Hybrid Transient splice (`hybridTransient`)
//   - 6-Stage DAHDSR Envelope & Independent Synth Filter/FX Chain
//   - Dual Spatial Bus: Discrete 4.0 Quad (`FL, FR, RL, RR`) & Pseudo-Surround Stereo
//
// FUENTE DE LA VERDAD (orden 2026-11-06): esta cabecera (+ AxionikExpandedModel.h
// + el contrato axionikExpandedModel.ts + el vector dorado WASM) ES el Resynator
// v2. `NeuronResynatorV2.h` está archivada (_archive/, nadie la compilaba y
// divergía). `ResynatorV2Preview.ts` fue jubilado el 2026-11-06: el WASM es
// el path de preescucha. No duplicar fórmulas fuera de aquí:
// compilar a WASM vía tools/resynator-wasm/ (fachada `ResynatorV2Wasm.cpp`).
// ============================================================================

#pragma once

#include "AxionikExpandedModel.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace abd::axionik::extended {

inline constexpr size_t kMaxExpandedVoices   = 16;
inline constexpr size_t kMaxPartialsPerVoice = 256;
inline constexpr float  kTwoPi               = 6.28318530717958647692f;
// Fase loop-1: synth spectral-frame clock (frames/sec at rateScale 1).
inline constexpr float  kExpandedFramesPerSec = 8.0f;

/** Loop bounds in spectral-frame units. `hasLoop` false = legacy clamp. */
struct RegionLoopBounds { float start{0.0f}; float end{0.0f}; bool hasLoop{false}; };

/**
 * Maps region loop points (source-audio sample frames) to spectral-frame
 * units on the synth frame clock. Only the five looping vocabularies
 * qualify; anything else (or degenerate bounds) keeps legacy behavior.
 */
inline RegionLoopBounds regionLoopBoundsFrames(const AxionikRegion& reg, size_t nFrames) noexcept {
    RegionLoopBounds out;
    if (nFrames < 2) return out;
    const float last = static_cast<float>(nFrames - 1);
    const float rate = reg.sampleRate > 0.0f ? reg.sampleRate : 44100.0f;
    const float a = std::clamp((static_cast<float>(reg.loopStartFrame) / rate) * kExpandedFramesPerSec, 0.0f, last);
    const float b = std::clamp((static_cast<float>(reg.loopEndFrame) / rate) * kExpandedFramesPerSec, 0.0f, last);
    const bool loopable = reg.loopMode == "loop_continuous" || reg.loopMode == "loop_sustain" ||
        reg.loopMode == "ping_pong" || reg.loopMode == "loop_backward" || reg.loopMode == "one_shot";
    if (!loopable || b <= a) return out;
    out.start = a;
    out.end = b;
    out.hasLoop = true;
    return out;
}

struct RegionLoopStep { float pos; int dir; bool finished; };

/**
 * Advances a frame position inside [a, b] per loop mode. Pure: unit-testable.
 * ping_pong reflects and flips dir; loop_backward keeps dir -1;
 * one_shot reports finished at the end; continuous/sustain wrap around.
 */
inline RegionLoopStep wrapRegionLoopPos(float pos, float a, float b, const std::string& mode, int dir) noexcept {
    const float span = b - a;
    if (span <= 0.0f) return {b, 1, mode == "one_shot"};
    if (mode == "ping_pong") {
        int d = (dir >= 0) ? 1 : -1;
        float p = pos;
        for (int i = 0; i < 2 && (p > b || p < a); ++i) {
            if (p > b) { p = b - (p - b); d = -1; }
            else if (p < a) { p = a + (a - p); d = 1; }
        }
        return {std::clamp(p, a, b), d, false};
    }
    if (mode == "loop_backward") {
        float p = pos;
        while (p < a) p += span;
        while (p > b) p -= span;
        return {p, -1, false};
    }
    if (mode == "one_shot") {
        if (pos >= b) return {b, 1, true};
        if (pos < a) return {a, 1, false};
        return {pos, 1, false};
    }
    float p = a + std::fmod(pos - a, span);
    if (p < a) p += span;
    return {p, 1, false};
}

class AxionikExpandedSynthesizer {
public:
    AxionikExpandedSynthesizer() = default;

    void prepare(double sampleRate, size_t /*maxBlockSize*/) noexcept {
        sampleRate_ = std::max(8000.0, sampleRate);
        invSampleRate_ = static_cast<float>(1.0 / sampleRate_);
        reset();
    }

    void reset() noexcept {
        for (auto& v : voices_) {
            v.active = false;
            v.releasing = false;
            v.envLevel = 0.0f;
            v.noteAge = 0;
            v.lpStateL = 0.0f;
            v.lpStateR = 0.0f;
            v.loopPos = 0.0f;
            v.loopDir = 1;
            v.loopInit = false;
        }
        rrCounter_ = 0;
        rrGroupKeys_.fill({});
        rrGroupCounters_.fill(0);
        decorrelDelayIdx_ = 0;
        decorrelLineL_.fill(0.0f);
        decorrelLineR_.fill(0.0f);
    }

    void loadModel(const AxionikExpandedModelDoc& doc) {
        model_ = doc;
        hasModel_ = true;
        reset();
    }

    void clearModel() noexcept {
        hasModel_ = false;
        reset();
    }

    [[nodiscard]] bool hasLoadedModel() const noexcept { return hasModel_; }
    [[nodiscard]] const AxionikExpandedModelDoc& getLoadedModel() const noexcept { return model_; }

    void setHostBpm(float bpm) noexcept {
        hostBpm_ = std::clamp(bpm, 20.0f, 300.0f);
    }

    void noteOn(uint8_t note, float velocityNorm) noexcept {
        if (!hasModel_) return;
        const int vel127 = std::clamp(static_cast<int>( std::lround(velocityNorm * 127.0f) ), 1, 127);

        // Trigger priority via ExtendedRegionDispatcher: `first` only when
        // nothing is sounding, `legato` only over held voices, `attack`
        // otherwise. (`release` regions spawn from noteOff.)
        const bool anyActive = anyVoiceActive();
        int matchedRegionIdx = -1;
        if (!anyActive) matchedRegionIdx = dispatchRegion(note, vel127, "first");
        if (matchedRegionIdx < 0 && anyActive) matchedRegionIdx = dispatchRegion(note, vel127, "legato");
        if (matchedRegionIdx < 0) matchedRegionIdx = dispatchRegion(note, vel127, "attack");
        if (matchedRegionIdx < 0 && !model_.regions.empty()) {
            matchedRegionIdx = 0;
        }
        startVoice(note, velocityNorm, matchedRegionIdx);
    }

    void noteOff(uint8_t note) noexcept {
        float relVel = 0.5f;
        for (auto& v : voices_) {
            if (v.active && !v.releasing && v.note == note) {
                relVel = v.velocityNorm;
                v.releasing = true;
                v.releaseStartLevel = v.envLevel;
                v.releaseElapsedSec = 0.0f;
            }
        }
        // `release`-trigger regions (edge blips, piano dampers, hats on
        // pedal lift) spawn a voice on key release.
        const int vel127 = std::clamp(static_cast<int>( std::lround(relVel * 127.0f) ), 1, 127);
        const int matchedRegionIdx = dispatchRegion(note, vel127, "release");
        if (matchedRegionIdx >= 0) {
            startVoice(note, relVel, matchedRegionIdx);
        }
    }

    [[nodiscard]] int getVoiceRegionIndex(size_t voiceIdx) const noexcept {
        if (voiceIdx >= voices_.size()) return -1;
        const auto& v = voices_[voiceIdx];
        return v.active ? v.regionIndex : -1;
    }

    [[nodiscard]] bool isVoiceReleasing(size_t voiceIdx) const noexcept {
        if (voiceIdx >= voices_.size()) return false;
        return voices_[voiceIdx].active && voices_[voiceIdx].releasing;
    }

    [[nodiscard]] bool anyVoiceActive() const noexcept {
        for (const auto& v : voices_) {
            if (v.active) return true;
        }
        return false;
    }

    void startVoice(uint8_t note, float velocityNorm, int matchedRegionIdx) noexcept {
        // Bounds guard: an empty model yields no region (previously UB via
        // regions[-1]/regions[0] indexing in the legacy fallback path).
        if (matchedRegionIdx < 0 ||
            static_cast<size_t>(matchedRegionIdx) >= model_.regions.size()) return;
        const int vel127 = std::clamp(static_cast<int>( std::lround(velocityNorm * 127.0f) ), 1, 127);
        // Allocate voice (steal oldest if full)
        size_t voiceIdx = 0;
        uint64_t maxAge = 0;
        bool foundFree = false;
        const size_t polyLimit = std::clamp<size_t>(
            static_cast<size_t>(model_.articulation.polyphony), 1, kMaxExpandedVoices);

        for (size_t i = 0; i < polyLimit; ++i) {
            if (!voices_[i].active) {
                voiceIdx = i;
                foundFree = true;
                break;
            }
            if (voices_[i].noteAge >= maxAge) {
                maxAge = voices_[i].noteAge;
                voiceIdx = i;
            }
        }
        if (!foundFree && polyLimit > 0 && voiceIdx >= polyLimit) {
            voiceIdx = 0;
        }

        VoiceState& v = voices_[voiceIdx];
        v.active = true;
        v.releasing = false;
        v.note = note;
        v.velocityNorm = std::clamp(velocityNorm, 0.0f, 1.0f);
        v.regionIndex = matchedRegionIdx;
        v.elapsedSec = 0.0f;
        v.releaseElapsedSec = 0.0f;
        v.envLevel = 0.0f;
        v.noteAge = ++globalNoteCounter_;
        v.lpStateL = 0.0f;
        v.lpStateR = 0.0f;
        v.loopPos = 0.0f;
        v.loopDir = 1;
        v.loopInit = false;

        // Calculate Key × Velocity crossfade gain
        v.regionCrossfadeGain = (matchedRegionIdx >= 0)
            ? computeRegionCrossfadeGain(model_.regions[static_cast<size_t>(matchedRegionIdx)], note, vel127)
            : 1.0f;

        // Initialize partial phases (lock to spliceFrameIndex if hybridTransient is active)
        v.phases.fill(0.0f);
        const auto* spec = resolveSpectrumForRegion(matchedRegionIdx);
        if (spec && !spec->frames.empty()) {
            size_t spliceIdx = 0;
            if (matchedRegionIdx >= 0 && model_.regions[static_cast<size_t>(matchedRegionIdx)].hybridTransient.enabled) {
                spliceIdx = std::min(
                    model_.regions[static_cast<size_t>(matchedRegionIdx)].hybridTransient.spliceFrameIndex,
                    spec->frames.size() - 1
                );
            }
            const auto& f0Frame = spec->frames[spliceIdx];
            const size_t nPhases = std::min(f0Frame.phases.size(), kMaxPartialsPerVoice);
            for (size_t p = 0; p < nPhases; ++p) {
                v.phases[p] = f0Frame.phases[p];
            }
        }

        // Mute/choke group: the new voice silences same-group voices
        // (closed hi-hat chokes open hi-hat; 0 = no group).
        if (matchedRegionIdx >= 0 &&
            static_cast<size_t>(matchedRegionIdx) < model_.regions.size()) {
            const int mg = model_.regions[static_cast<size_t>(matchedRegionIdx)].muteGroup;
            if (mg != 0) {
                for (size_t i = 0; i < voices_.size(); ++i) {
                    if (i == voiceIdx) continue;
                    auto& o = voices_[i];
                    if (!o.active || o.releasing) continue;
                    if (o.regionIndex < 0 ||
                        static_cast<size_t>(o.regionIndex) >= model_.regions.size()) continue;
                    if (model_.regions[static_cast<size_t>(o.regionIndex)].muteGroup == mg) {
                        o.releasing = true;
                        o.releaseStartLevel = o.envLevel;
                        o.releaseElapsedSec = 0.0f;
                    }
                }
            }
        }
    }

    void allNotesOff() noexcept {
        for (auto& v : voices_) {
            v.active = false;
            v.releasing = false;
            v.envLevel = 0.0f;
        }
    }

    [[nodiscard]] uint32_t getActiveVoiceCount() const noexcept {
        uint32_t c = 0;
        for (const auto& v : voices_) {
            if (v.active) ++c;
        }
        return c;
    }

    /**
     * Renders discrete 4.0 Quad (`FL, FR, RL, RR`) and optionally accumulates into stereo
     * via decorrelated mono-compatible Pseudo-Surround downmix.
     */
    void processStereoAdd(
        float* leftOut,
        float* rightOut,
        size_t numSamples,
        float stickMorphX = 0.5f,
        float stickMorphY = 0.5f,
        float masterGain = 1.0f
    ) noexcept {
        if (!hasModel_ || numSamples == 0) return;

        const AxionikResonatorShapers shapers = resolveActiveShapers();
        const float cutoffHz = resolveActiveFilterCutoffHz();

        for (size_t s = 0; s < numSamples; ++s) {
            float busFL = 0.0f;
            float busFR = 0.0f;
            float busRL = 0.0f;
            float busRR = 0.0f;

            for (auto& v : voices_) {
                if (!v.active) continue;
                renderVoiceSampleQuad(v, shapers, stickMorphX, stickMorphY, busFL, busFR, busRL, busRR);
            }

            // Pseudo-Surround Stereo Downmix (Haas 7ms decorrelated rear field, mono-compatible)
            const float rearMid = 0.5f * (busRL + busRR);
            const float rearSide = 0.5f * (busRL - busRR);
            decorrelLineL_[decorrelDelayIdx_] = busRL;
            decorrelLineR_[decorrelDelayIdx_] = busRR;
            const size_t readIdx = (decorrelDelayIdx_ + 1) % decorrelLineL_.size();
            decorrelDelayIdx_ = readIdx;

            const float delayedRL = decorrelLineL_[readIdx];
            const float delayedRR = decorrelLineR_[readIdx];

            float stL = busFL + 0.62f * delayedRL + 0.18f * (rearMid + rearSide);
            float stR = busFR + 0.62f * delayedRR + 0.18f * (rearMid - rearSide);

            // Apply independent Synth filter if active
            if (cutoffHz < 19500.0f) {
                const float g = std::clamp(kTwoPi * cutoffHz * invSampleRate_, 0.005f, 0.95f);
                for (auto& v : voices_) {
                    (void)v;
                }
                filterLpL_ += g * (stL - filterLpL_);
                filterLpR_ += g * (stR - filterLpR_);
                stL = filterLpL_;
                stR = filterLpR_;
            }

            leftOut[s]  += stL * masterGain;
            rightOut[s] += stR * masterGain;
        }
    }

private:
    struct VoiceState {
        bool active{false};
        bool releasing{false};
        uint8_t note{60};
        float velocityNorm{0.8f};
        int regionIndex{0};
        float regionCrossfadeGain{1.0f};
        float elapsedSec{0.0f};
        float releaseElapsedSec{0.0f};
        float releaseStartLevel{0.0f};
        float envLevel{0.0f};
        float lpStateL{0.0f};
        float lpStateR{0.0f};
        // Fase loop-1: stateful loop cursor (only used when the region loops).
        float loopPos{0.0f};
        int loopDir{1};
        bool loopInit{false};
        uint64_t noteAge{0};
        std::array<float, kMaxPartialsPerVoice> phases{};
    };

    double sampleRate_{44100.0};
    float invSampleRate_{1.0f / 44100.0f};
    float hostBpm_{120.0f};
    bool hasModel_{false};
    uint64_t globalNoteCounter_{0};
    uint32_t rrCounter_{0};
    std::array<std::string, 16> rrGroupKeys_{};
    std::array<uint32_t, 16> rrGroupCounters_{};
    uint32_t noiseRng_{0x13579BDFu};
    float filterLpL_{0.0f};
    float filterLpR_{0.0f};
    size_t decorrelDelayIdx_{0};
    std::array<float, 320> decorrelLineL_{};
    std::array<float, 320> decorrelLineR_{};
    std::array<VoiceState, kMaxExpandedVoices> voices_{};
    AxionikExpandedModelDoc model_{};

    [[nodiscard]] float nextWhiteNoise() noexcept {
        noiseRng_ = noiseRng_ * 1664525u + 1013904223u;
        return (static_cast<float>(noiseRng_ >> 8) * (1.0f / 8388608.0f)) - 1.0f;
    }

    [[nodiscard]] AxionikResonatorShapers resolveActiveShapers() const noexcept {
        for (const auto& r : model_.resynators) {
            if (!r.skippedByAdaptation) return r.shapers;
        }
        return AxionikResonatorShapers{};
    }

    [[nodiscard]] float resolveActiveFilterCutoffHz() const noexcept {
        for (const auto& f : model_.articulation.filters) {
            if (!f.bypass) return std::clamp(f.cutoffHz, 40.0f, 20000.0f);
        }
        return 20000.0f;
    }

    uint32_t& rrCounterFor(const std::string& grp) noexcept {
        static constexpr size_t kMaxRrGroups = 16;
        if (!grp.empty()) {
            for (size_t i = 0; i < kMaxRrGroups; ++i) {
                if (i < rrGroupKeys_.size() && rrGroupKeys_[i] == grp) return rrGroupCounters_[i];
            }
            for (size_t i = 0; i < kMaxRrGroups; ++i) {
                if (i >= rrGroupKeys_.size()) break;
                if (rrGroupKeys_[i].empty()) {
                    rrGroupKeys_[i] = grp;
                    rrGroupCounters_[i] = 0;
                    return rrGroupCounters_[i];
                }
            }
        }
        return rrCounter_;
    }

    [[nodiscard]] int dispatchRegion(uint8_t note, int vel127, std::string_view triggerMode) noexcept {
        auto triggerMatch = [&](const AxionikRegion& r) {
            return r.trigger == triggerMode || (triggerMode == "attack" && r.trigger.empty());
        };
        auto zoneMatch = [&](const AxionikRegion& r) {
            return note >= r.lowKey && note <= r.highKey && vel127 >= r.lowVel && vel127 <= r.highVel;
        };
        int firstMatch = -1;
        for (size_t i = 0; i < model_.regions.size(); ++i) {
            if (triggerMatch(model_.regions[i]) && zoneMatch(model_.regions[i])) {
                firstMatch = static_cast<int>(i);
                break;
            }
        }
        if (firstMatch < 0) return -1;
        // Round-robin rotates inside the first matching group (first-group
        // wins on pathological group overlaps); ungrouped regions share the
        // legacy global counter.
        const std::string& grp = model_.regions[static_cast<size_t>(firstMatch)].roundRobinGroup;
        std::vector<int> candidates;
        for (size_t i = 0; i < model_.regions.size(); ++i) {
            const auto& r = model_.regions[i];
            if (!triggerMatch(r) || !zoneMatch(r)) continue;
            if (grp.empty() ? !r.roundRobinGroup.empty() : r.roundRobinGroup != grp) continue;
            candidates.push_back(static_cast<int>(i));
        }
        if (candidates.empty()) return -1;
        // Honor explicit roundRobinIndex order when every candidate sets one.
        bool allIndexed = true;
        for (int ci : candidates) {
            if (model_.regions[static_cast<size_t>(ci)].roundRobinIndex == 0) { allIndexed = false; break; }
        }
        if (allIndexed && candidates.size() > 1) {
            for (size_t a = 1; a < candidates.size(); ++a) {
                const int key = candidates[a];
                const int keyIdx = model_.regions[static_cast<size_t>(key)].roundRobinIndex;
                size_t b = a;
                while (b > 0 &&
                    model_.regions[static_cast<size_t>(candidates[b - 1])].roundRobinIndex > keyIdx) {
                    candidates[b] = candidates[b - 1];
                    --b;
                }
                candidates[b] = key;
            }
        }
        uint32_t& ctr = rrCounterFor(grp);
        const size_t pick = (ctr++) % candidates.size();
        return candidates[pick];
    }

    [[nodiscard]] static float computeRegionCrossfadeGain(const AxionikRegion& r, uint8_t note, int vel127) noexcept {
        float keyGain = 1.0f;
        if (r.keyFadeIn > 0 && note < r.lowKey + r.keyFadeIn) {
            keyGain = static_cast<float>(note - r.lowKey) / static_cast<float>(std::max(1, r.keyFadeIn));
        } else if (r.keyFadeOut > 0 && note > r.highKey - r.keyFadeOut) {
            keyGain = static_cast<float>(r.highKey - note) / static_cast<float>(std::max(1, r.keyFadeOut));
        }
        float velGain = 1.0f;
        if (r.velFadeIn > 0 && vel127 < r.lowVel + r.velFadeIn) {
            velGain = static_cast<float>(vel127 - r.lowVel) / static_cast<float>(std::max(1, r.velFadeIn));
        } else if (r.velFadeOut > 0 && vel127 > r.highVel - r.velFadeOut) {
            velGain = static_cast<float>(r.highVel - vel127) / static_cast<float>(std::max(1, r.velFadeOut));
        }
        float g = std::clamp(keyGain, 0.0f, 1.0f) * std::clamp(velGain, 0.0f, 1.0f);
        if (r.fadeCurve == "equal-power") {
            g = std::sin(g * 1.57079632679f);
        }
        return g;
    }

    [[nodiscard]] const AxionikSpectralModel* resolveSpectrumForRegion(int regionIdx) const noexcept {
        if (regionIdx >= 0 && static_cast<size_t>(regionIdx) < model_.regions.size()) {
            const auto& ref = model_.regions[static_cast<size_t>(regionIdx)].sampleRef;
            if (!ref.empty()) {
                auto it = model_.spectralBySample.find(ref);
                if (it != model_.spectralBySample.end() && !it->second.frames.empty()) {
                    return &it->second;
                }
            }
        }
        return &model_.spectral;
    }

    [[nodiscard]] float evaluateDahdsr(VoiceState& v, const AxionikDahdsr& env) noexcept {
        if (!v.releasing) {
            float t = v.elapsedSec;
            if (t < env.delay) {
                v.envLevel = 0.0f;
                return 0.0f;
            }
            t -= env.delay;
            const float att = std::max(0.001f, env.attack);
            if (t < att) {
                v.envLevel = t / att;
                return v.envLevel;
            }
            t -= att;
            if (t < env.hold) {
                v.envLevel = 1.0f;
                return 1.0f;
            }
            t -= env.hold;
            const float dec = std::max(0.001f, env.decay);
            if (t < dec) {
                const float k = t / dec;
                v.envLevel = 1.0f + (std::clamp(env.sustain, 0.0f, 1.0f) - 1.0f) * k;
                return v.envLevel;
            }
            v.envLevel = std::clamp(env.sustain, 0.0f, 1.0f);
            return v.envLevel;
        } else {
            const float rel = std::max(0.002f, env.release);
            if (v.releaseElapsedSec >= rel) {
                v.active = false;
                v.envLevel = 0.0f;
                return 0.0f;
            }
            v.envLevel = v.releaseStartLevel * (1.0f - (v.releaseElapsedSec / rel));
            return v.envLevel;
        }
    }

    void renderVoiceSampleQuad(
        VoiceState& v,
        const AxionikResonatorShapers& shapers,
        float morphX,
        float /*morphY*/,
        float& outFL,
        float& outFR,
        float& outRL,
        float& outRR
    ) noexcept {
        const bool hasReg = v.regionIndex >= 0 && static_cast<size_t>(v.regionIndex) < model_.regions.size();
        const AxionikRegion* reg = hasReg ? &model_.regions[static_cast<size_t>(v.regionIndex)] : nullptr;
        const AxionikDahdsr& envCfg = (reg && reg->hasAmpEnvOverride) ? reg->ampEnvOverride : model_.articulation.ampEnv;

        const float env = evaluateDahdsr(v, envCfg);
        v.elapsedSec += invSampleRate_;
        if (v.releasing) v.releaseElapsedSec += invSampleRate_;
        if (!v.active || env <= 1e-6f) return;

        const AxionikSpectralModel* spec = resolveSpectrumForRegion(v.regionIndex);
        if (!spec || spec->frames.empty()) return;

        // Tempo-Sync & frame progression
        float rateScale = 1.0f;
        if (model_.unifiedSurface.present && model_.unifiedSurface.tempoSync.enabled) {
            const float srcBpm = std::max(20.0f, model_.unifiedSurface.tempoSync.sourceBpm);
            rateScale = hostBpm_ / srcBpm;
        }

        const size_t nFrames = spec->frames.size();
        const float lastFrame = static_cast<float>(nFrames > 1 ? nFrames - 1 : 0);
        // Fase loop-1: stateful loop cursor. no_loop (or degenerate bounds)
        // keeps the exact legacy formula (parity); looping modes wrap the
        // cursor inside the mapped bounds. Stick morphX offsets the loop
        // entry point at note start and is then frozen for looped voices.
        float framePos = 0.0f;
        {
            const float basePos = std::clamp(
                (v.elapsedSec * rateScale * kExpandedFramesPerSec) + morphX * lastFrame,
                0.0f,
                lastFrame);
            const AxionikRegion fallbackReg{};
            const AxionikRegion& rr = reg ? *reg : fallbackReg;
            const RegionLoopBounds lb = regionLoopBoundsFrames(rr, nFrames);
            if (!lb.hasLoop) {
                framePos = basePos;
            } else {
                if (!v.loopInit) {
                    v.loopDir = (rr.loopMode == "loop_backward") ? -1 : 1;
                    v.loopPos = (v.loopDir < 0) ? lb.end : std::clamp(basePos, lb.start, lb.end);
                    v.loopInit = true;
                }
                const float step = rateScale * kExpandedFramesPerSec * invSampleRate_;
                v.loopPos += step * static_cast<float>(v.loopDir);
                const RegionLoopStep st = wrapRegionLoopPos(v.loopPos, lb.start, lb.end, rr.loopMode, v.loopDir);
                v.loopPos = st.pos;
                v.loopDir = st.dir;
                if (st.finished) {
                    v.releasing = true;
                    v.releaseStartLevel = v.envLevel;
                    v.releaseElapsedSec = 0.0f;
                }
                framePos = v.loopPos;
            }
        }
        const size_t idx0 = static_cast<size_t>(framePos);
        const size_t idx1 = std::min(idx0 + 1, nFrames - 1);
        const float frac = framePos - static_cast<float>(idx0);

        const auto& f0 = spec->frames[idx0];
        const auto& f1 = spec->frames[idx1];

        // Fundamental pitch with region rootKey + keytrack + detune
        const int rootKey = reg ? reg->rootKey : 60;
        const float keytrack = reg ? (reg->pitchKeytrack * 0.01f) : 1.0f;
        const float detuneSemi = reg ? (reg->detuneCents * 0.01f) : 0.0f;
        const float noteOffsetSemi = (static_cast<float>(v.note) - static_cast<float>(rootKey)) * keytrack + detuneSemi;
        const float baseFreqHz = 440.0f * std::pow(2.0f, (static_cast<float>(rootKey) - 69.0f + noteOffsetSemi) / 12.0f);

        const size_t nPartials = std::min({
            spec->partialCount,
            f0.amps.size(),
            kMaxPartialsPerVoice,
            static_cast<size_t>(48) // cap per-sample inner loop for fast real-time rendering
        });

        const float B = std::max(0.0f, shapers.inharmonicityB);
        const float parity = std::clamp(shapers.parity, -1.0f, 1.0f);
        const float shiftHz = shapers.spectralShiftHz;
        const float entropyRough = std::clamp(shapers.entropyRoughness, 0.0f, 1.0f);
        const float hfRollOff = std::clamp(shapers.hfRollOffDbPerOct, -24.0f, 0.0f);
        const float formantShiftRatio = std::pow(2.0f, std::clamp(shapers.formantShiftSt, -24.0f, 24.0f) / 12.0f);
        const float formantPreserve = std::clamp(shapers.formantPreserve, 0.0f, 1.0f);
        const float nyquist = static_cast<float>(sampleRate_ * 0.48);

        float harmonicSum = 0.0f;
        for (size_t p = 0; p < nPartials; ++p) {
            // Formant preservation / shifting index lookup across harmonic envelope
            const float shiftedIdx = std::clamp(
                static_cast<float>(p) / std::max(0.25f, formantShiftRatio),
                0.0f,
                static_cast<float>(f0.amps.size() - 1)
            );
            const size_t fIdx = static_cast<size_t>(shiftedIdx);
            const float rawA0 = f0.amps[p];
            const float rawA1 = (p < f1.amps.size()) ? f1.amps[p] : rawA0;
            const float rawAmp = rawA0 + (rawA1 - rawA0) * frac;
            // Formant path interpolates across frames exactly like the raw
            // path (previously it read the f0 frame only).
            const float formAmp0 = f0.amps[fIdx];
            const float formAmp1 = (fIdx < f1.amps.size()) ? f1.amps[fIdx] : formAmp0;
            const float formAmp = formAmp0 + (formAmp1 - formAmp0) * frac;
            float amp = rawAmp * (1.0f - formantPreserve) + formAmp * formantPreserve;
            if (amp <= 1e-6f) continue;

            // Even/Odd parity shaper
            const bool isEven = ((p + 1) % 2) == 0;
            if (parity < 0.0f && isEven) {
                amp *= (1.0f + parity);
            } else if (parity > 0.0f && !isEven) {
                amp *= (1.0f - parity);
            }

            const float n = static_cast<float>(p + 1);
            // HF Roll-off per octave above fundamental (default -6 dB/oct neutral)
            const float octavesAboveF0 = std::log2(n);
            const float extraRollDb = (hfRollOff - (-6.0f)) * octavesAboveF0;
            if (std::abs(extraRollDb) > 0.05f) {
                amp *= std::pow(10.0f, std::clamp(extraRollDb, -48.0f, 18.0f) * 0.05f);
            }

            // Loris partial bandwidth roughness modulation
            if (entropyRough > 0.001f) {
                const float bw = (p < f0.bandwidths.size()) ? f0.bandwidths[p] : 0.15f;
                amp *= (1.0f + nextWhiteNoise() * entropyRough * std::clamp(bw, 0.05f, 1.0f) * 0.45f);
            }

            const float stiff = (B > 0.0f) ? std::sqrt(1.0f + B * n * n) : 1.0f;
            const float off0 = (p < f0.offsets.size()) ? f0.offsets[p] : 0.0f;
            const float off1 = (p < f1.offsets.size()) ? f1.offsets[p] : off0;
            const float partialHz = baseFreqHz * n * stiff + (off0 + (off1 - off0) * frac) + shiftHz;
            if (partialHz <= 10.0f || partialHz >= nyquist) continue;

            v.phases[p] += kTwoPi * partialHz * invSampleRate_;
            if (v.phases[p] >= kTwoPi) v.phases[p] -= kTwoPi;

            harmonicSum += amp * std::sin(v.phases[p]);
        }

        // Hybrid transient micro-impulse boost during the initial attack window
        float transientSignal = 0.0f;
        if (reg && reg->hybridTransient.enabled) {
            const float durSec = std::max(0.005f, reg->hybridTransient.durationMs * 0.001f);
            if (v.elapsedSec < durSec) {
                const float tEnv = 1.0f - (v.elapsedSec / durSec);
                transientSignal = nextWhiteNoise() * tEnv * 0.15f;
            }
        }

        // DDSP stochastic residual mix
        const float resMix = std::clamp(shapers.residualMix, 0.0f, 1.0f);
        const float residualSignal = nextWhiteNoise() * 0.05f * resMix;

        const float combined =
            ((1.0f - 0.5f * resMix) * harmonicSum + residualSignal + transientSignal) *
            env * v.velocityNorm * v.regionCrossfadeGain * 0.2f;

        // Spatial 4.0 radiation (`spatialQuad` + `shapers.spatialSpread`)
        const float spread = std::clamp(shapers.spatialSpread, 0.0f, 1.0f);
        const float qFL = f0.spatialQuad[0];
        const float qFR = f0.spatialQuad[1];
        const float qRL = f0.spatialQuad[2] * spread;
        const float qRR = f0.spatialQuad[3] * spread;

        outFL += combined * qFL;
        outFR += combined * qFR;
        outRL += combined * qRL;
        outRR += combined * qRR;
    }
};

} // namespace abd::axionik::extended
