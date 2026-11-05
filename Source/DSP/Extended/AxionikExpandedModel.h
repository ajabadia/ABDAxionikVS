// ============================================================================
// ABDAxionikVS — Source/DSP/Extended/AxionikExpandedModel.h
// Fase B (11.5.6): C++20 Pure (JUCE-free) Parser, Preflight Gate, Adaptation
// Engine & Time-Capsule Layer Resolver for `05_extended_model/axionik-expanded.json`
// (and v1 `model.nmmodel` fallback).
// ============================================================================

#pragma once

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#ifndef AXIONIK_TARGET_MODEL
#define AXIONIK_TARGET_MODEL 2
#endif

namespace abd::axionik::extended {

inline constexpr std::string_view kAxionikExpandedSchemaVersion = "2.0.0";
inline constexpr std::string_view kExpandedModelV2CapsuleRelPath = "05_extended_model/axionik-expanded.json";
inline constexpr std::string_view kLegacyNmModelV1CapsuleRelPath = "05_extended_model/model.nmmodel";
inline constexpr std::string_view kExtendedMapCapsuleRelPath     = "05_extended_model/extended_map.json";

enum class AxionikCanonicalMode : uint8_t {
    Classic  = 0,
    Plus     = 1,
    Expanded = 2
};

enum class AxionikSpatialOutputMode : uint8_t {
    PseudoSurroundStereo = 0,
    DiscreteQuad         = 1
};

inline constexpr std::string_view canonicalModeToString(AxionikCanonicalMode m) noexcept {
    switch (m) {
        case AxionikCanonicalMode::Classic:  return "classic";
        case AxionikCanonicalMode::Plus:     return "plus";
        case AxionikCanonicalMode::Expanded: return "expanded";
    }
    return "classic";
}

inline bool parseEngineGeneration(std::string_view gen, AxionikCanonicalMode& outCanonical, int& outRank) noexcept {
    if (gen == "classic") {
        outCanonical = AxionikCanonicalMode::Classic;
        outRank = 0;
        return true;
    }
    if (gen == "plus" || gen == "classic-enhanced") {
        outCanonical = AxionikCanonicalMode::Plus;
        outRank = 1;
        return true;
    }
    if (gen == "expanded" || gen == "expanded-v1") {
        outCanonical = AxionikCanonicalMode::Expanded;
        outRank = 2;
        return true;
    }
    return false;
}

inline bool isKnownEngineCap(std::string_view cap) noexcept {
    static constexpr std::array<std::string_view, 10> kCaps = {
        "hd-spectral",
        "formant-pitch-split",
        "morph-2d",
        "morph-3d",
        "latent-ref",
        "surround",
        "hybrid-transient",
        "filter-v2",
        "fx-v2",
        "ai-provenance"
    };
    for (auto c : kCaps) {
        if (c == cap) return true;
    }
    return false;
}

struct AxionikEngineCapabilityProfile {
    std::string generation{"expanded"};
    std::vector<std::string> caps{};
    size_t maxPartials{1024};
    size_t maxFrames{256};
    AxionikSpatialOutputMode spatialOutputMode{AxionikSpatialOutputMode::PseudoSurroundStereo};

    static AxionikEngineCapabilityProfile makeClassic() {
        return AxionikEngineCapabilityProfile{
            "classic",
            {},
            64,
            16,
            AxionikSpatialOutputMode::PseudoSurroundStereo
        };
    }

    static AxionikEngineCapabilityProfile makePlus() {
        return AxionikEngineCapabilityProfile{
            "plus",
            {"filter-v2", "fx-v2"},
            64,
            16,
            AxionikSpatialOutputMode::PseudoSurroundStereo
        };
    }

    static AxionikEngineCapabilityProfile makeExpanded(
        AxionikSpatialOutputMode spatial = AxionikSpatialOutputMode::PseudoSurroundStereo
    ) {
        return AxionikEngineCapabilityProfile{
            "expanded",
            {
                "hd-spectral",
                "formant-pitch-split",
                "morph-2d",
                "morph-3d",
                "latent-ref",
                "surround",
                "hybrid-transient",
                "filter-v2",
                "fx-v2",
                "ai-provenance"
            },
            1024,
            256,
            spatial
        };
    }

    static AxionikEngineCapabilityProfile makeForCompileTarget() {
#if AXIONIK_TARGET_MODEL == 0
        return makeClassic();
#elif AXIONIK_TARGET_MODEL == 1
        return makePlus();
#else
        return makeExpanded();
#endif
    }

    [[nodiscard]] bool hasCap(std::string_view cap) const noexcept {
        for (const auto& c : caps) {
            if (c == cap) return true;
        }
        return false;
    }
};

struct AxionikExpandedPreflightReport {
    bool ok{false};
    std::string schemaVersion{"unknown"};
    std::string engineMin{"unknown"};
    std::vector<std::string> requiredCaps{};
    std::vector<std::string> missingCaps{};
    std::vector<std::string> errors{};
    std::vector<std::string> warnings{};
    std::vector<std::string> adaptations{};
    bool usedLegacyNmModelFallback{false};
    bool spatialDownmixApplied{false};
};

struct AxionikIdentity {
    std::string slug{"untitled"};
    std::string expandedName{"UNTITLED"};
    std::string modelName{"UNTITLED"};
    std::string engineMin{"expanded"};
    std::vector<std::string> requiredCaps{};
    int classicSlot{0};
};

struct AxionikSpectralFrame {
    std::vector<float> amps{};
    std::vector<float> offsets{};
    float f0Hz{220.0f};
    float formantShiftSt{0.0f};
    float weight{1.0f};
    float timeSec{0.0f};
    std::vector<float> phases{};
    std::vector<float> bandwidths{};
    std::vector<float> residualBandsDb{};
    std::vector<float> formantEnvelopeDb{};
    std::array<float, 4> spatialQuad{1.0f, 1.0f, 0.5f, 0.5f};
};

struct AxionikSpectralModel {
    size_t partialCount{64};
    size_t frameCount{1};
    float frameSpanHz{20000.0f};
    bool gridFixed{true};
    std::vector<AxionikSpectralFrame> frames{};
    std::vector<float> pitchTrackHz{};
    std::vector<float> formantProfileSt{};
    size_t barkBandCount{24};
};

struct AxionikHybridTransient {
    bool enabled{false};
    float durationMs{24.0f};
    float crossfadeMs{6.0f};
    float gainDb{0.0f};
    size_t onsetFrame{0};
    size_t spliceFrameIndex{0};
};

struct AxionikSurfaceModulationProfile {
    float modulationRateHz{0.0f};
    float modulationDepth{0.0f};
    float oddEvenModDepth{0.0f};
    float estimatedDetuneCents{0.0f};
};

struct AxionikSpectralSurfaceNode {
    std::string id{"node_0"};
    std::string sampleRef{};
    int rootKey{60};
    int lowKey{0};
    int highKey{127};
    int velocityCenter{100};
    int lowVel{1};
    int highVel{127};
    float measuredF0Hz{261.63f};
    float harmonicity{0.9f};
    float timbreCoherenceScore{1.0f};
    bool isTimbralOutlier{false};
    size_t attackPeakFrame{1};
    size_t sustainStartFrame{2};
    size_t sustainEndFrame{15};
    bool loopingOrbit{true};
    float hfDampingDbPerSec{3.0f};
    AxionikSurfaceModulationProfile modulation{};
    AxionikHybridTransient hybridTransient{};
    std::vector<AxionikSpectralFrame> frames{};
};

struct AxionikSurfaceTempoSync {
    bool enabled{false};
    float sourceBpm{120.0f};
    float targetBpm{120.0f};
    int barCount{1};
    std::array<int, 2> timeSignature{4, 4};
    std::string grooveMode{"free"};
};

struct AxionikUnifiedSpectralSurface {
    bool present{false};
    std::string topology{"melodic_surface"}; // "melodic_surface" | "drum_kit_surface"
    std::string resolutionTier{"hd"};
    float pitchMonotonicityScore{1.0f};
    float adjacentFormantSimilarity{0.9f};
    size_t partialCount{64};
    size_t frameCount{16};
    size_t canonicalAttackPeakFrame{1};
    size_t canonicalSustainStartFrame{2};
    std::vector<float> globalBodyFormantDb{};
    AxionikSurfaceTempoSync tempoSync{};
    std::vector<AxionikSpectralSurfaceNode> nodes{};
};

struct AxionikDahdsr {
    float delay{0.0f};
    float attack{0.01f};
    float hold{0.0f};
    float decay{0.25f};
    float sustain{0.8f};
    float release{0.35f};
};

struct AxionikFilterBlock {
    std::string id{"main-filter"};
    std::string type{"legacy-neuron"};
    float cutoffHz{8000.0f};
    float resonance{0.15f};
    float keytrack{0.0f};
    bool bypass{false};
};

struct AxionikFxBlock {
    std::string id{"fx-0"};
    std::string type{"chorus-v2"};
    bool bypass{false};
    float mix{0.25f};
};

struct AxionikRegion {
    std::string id{"reg_0"};
    std::string sampleRef{};
    int lowKey{0};
    int highKey{127};
    int rootKey{60};
    int lowVel{1};
    int highVel{127};
    float detuneCents{0.0f};
    float volumeDb{0.0f};
    float pan{0.0f};
    float pitchKeytrack{100.0f};
    std::string trigger{"attack"}; // "attack" | "release" | "first" | "legato"
    int keyFadeIn{0};
    int keyFadeOut{0};
    int velFadeIn{0};
    int velFadeOut{0};
    std::string fadeCurve{"equal-power"}; // "linear" | "equal-power" | "spectral-morph"
    std::string roundRobinGroup{};
    int roundRobinIndex{0};
    std::string loopMode{"no_loop"};
    size_t loopStartFrame{0};
    size_t loopEndFrame{0};
    float loopCrossfadeMs{0.0f};
    int channels{2};
    AxionikHybridTransient hybridTransient{};
    bool hasAmpEnvOverride{false};
    AxionikDahdsr ampEnvOverride{};
};

struct AxionikArticulation {
    AxionikDahdsr ampEnv{};
    std::vector<AxionikFilterBlock> filters{};
    std::vector<AxionikFxBlock> fxChain{};
    int polyphony{16};
    std::string voiceMode{"poly"};
    float glideTimeSec{0.0f};
};

struct AxionikResonatorShapers {
    float inharmonicityB{0.0f};
    float parity{0.0f};
    float entropyRoughness{0.0f};
    float spectralShiftHz{0.0f};
    float hfRollOffDbPerOct{-6.0f};
    float formantShiftSt{0.0f};
    float formantPreserve{0.85f};
    float residualMix{0.15f};
    float spatialSpread{0.5f};
};

struct AxionikResynatorV2 {
    std::string id{"r1"};
    int version{2};
    std::string model{"resonator-hd"};
    AxionikResonatorShapers shapers{};
    bool skippedByAdaptation{false};
};

struct AxionikExpandedModelDoc {
    std::string schemaVersion{"2.0.0"};
    AxionikIdentity identity{};
    AxionikSpectralModel spectral{};
    std::unordered_map<std::string, AxionikSpectralModel> spectralBySample{};
    AxionikUnifiedSpectralSurface unifiedSurface{};
    bool hasMorphSpace{false};
    int morphDims{0};
    bool hasLatentRef{false};
    std::vector<AxionikRegion> regions{};
    AxionikArticulation articulation{};
    std::vector<AxionikResynatorV2> resynators{};
    size_t aiStepCount{0};
    std::string classicFallbackModelName{"UNTITLED"};
};

// ============================================================================
// Lightweight Zero-Dependency DOM-style JSON Value & Parser (C++20 Pure)
// ============================================================================
namespace detail {

struct JsonVal {
    enum class Kind : uint8_t { Null, Bool, Number, String, Array, Object };
    Kind kind{Kind::Null};
    bool boolVal{false};
    double numVal{0.0};
    std::string strVal{};
    std::vector<JsonVal> arrVal{};
    std::vector<std::pair<std::string, JsonVal>> objVal{};

    [[nodiscard]] bool isObject() const noexcept { return kind == Kind::Object; }
    [[nodiscard]] bool isArray() const noexcept { return kind == Kind::Array; }
    [[nodiscard]] bool isString() const noexcept { return kind == Kind::String; }
    [[nodiscard]] bool isNumber() const noexcept { return kind == Kind::Number; }
    [[nodiscard]] bool isBool() const noexcept { return kind == Kind::Bool; }

    [[nodiscard]] const JsonVal* find(std::string_view key) const noexcept {
        if (kind != Kind::Object) return nullptr;
        for (const auto& kv : objVal) {
            if (kv.first == key) return &kv.second;
        }
        return nullptr;
    }

    [[nodiscard]] std::string getString(std::string_view key, std::string_view def = "") const {
        const auto* v = find(key);
        return (v && v->isString()) ? v->strVal : std::string(def);
    }

    [[nodiscard]] double getNumber(std::string_view key, double def = 0.0) const noexcept {
        const auto* v = find(key);
        return (v && v->isNumber()) ? v->numVal : def;
    }

    [[nodiscard]] bool getBool(std::string_view key, bool def = false) const noexcept {
        const auto* v = find(key);
        return (v && v->isBool()) ? v->boolVal : def;
    }
};

class JsonParser {
public:
    explicit JsonParser(std::string_view src) : src_(src) {}

    bool parseRoot(JsonVal& out) {
        skipWs();
        if (!parseValue(out)) return false;
        skipWs();
        return pos_ == src_.size();
    }

private:
    std::string_view src_;
    size_t pos_{0};

    void skipWs() noexcept {
        while (pos_ < src_.size()) {
            char c = src_[pos_];
            if (c == ' ' || c == '\t' || c == '\r' || c == '\n') ++pos_;
            else break;
        }
    }

    bool parseValue(JsonVal& out) {
        skipWs();
        if (pos_ >= src_.size()) return false;
        char c = src_[pos_];
        if (c == '{') return parseObject(out);
        if (c == '[') return parseArray(out);
        if (c == '"') {
            out.kind = JsonVal::Kind::String;
            return parseString(out.strVal);
        }
        if (c == 't' || c == 'f') return parseBool(out);
        if (c == 'n') return parseNull(out);
        if (c == '-' || (c >= '0' && c <= '9')) return parseNumber(out);
        return false;
    }

    bool parseObject(JsonVal& out) {
        out.kind = JsonVal::Kind::Object;
        out.objVal.clear();
        ++pos_; // '{'
        skipWs();
        if (pos_ < src_.size() && src_[pos_] == '}') {
            ++pos_;
            return true;
        }
        while (pos_ < src_.size()) {
            skipWs();
            if (pos_ >= src_.size() || src_[pos_] != '"') return false;
            std::string key;
            if (!parseString(key)) return false;
            skipWs();
            if (pos_ >= src_.size() || src_[pos_] != ':') return false;
            ++pos_;
            JsonVal val;
            if (!parseValue(val)) return false;
            out.objVal.emplace_back(std::move(key), std::move(val));
            skipWs();
            if (pos_ < src_.size() && src_[pos_] == ',') {
                ++pos_;
                continue;
            }
            if (pos_ < src_.size() && src_[pos_] == '}') {
                ++pos_;
                return true;
            }
            return false;
        }
        return false;
    }

    bool parseArray(JsonVal& out) {
        out.kind = JsonVal::Kind::Array;
        out.arrVal.clear();
        ++pos_; // '['
        skipWs();
        if (pos_ < src_.size() && src_[pos_] == ']') {
            ++pos_;
            return true;
        }
        while (pos_ < src_.size()) {
            JsonVal elem;
            if (!parseValue(elem)) return false;
            out.arrVal.push_back(std::move(elem));
            skipWs();
            if (pos_ < src_.size() && src_[pos_] == ',') {
                ++pos_;
                continue;
            }
            if (pos_ < src_.size() && src_[pos_] == ']') {
                ++pos_;
                return true;
            }
            return false;
        }
        return false;
    }

    bool parseString(std::string& out) {
        out.clear();
        if (pos_ >= src_.size() || src_[pos_] != '"') return false;
        ++pos_;
        while (pos_ < src_.size()) {
            char c = src_[pos_++];
            if (c == '"') return true;
            if (c == '\\') {
                if (pos_ >= src_.size()) return false;
                char esc = src_[pos_++];
                switch (esc) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    case 'u': {
                        if (pos_ + 4 > src_.size()) return false;
                        pos_ += 4;
                        out.push_back('?');
                        break;
                    }
                    default: return false;
                }
            } else {
                out.push_back(c);
            }
        }
        return false;
    }

    bool parseBool(JsonVal& out) {
        if (src_.substr(pos_, 4) == "true") {
            out.kind = JsonVal::Kind::Bool;
            out.boolVal = true;
            pos_ += 4;
            return true;
        }
        if (src_.substr(pos_, 5) == "false") {
            out.kind = JsonVal::Kind::Bool;
            out.boolVal = false;
            pos_ += 5;
            return true;
        }
        return false;
    }

    bool parseNull(JsonVal& out) {
        if (src_.substr(pos_, 4) == "null") {
            out.kind = JsonVal::Kind::Null;
            pos_ += 4;
            return true;
        }
        return false;
    }

    bool parseNumber(JsonVal& out) {
        size_t start = pos_;
        if (src_[pos_] == '-') ++pos_;
        if (pos_ >= src_.size()) return false;
        if (src_[pos_] == '0') {
            ++pos_;
        } else if (src_[pos_] >= '1' && src_[pos_] <= '9') {
            while (pos_ < src_.size() && src_[pos_] >= '0' && src_[pos_] <= '9') ++pos_;
        } else {
            return false;
        }
        if (pos_ < src_.size() && src_[pos_] == '.') {
            ++pos_;
            if (pos_ >= src_.size() || src_[pos_] < '0' || src_[pos_] > '9') return false;
            while (pos_ < src_.size() && src_[pos_] >= '0' && src_[pos_] <= '9') ++pos_;
        }
        if (pos_ < src_.size() && (src_[pos_] == 'e' || src_[pos_] == 'E')) {
            ++pos_;
            if (pos_ < src_.size() && (src_[pos_] == '+' || src_[pos_] == '-')) ++pos_;
            if (pos_ >= src_.size() || src_[pos_] < '0' || src_[pos_] > '9') return false;
            while (pos_ < src_.size() && src_[pos_] >= '0' && src_[pos_] <= '9') ++pos_;
        }
        std::string token(src_.substr(start, pos_ - start));
        char* endPtr = nullptr;
        double val = std::strtod(token.c_str(), &endPtr);
        if (!endPtr || endPtr == token.c_str()) return false;
        out.kind = JsonVal::Kind::Number;
        out.numVal = val;
        return true;
    }
};

inline void parseFloatVec(const JsonVal* arr, std::vector<float>& out) {
    out.clear();
    if (!arr || !arr->isArray()) return;
    out.reserve(arr->arrVal.size());
    for (const auto& item : arr->arrVal) {
        if (item.isNumber()) out.push_back(static_cast<float>(item.numVal));
    }
}

inline AxionikSpectralFrame parseSpectralFrameNode(const JsonVal& jf) {
    AxionikSpectralFrame f;
    parseFloatVec(jf.find("amps"), f.amps);
    if (f.amps.empty()) parseFloatVec(jf.find("amplitudes"), f.amps);
    parseFloatVec(jf.find("offsets"), f.offsets);
    if (f.offsets.empty()) parseFloatVec(jf.find("frequencyOffsets"), f.offsets);
    f.f0Hz = static_cast<float>(jf.getNumber("f0Hz", 220.0));
    f.formantShiftSt = static_cast<float>(jf.getNumber("formantShiftSt", 0.0));
    f.weight = static_cast<float>(jf.getNumber("weight", 1.0));
    f.timeSec = static_cast<float>(jf.getNumber("timeSec", 0.0));
    parseFloatVec(jf.find("phases"), f.phases);
    parseFloatVec(jf.find("bandwidths"), f.bandwidths);
    parseFloatVec(jf.find("residualBandsDb"), f.residualBandsDb);
    parseFloatVec(jf.find("formantEnvelopeDb"), f.formantEnvelopeDb);
    if (const auto* sq = jf.find("spatialQuad"); sq && sq->isArray() && sq->arrVal.size() >= 4) {
        for (size_t i = 0; i < 4; ++i) {
            f.spatialQuad[i] = static_cast<float>(sq->arrVal[i].numVal);
        }
    }
    return f;
}

inline bool parseSpectralModelNode(const JsonVal& js, AxionikSpectralModel& out) {
    const auto* pCount = js.find("partialCount");
    const auto* fCount = js.find("frameCount");
    const auto* frames = js.find("frames");
    if (!pCount || !pCount->isNumber() || !fCount || !fCount->isNumber() || !frames || !frames->isArray()) {
        return false;
    }
    out.partialCount = static_cast<size_t>(std::max(0.0, pCount->numVal));
    out.frameCount = static_cast<size_t>(std::max(0.0, fCount->numVal));
    out.frameSpanHz = static_cast<float>(js.getNumber("frameSpanHz", 20000.0));
    out.gridFixed = js.getBool("gridFixed", true);
    out.barkBandCount = static_cast<size_t>(std::max(1.0, js.getNumber("barkBandCount", 24.0)));
    parseFloatVec(js.find("pitchTrackHz"), out.pitchTrackHz);
    parseFloatVec(js.find("formantProfileSt"), out.formantProfileSt);
    out.frames.clear();
    out.frames.reserve(frames->arrVal.size());
    for (const auto& jf : frames->arrVal) {
        if (!jf.isObject()) continue;
        out.frames.push_back(parseSpectralFrameNode(jf));
    }
    return true;
}

inline AxionikHybridTransient parseHybridTransientNode(const JsonVal* jt) {
    AxionikHybridTransient ht;
    if (!jt || !jt->isObject()) return ht;
    ht.enabled = true;
    ht.durationMs = static_cast<float>(jt->getNumber("durationMs", 24.0));
    ht.crossfadeMs = static_cast<float>(jt->getNumber("crossfadeMs", 6.0));
    ht.gainDb = static_cast<float>(jt->getNumber("gainDb", 0.0));
    ht.onsetFrame = static_cast<size_t>(std::max(0.0, jt->getNumber("onsetFrame", 0.0)));
    ht.spliceFrameIndex = static_cast<size_t>(std::max(0.0, jt->getNumber("spliceFrameIndex", 0.0)));
    return ht;
}

inline AxionikDahdsr parseDahdsrNode(const JsonVal* je, const AxionikDahdsr& fallback = {}) {
    AxionikDahdsr env = fallback;
    if (!je || !je->isObject()) return env;
    env.delay   = static_cast<float>(je->getNumber("delay",   je->getNumber("delaySec",   env.delay)));
    env.attack  = static_cast<float>(je->getNumber("attack",  je->getNumber("attackSec",  env.attack)));
    env.hold    = static_cast<float>(je->getNumber("hold",    je->getNumber("holdSec",    env.hold)));
    env.decay   = static_cast<float>(je->getNumber("decay",   je->getNumber("decaySec",   env.decay)));
    env.sustain = static_cast<float>(je->getNumber("sustain", je->getNumber("sustainLevel", env.sustain)));
    env.release = static_cast<float>(je->getNumber("release", je->getNumber("releaseSec", env.release)));
    return env;
}

} // namespace detail

// ============================================================================
// Preflight & Structural Validation of `05_extended_model/axionik-expanded.json`
// ============================================================================

inline std::vector<std::string> deriveImpliedCaps(const AxionikExpandedModelDoc& doc) {
    std::vector<std::string> caps;
    size_t maxPartials = doc.spectral.partialCount;
    for (const auto& kv : doc.spectralBySample) {
        maxPartials = std::max(maxPartials, kv.second.partialCount);
    }
    if (maxPartials > 64) caps.emplace_back("hd-spectral");

    bool hasPitchFormantSplit = !doc.spectral.pitchTrackHz.empty() || !doc.spectral.formantProfileSt.empty();
    if (hasPitchFormantSplit) caps.emplace_back("formant-pitch-split");

    if (doc.hasMorphSpace && doc.morphDims == 2) caps.emplace_back("morph-2d");
    if (doc.hasMorphSpace && doc.morphDims == 3) caps.emplace_back("morph-3d");
    if (doc.hasLatentRef) caps.emplace_back("latent-ref");

    int maxChannels = 1;
    bool hasHybridTransient = false;
    for (const auto& r : doc.regions) {
        maxChannels = std::max(maxChannels, r.channels);
        if (r.hybridTransient.enabled) hasHybridTransient = true;
    }
    if (maxChannels > 2) caps.emplace_back("surround");

    for (const auto& c : doc.identity.requiredCaps) {
        if (c == "hybrid-transient") hasHybridTransient = true;
    }
    if (hasHybridTransient) caps.emplace_back("hybrid-transient");

    bool hasNonLegacyFilter = false;
    for (const auto& f : doc.articulation.filters) {
        if (f.type != "legacy-neuron") {
            hasNonLegacyFilter = true;
            break;
        }
    }
    if (hasNonLegacyFilter) caps.emplace_back("filter-v2");
    if (!doc.articulation.fxChain.empty()) caps.emplace_back("fx-v2");
    if (doc.aiStepCount > 0) caps.emplace_back("ai-provenance");
    return caps;
}

inline AxionikExpandedPreflightReport preflightExpandedModelForAxionik(
    std::string_view jsonText,
    const AxionikEngineCapabilityProfile& engine,
    AxionikExpandedModelDoc* outParsedDoc = nullptr
) {
    AxionikExpandedPreflightReport report;
    detail::JsonVal root;
    detail::JsonParser parser(jsonText);
    if (!parser.parseRoot(root)) {
        report.ok = false;
        report.errors.emplace_back("invalid-json: the document is not parseable JSON");
        return report;
    }

    if (!root.isObject()) {
        report.ok = false;
        report.errors.emplace_back("not-expanded-model: document fails the v2 structural guard");
        return report;
    }

    const auto* schemaVer = root.find("schemaVersion");
    const auto* identObj  = root.find("identity");
    const auto* specObj   = root.find("spectral");
    const auto* artObj    = root.find("articulation");
    const auto* anaObj    = root.find("analysis");
    const auto* clsObj    = root.find("classic");
    const auto* regArr    = root.find("regions");
    const auto* resArr    = root.find("resynators");

    if (!schemaVer || !schemaVer->isString() || schemaVer->strVal != kAxionikExpandedSchemaVersion ||
        !identObj || !identObj->isObject() ||
        !specObj  || !specObj->isObject()  ||
        !artObj   || !artObj->isObject()   ||
        !anaObj   || !anaObj->isObject()   ||
        !clsObj   || !clsObj->isObject()   ||
        !regArr   || !regArr->isArray()    ||
        !resArr   || !resArr->isArray()) {
        report.ok = false;
        report.errors.emplace_back("not-expanded-model: document fails the v2 structural guard");
        return report;
    }

    AxionikExpandedModelDoc doc;
    doc.schemaVersion = schemaVer->strVal;
    if (!detail::parseSpectralModelNode(*specObj, doc.spectral)) {
        report.ok = false;
        report.errors.emplace_back("not-expanded-model: document fails the v2 structural guard");
        return report;
    }

    const auto* slugVal  = identObj->find("slug");
    const auto* expName  = identObj->find("expandedName");
    const auto* modName  = identObj->find("modelName");
    const auto* engMin   = identObj->find("engineMin");
    const auto* reqCaps  = identObj->find("requiredCaps");

    if (!slugVal || !slugVal->isString() ||
        !expName || !expName->isString() ||
        !modName || !modName->isString() ||
        !engMin  || !engMin->isString()  ||
        !reqCaps || !reqCaps->isArray()) {
        report.ok = false;
        report.errors.emplace_back("not-expanded-model: document fails the v2 structural guard");
        return report;
    }

    AxionikCanonicalMode modelMode = AxionikCanonicalMode::Expanded;
    int needRank = -1;
    if (!parseEngineGeneration(engMin->strVal, modelMode, needRank)) {
        report.ok = false;
        report.errors.emplace_back("not-expanded-model: document fails the v2 structural guard");
        return report;
    }

    for (const auto& rc : reqCaps->arrVal) {
        if (!rc.isString() || !isKnownEngineCap(rc.strVal)) {
            report.ok = false;
            report.errors.emplace_back("not-expanded-model: document fails the v2 structural guard");
            return report;
        }
        doc.identity.requiredCaps.push_back(rc.strVal);
    }

    doc.identity.slug = slugVal->strVal;
    doc.identity.expandedName = expName->strVal;
    doc.identity.modelName = modName->strVal;
    doc.identity.engineMin = engMin->strVal;
    doc.identity.classicSlot = static_cast<int>(identObj->getNumber("classicSlot", 0.0));
    doc.classicFallbackModelName = clsObj->getString("modelName", doc.identity.modelName);

    // Optional per-sample HD spectra
    if (const auto* bySample = root.find("spectralBySample"); bySample && bySample->isObject()) {
        for (const auto& kv : bySample->objVal) {
            if (!kv.second.isObject()) continue;
            AxionikSpectralModel sampleSpec;
            if (detail::parseSpectralModelNode(kv.second, sampleSpec)) {
                doc.spectralBySample[kv.first] = std::move(sampleSpec);
            }
        }
    }

    // Optional Unified Continuous Spectral Surface (Fase 38)
    if (const auto* surf = root.find("unifiedSurface"); surf && surf->isObject()) {
        doc.unifiedSurface.present = true;
        doc.unifiedSurface.topology = surf->getString("topology", "melodic_surface");
        doc.unifiedSurface.resolutionTier = surf->getString("resolutionTier", "hd");
        doc.unifiedSurface.pitchMonotonicityScore = static_cast<float>(surf->getNumber("pitchMonotonicityScore", 1.0));
        doc.unifiedSurface.adjacentFormantSimilarity = static_cast<float>(surf->getNumber("adjacentFormantSimilarity", 0.9));
        doc.unifiedSurface.partialCount = static_cast<size_t>(std::max(1.0, surf->getNumber("partialCount", 64.0)));
        doc.unifiedSurface.frameCount = static_cast<size_t>(std::max(1.0, surf->getNumber("frameCount", 16.0)));
        doc.unifiedSurface.canonicalAttackPeakFrame = static_cast<size_t>(std::max(0.0, surf->getNumber("canonicalAttackPeakFrame", 1.0)));
        doc.unifiedSurface.canonicalSustainStartFrame = static_cast<size_t>(std::max(0.0, surf->getNumber("canonicalSustainStartFrame", 2.0)));
        detail::parseFloatVec(surf->find("globalBodyFormantDb"), doc.unifiedSurface.globalBodyFormantDb);

        if (const auto* ts = surf->find("tempoSync"); ts && ts->isObject()) {
            doc.unifiedSurface.tempoSync.enabled = ts->getBool("enabled", false);
            doc.unifiedSurface.tempoSync.sourceBpm = static_cast<float>(ts->getNumber("sourceBpm", 120.0));
            doc.unifiedSurface.tempoSync.targetBpm = static_cast<float>(ts->getNumber("targetBpm", doc.unifiedSurface.tempoSync.sourceBpm));
            doc.unifiedSurface.tempoSync.barCount = static_cast<int>(std::max(1.0, ts->getNumber("barCount", 1.0)));
            doc.unifiedSurface.tempoSync.grooveMode = ts->getString("grooveMode", "free");
        }

        if (const auto* nodesArr = surf->find("nodes"); nodesArr && nodesArr->isArray()) {
            for (const auto& jn : nodesArr->arrVal) {
                if (!jn.isObject()) continue;
                AxionikSpectralSurfaceNode node;
                node.id = jn.getString("id", "node");
                node.sampleRef = jn.getString("sampleRef", "");
                node.rootKey = static_cast<int>(jn.getNumber("rootKey", 60.0));
                node.lowKey = static_cast<int>(jn.getNumber("lowKey", 0.0));
                node.highKey = static_cast<int>(jn.getNumber("highKey", 127.0));
                node.velocityCenter = static_cast<int>(jn.getNumber("velocityCenter", 100.0));
                node.lowVel = static_cast<int>(jn.getNumber("lowVel", 1.0));
                node.highVel = static_cast<int>(jn.getNumber("highVel", 127.0));
                node.measuredF0Hz = static_cast<float>(jn.getNumber("measuredF0Hz", 261.63));
                node.harmonicity = static_cast<float>(jn.getNumber("harmonicity", 0.9));
                node.timbreCoherenceScore = static_cast<float>(jn.getNumber("timbreCoherenceScore", 1.0));
                node.isTimbralOutlier = jn.getBool("isTimbralOutlier", false);
                node.attackPeakFrame = static_cast<size_t>(std::max(0.0, jn.getNumber("attackPeakFrame", 1.0)));
                node.sustainStartFrame = static_cast<size_t>(std::max(0.0, jn.getNumber("sustainStartFrame", 2.0)));
                node.sustainEndFrame = static_cast<size_t>(std::max(0.0, jn.getNumber("sustainEndFrame", 15.0)));
                node.loopingOrbit = (jn.getString("sustainBehavior", "looping_orbit") == "looping_orbit");
                node.hfDampingDbPerSec = static_cast<float>(jn.getNumber("hfDampingDbPerSec", 3.0));
                if (const auto* jm = jn.find("modulation"); jm && jm->isObject()) {
                    node.modulation.modulationRateHz = static_cast<float>(jm->getNumber("modulationRateHz", 0.0));
                    node.modulation.modulationDepth = static_cast<float>(jm->getNumber("modulationDepth", 0.0));
                    node.modulation.oddEvenModDepth = static_cast<float>(jm->getNumber("oddEvenModDepth", 0.0));
                    node.modulation.estimatedDetuneCents = static_cast<float>(jm->getNumber("estimatedDetuneCents", 0.0));
                }
                node.hybridTransient = detail::parseHybridTransientNode(jn.find("hybridTransient"));
                if (const auto* nFrames = jn.find("frames"); nFrames && nFrames->isArray()) {
                    for (const auto& nf : nFrames->arrVal) {
                        if (nf.isObject()) node.frames.push_back(detail::parseSpectralFrameNode(nf));
                    }
                }
                doc.unifiedSurface.nodes.push_back(std::move(node));
            }
        }
    }

    // Optional morphSpace
    if (const auto* ms = root.find("morphSpace"); ms && ms->isObject()) {
        doc.hasMorphSpace = true;
        doc.morphDims = static_cast<int>(ms->getNumber("dims", 2.0));
        if (const auto* lr = ms->find("latentRef"); lr && lr->isObject()) {
            doc.hasLatentRef = true;
        }
    }

    // Regions
    for (const auto& jr : regArr->arrVal) {
        if (!jr.isObject()) continue;
        AxionikRegion reg;
        reg.id = jr.getString("id", "reg");
        reg.sampleRef = jr.getString("sampleRef", "");
        reg.lowKey = static_cast<int>(jr.getNumber("lowKey", 0.0));
        reg.highKey = static_cast<int>(jr.getNumber("highKey", 127.0));
        reg.rootKey = static_cast<int>(jr.getNumber("rootKey", 60.0));
        reg.lowVel = static_cast<int>(jr.getNumber("lowVel", 1.0));
        reg.highVel = static_cast<int>(jr.getNumber("highVel", 127.0));
        reg.detuneCents = static_cast<float>(jr.getNumber("detuneCents", 0.0));
        reg.volumeDb = static_cast<float>(jr.getNumber("volumeDb", 0.0));
        reg.pan = static_cast<float>(jr.getNumber("pan", 0.0));
        reg.pitchKeytrack = static_cast<float>(jr.getNumber("pitchKeytrack", 100.0));
        reg.trigger = jr.getString("trigger", "attack");
        reg.keyFadeIn = static_cast<int>(jr.getNumber("keyFadeIn", 0.0));
        reg.keyFadeOut = static_cast<int>(jr.getNumber("keyFadeOut", 0.0));
        reg.velFadeIn = static_cast<int>(jr.getNumber("velFadeIn", 0.0));
        reg.velFadeOut = static_cast<int>(jr.getNumber("velFadeOut", 0.0));
        reg.fadeCurve = jr.getString("fadeCurve", "equal-power");
        reg.roundRobinGroup = jr.getString("roundRobinGroup", "");
        reg.roundRobinIndex = static_cast<int>(jr.getNumber("roundRobinIndex", 0.0));
        reg.channels = static_cast<int>(std::max(1.0, jr.getNumber("channels", 2.0)));
        if (const auto* jl = jr.find("loop"); jl && jl->isObject()) {
            reg.loopMode = jl->getString("mode", "no_loop");
            reg.loopStartFrame = static_cast<size_t>(std::max(0.0, jl->getNumber("startFrame", 0.0)));
            reg.loopEndFrame = static_cast<size_t>(std::max(0.0, jl->getNumber("endFrame", 0.0)));
            reg.loopCrossfadeMs = static_cast<float>(jl->getNumber("crossfadeMs", 0.0));
        }
        reg.hybridTransient = detail::parseHybridTransientNode(jr.find("hybridTransient"));
        if (const auto* jae = jr.find("ampEnv"); jae && jae->isObject()) {
            reg.hasAmpEnvOverride = true;
            reg.ampEnvOverride = detail::parseDahdsrNode(jae);
        }
        doc.regions.push_back(std::move(reg));
    }

    // Articulation
    doc.articulation.ampEnv = detail::parseDahdsrNode(artObj->find("ampEnv"));
    doc.articulation.polyphony = static_cast<int>(std::max(1.0, artObj->getNumber("polyphony", 16.0)));
    doc.articulation.voiceMode = artObj->getString("voiceMode", "poly");
    doc.articulation.glideTimeSec = static_cast<float>(artObj->getNumber("glideTimeSec", 0.0));
    if (const auto* fltArr = artObj->find("filters"); fltArr && fltArr->isArray()) {
        for (const auto& jf : fltArr->arrVal) {
            if (!jf.isObject()) continue;
            AxionikFilterBlock fb;
            fb.id = jf.getString("id", "filter");
            fb.type = jf.getString("type", "legacy-neuron");
            fb.cutoffHz = static_cast<float>(jf.getNumber("cutoffHz", 8000.0));
            fb.resonance = static_cast<float>(jf.getNumber("resonance", 0.15));
            fb.keytrack = static_cast<float>(jf.getNumber("keytrack", 0.0));
            fb.bypass = jf.getBool("bypass", false);
            doc.articulation.filters.push_back(std::move(fb));
        }
    }
    if (const auto* fxArr = artObj->find("fxChain"); fxArr && fxArr->isArray()) {
        for (const auto& jx : fxArr->arrVal) {
            if (!jx.isObject()) continue;
            AxionikFxBlock xb;
            xb.id = jx.getString("id", "fx");
            xb.type = jx.getString("type", "chorus-v2");
            xb.bypass = jx.getBool("bypass", false);
            xb.mix = static_cast<float>(jx.getNumber("mix", 0.25));
            doc.articulation.fxChain.push_back(std::move(xb));
        }
    }

    // Resynators v2
    for (const auto& jres : resArr->arrVal) {
        if (!jres.isObject()) continue;
        AxionikResynatorV2 rv;
        rv.id = jres.getString("id", "r1");
        rv.version = static_cast<int>(jres.getNumber("version", 2.0));
        rv.model = jres.getString("model", "resonator-hd");
        if (const auto* jsh = jres.find("shapers"); jsh && jsh->isObject()) {
            rv.shapers.inharmonicityB = static_cast<float>(jsh->getNumber("inharmonicityB", 0.0));
            rv.shapers.parity = static_cast<float>(jsh->getNumber("parity", 0.0));
            rv.shapers.entropyRoughness = static_cast<float>(jsh->getNumber("entropyRoughness", 0.0));
            rv.shapers.spectralShiftHz = static_cast<float>(jsh->getNumber("spectralShiftHz", 0.0));
            rv.shapers.hfRollOffDbPerOct = static_cast<float>(jsh->getNumber("hfRollOffDbPerOct", -6.0));
            rv.shapers.formantShiftSt = static_cast<float>(jsh->getNumber("formantShiftSt", 0.0));
            rv.shapers.formantPreserve = static_cast<float>(jsh->getNumber("formantPreserve", 0.85));
            rv.shapers.residualMix = static_cast<float>(jsh->getNumber("residualMix", 0.15));
            rv.shapers.spatialSpread = static_cast<float>(jsh->getNumber("spatialSpread", 0.5));
        }
        doc.resynators.push_back(std::move(rv));
    }

    if (const auto* aiArr = root.find("aiChain"); aiArr && aiArr->isArray()) {
        doc.aiStepCount = aiArr->arrVal.size();
    }

    // ── Evaluate Preflight Rules (1:1 parity with `preflightExpandedModelForAxionik`) ──
    report.schemaVersion = doc.schemaVersion;
    report.engineMin = doc.identity.engineMin;
    report.requiredCaps = doc.identity.requiredCaps;

    AxionikCanonicalMode haveMode = AxionikCanonicalMode::Classic;
    int haveRank = -1;
    if (!parseEngineGeneration(engine.generation, haveMode, haveRank)) {
        report.errors.push_back("unknown-engine: generation '" + engine.generation + "' is not a known Axionik engine");
    } else {
        if (haveRank < needRank) {
            report.errors.push_back(
                "engine-too-old: document requires '" + doc.identity.engineMin +
                "' but engine is '" + engine.generation + "'"
            );
        }
        if (haveMode != modelMode) {
            std::string cEng(canonicalModeToString(haveMode));
            std::string cMod(canonicalModeToString(modelMode));
            report.errors.push_back(
                "mode-format-mismatch: Resynator/mode '" + cEng +
                "' only accepts '" + cEng + "' format models and rejects '" + cMod + "' models"
            );
        }
    }

    for (const auto& req : doc.identity.requiredCaps) {
        if (!engine.hasCap(req)) {
            report.missingCaps.push_back(req);
        }
    }
    if (!report.missingCaps.empty()) {
        std::string joined;
        for (size_t i = 0; i < report.missingCaps.size(); ++i) {
            if (i > 0) joined += ", ";
            joined += report.missingCaps[i];
        }
        report.errors.push_back("missing-caps: engine lacks [" + joined + "]");
    }

    // Implied capabilities check
    auto implied = deriveImpliedCaps(doc);
    for (const auto& cap : implied) {
        bool declared = false;
        for (const auto& rc : doc.identity.requiredCaps) {
            if (rc == cap) {
                declared = true;
                break;
            }
        }
        if (!declared) {
            report.warnings.push_back(
                "caps-incomplete: document uses '" + cap + "' content but does not declare it in requiredCaps"
            );
        }
    }

    // Degradable mismatches -> explicit adaptations
    for (const auto& res : doc.resynators) {
        if (res.model != "resonator-hd" && res.model != "resonator-classic") {
            report.warnings.push_back(
                "unknown-resynator: '" + res.id + "' model '" + res.model + "' has no local implementation"
            );
            report.adaptations.push_back(
                "skip resynator '" + res.id + "' (unknown model '" + res.model + "')"
            );
        }
    }
    for (const auto& f : doc.articulation.filters) {
        if (f.type != "legacy-neuron" && !f.bypass) {
            report.adaptations.push_back(
                "bypass filter '" + f.id + "' of unknown type '" + f.type + "' when the engine cannot render it"
            );
        }
    }
    for (const auto& fx : doc.articulation.fxChain) {
        report.adaptations.push_back(
            "bypass FX '" + fx.id + "' of type '" + fx.type + "' when the engine cannot render it"
        );
    }

    if (engine.maxPartials > 0 && doc.spectral.partialCount > engine.maxPartials) {
        report.warnings.push_back(
            "hd-truncation: document has " + std::to_string(doc.spectral.partialCount) +
            " partials but engine renders " + std::to_string(engine.maxPartials)
        );
        report.adaptations.push_back(
            "truncate spectrum to " + std::to_string(engine.maxPartials) + " partials (lossy: keep lowest partials)"
        );
    }
    if (engine.maxFrames > 0 && doc.spectral.frameCount > engine.maxFrames) {
        report.warnings.push_back(
            "frame-truncation: document has " + std::to_string(doc.spectral.frameCount) +
            " frames but engine renders " + std::to_string(engine.maxFrames)
        );
        report.adaptations.push_back(
            "truncate spectrum to " + std::to_string(engine.maxFrames) + " frames (lossy: keep earliest frames)"
        );
    }

    int docMaxChannels = 1;
    for (const auto& r : doc.regions) {
        docMaxChannels = std::max(docMaxChannels, r.channels);
    }
    if (docMaxChannels > 2 && engine.spatialOutputMode == AxionikSpatialOutputMode::PseudoSurroundStereo) {
        report.adaptations.push_back(
            "spatial-downmix: render " + std::to_string(docMaxChannels) +
            ".0 Scape/Sphere via stereo Pseudo-Surround downmixer"
        );
        report.spatialDownmixApplied = true;
    }

    report.ok = report.errors.empty();
    if (outParsedDoc) {
        *outParsedDoc = std::move(doc);
    }
    return report;
}

/**
 * Applies the explicit adaptations declared in `report` onto `doc` so the C++ engine
 * executes the exact adapted state (truncating HD partials/frames, bypassing unknown
 * filters/FX/resynators).
 */
inline void applyExpandedPreflightAdaptations(
    AxionikExpandedModelDoc& doc,
    const AxionikEngineCapabilityProfile& engine
) {
    auto truncateSpec = [&](AxionikSpectralModel& sm) {
        if (engine.maxFrames > 0 && sm.frameCount > engine.maxFrames) {
            sm.frameCount = engine.maxFrames;
            if (sm.frames.size() > engine.maxFrames) {
                sm.frames.resize(engine.maxFrames);
            }
        }
        if (engine.maxPartials > 0 && sm.partialCount > engine.maxPartials) {
            sm.partialCount = engine.maxPartials;
            for (auto& fr : sm.frames) {
                if (fr.amps.size() > engine.maxPartials) fr.amps.resize(engine.maxPartials);
                if (fr.offsets.size() > engine.maxPartials) fr.offsets.resize(engine.maxPartials);
                if (fr.phases.size() > engine.maxPartials) fr.phases.resize(engine.maxPartials);
                if (fr.bandwidths.size() > engine.maxPartials) fr.bandwidths.resize(engine.maxPartials);
            }
        }
    };

    truncateSpec(doc.spectral);
    for (auto& kv : doc.spectralBySample) {
        truncateSpec(kv.second);
    }
    if (doc.unifiedSurface.present) {
        if (engine.maxPartials > 0 && doc.unifiedSurface.partialCount > engine.maxPartials) {
            doc.unifiedSurface.partialCount = engine.maxPartials;
        }
        if (engine.maxFrames > 0 && doc.unifiedSurface.frameCount > engine.maxFrames) {
            doc.unifiedSurface.frameCount = engine.maxFrames;
        }
        for (auto& node : doc.unifiedSurface.nodes) {
            if (engine.maxFrames > 0 && node.frames.size() > engine.maxFrames) {
                node.frames.resize(engine.maxFrames);
            }
            if (engine.maxPartials > 0) {
                for (auto& fr : node.frames) {
                    if (fr.amps.size() > engine.maxPartials) fr.amps.resize(engine.maxPartials);
                    if (fr.offsets.size() > engine.maxPartials) fr.offsets.resize(engine.maxPartials);
                    if (fr.phases.size() > engine.maxPartials) fr.phases.resize(engine.maxPartials);
                    if (fr.bandwidths.size() > engine.maxPartials) fr.bandwidths.resize(engine.maxPartials);
                }
            }
        }
    }

    for (auto& res : doc.resynators) {
        if (res.model != "resonator-hd" && res.model != "resonator-classic") {
            res.skippedByAdaptation = true;
        }
    }

    for (auto& f : doc.articulation.filters) {
        const bool supportedKnown =
            f.type == "legacy-neuron" ||
            (engine.hasCap("filter-v2") &&
             (f.type == "ladder-v2" || f.type == "svf-v2" || f.type == "comb-v2" || f.type == "formant-v2"));
        if (!supportedKnown) {
            f.bypass = true;
        }
    }

    for (auto& fx : doc.articulation.fxChain) {
        const bool supportedKnown =
            engine.hasCap("fx-v2") &&
            (fx.type == "chorus-v2" || fx.type == "reverb-fdn-v2" || fx.type == "delay-v2" || fx.type == "shimmer-v2");
        if (!supportedKnown) {
            fx.bypass = true;
        }
    }
}

/**
 * Fallback parser for v1 `05_extended_model/model.nmmodel` (+ optional `extended_map.json`).
 * Synthesizes a valid `AxionikExpandedModelDoc` so capsules predating v2 load cleanly in
 * `expanded` mode without ever touching `04_classic_enhanced/`.
 */
inline bool parseLegacyNmModelV1Json(
    std::string_view nmmodelJson,
    std::string_view extendedMapJson,
    AxionikExpandedModelDoc& outDoc
) {
    detail::JsonVal root;
    detail::JsonParser parser(nmmodelJson);
    if (!parser.parseRoot(root) || !root.isObject()) return false;

    const auto* framesArr = root.find("frames");
    if (!framesArr || !framesArr->isArray() || framesArr->arrVal.empty()) return false;

    outDoc = AxionikExpandedModelDoc{};
    outDoc.schemaVersion = "2.0.0";
    outDoc.identity.modelName = root.getString("name", "NMMODEL_V1");
    outDoc.identity.expandedName = root.getString("expandedName", outDoc.identity.modelName);
    outDoc.identity.slug = "legacy-nmmodel-v1";
    outDoc.identity.engineMin = "expanded";
    outDoc.spectral.partialCount = 64;
    outDoc.spectral.frameCount = framesArr->arrVal.size();
    outDoc.spectral.frames.reserve(framesArr->arrVal.size());

    for (const auto& jf : framesArr->arrVal) {
        if (!jf.isObject()) continue;
        auto frame = detail::parseSpectralFrameNode(jf);
        if (frame.amps.size() > outDoc.spectral.partialCount) {
            outDoc.spectral.partialCount = frame.amps.size();
        }
        outDoc.spectral.frames.push_back(std::move(frame));
    }
    if (outDoc.spectral.frames.empty()) return false;

    if (!extendedMapJson.empty()) {
        detail::JsonVal mapRoot;
        detail::JsonParser mapParser(extendedMapJson);
        if (mapParser.parseRoot(mapRoot) && mapRoot.isObject()) {
            if (const auto* regs = mapRoot.find("regions"); regs && regs->isArray()) {
                for (const auto& jr : regs->arrVal) {
                    if (!jr.isObject()) continue;
                    AxionikRegion r;
                    r.id = jr.getString("id", "reg_v1");
                    r.sampleRef = jr.getString("sampleName", "");
                    r.lowKey = static_cast<int>(jr.getNumber("lowKey", 0.0));
                    r.highKey = static_cast<int>(jr.getNumber("highKey", 127.0));
                    r.rootKey = static_cast<int>(jr.getNumber("rootKey", 60.0));
                    r.lowVel = static_cast<int>(jr.getNumber("lowVel", 1.0));
                    r.highVel = static_cast<int>(jr.getNumber("highVel", 127.0));
                    outDoc.regions.push_back(std::move(r));
                }
            }
        }
    }

    if (outDoc.regions.empty()) {
        AxionikRegion defReg;
        defReg.id = "default_v1";
        defReg.lowKey = 0;
        defReg.highKey = 127;
        defReg.rootKey = 60;
        defReg.lowVel = 1;
        defReg.highVel = 127;
        outDoc.regions.push_back(std::move(defReg));
    }

    AxionikResynatorV2 r1;
    r1.id = "r1";
    r1.model = "resonator-hd";
    outDoc.resynators.push_back(std::move(r1));
    return true;
}

} // namespace abd::axionik::extended
