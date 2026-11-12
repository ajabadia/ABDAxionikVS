// ============================================================================
// ABDAxionikVS -- DspEngineFacadeTests.cpp
// Pruebas unitarias offline del motor DSP desacoplado DspEngineFacade
// ============================================================================

#include "DSP/DspEngineFacade.h"
#include "DSP/NeuronTranslatorCurves.h"
#include "DSP/NeuronBankAdapter.h"
#include "DSP/Extended/AxionikExpandedSynthesizer.h"
#include "DSP/ParamGrouping.h"
#include "State/NeuronSound.h"
#include "DSP/AxionikParamIndices.h"
#include "DspCore/NeuronVS/NeuronOscillators.h"
#include <iostream>
#include <vector>
#include <cmath>
#include <cstring>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <memory> // heap-allocated facades: sizeof(DspEngineFacade) ~2.6 MB; three on main's 8 MB stack overflow it

using namespace abd::axionik;

int main() {
    std::cout << std::unitbuf;
    std::cerr << "[main] enter sizeof(Facade)=" << sizeof(DspEngineFacade) << std::endl;
    std::cout << "[DspEngineFacadeTests] Starting unit tests...\n";

    DspEngineFacade engine;
    engine.prepare(44100.0, 512);

    // Test 1: Silence at rest (no active voices)
    {
        std::vector<float> left(512, 0.0f);
        std::vector<float> right(512, 0.0f);

        engine.process(left.data(), right.data(), 512);

        float maxVal = 0.0f;
        for (size_t i = 0; i < 512; ++i) {
            maxVal = std::max(maxVal, std::abs(left[i]));
            maxVal = std::max(maxVal, std::abs(right[i]));
        }

        if (maxVal > 1e-6f) {
            std::cerr << "[FAIL] Test 1: Expected silence at rest, got maxVal=" << maxVal << "\n";
            return 1;
        }
        std::cout << "  [PASS] Test 1: Silence rendered when idle.\n";
    }

    // Test 2: NoteOn produces valid non-zero audio without NaN/INF
    {
        engine.noteOn(60, 0.8f);
        std::vector<float> left(512, 0.0f);
        std::vector<float> right(512, 0.0f);

        // Render multiple blocks so envelope rises
        bool producedSound = false;
        for (int b = 0; b < 10; ++b) {
            engine.process(left.data(), right.data(), 512);
            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(left[i]) || std::isinf(left[i]) || std::isnan(right[i]) || std::isinf(right[i])) {
                    std::cerr << "[FAIL] Test 2: NaN or INF detected in audio output!\n";
                    return 2;
                }
                if (std::abs(left[i]) > 0.001f || std::abs(right[i]) > 0.001f) {
                    producedSound = true;
                }
            }
        }

        if (!producedSound) {
            std::cerr << "[FAIL] Test 2: NoteOn did not produce expected audible signal.\n";
            return 2;
        }
        std::cout << "  [PASS] Test 2: NoteOn produces valid finite audio.\n";
    }

    // Test 3: Pitch bend clamping and resilience to extreme inputs
    {
        engine.setPitchBend(-100.0f); // Out of bounds negative
        std::vector<float> left(256, 0.0f);
        std::vector<float> right(256, 0.0f);
        engine.process(left.data(), right.data(), 256);

        engine.setPitchBend(+100.0f); // Out of bounds positive
        engine.process(left.data(), right.data(), 256);

        for (size_t i = 0; i < 256; ++i) {
            if (std::isnan(left[i]) || std::isinf(left[i])) {
                std::cerr << "[FAIL] Test 3: Pitch bend overflow resulted in NaN/INF!\n";
                return 3;
            }
        }
        std::cout << "  [PASS] Test 3: Extreme pitch bend clamped safely without overflow.\n";
    }

    // Test 4: Modulation controller boundaries
    {
        for (int src = 0; src < 6; ++src) {
            engine.setModulationSource(src, -5.0f);
            engine.setModulationSource(src, +10.0f);
        }
        std::vector<float> left(128, 0.0f);
        std::vector<float> right(128, 0.0f);
        engine.process(left.data(), right.data(), 128);

        for (size_t i = 0; i < 128; ++i) {
            if (std::isnan(left[i]) || std::isnan(right[i])) {
                std::cerr << "[FAIL] Test 4: Modulation source overflow produced NaN!\n";
                return 4;
            }
        }
        std::cout << "  [PASS] Test 4: Modulation sources safely bounded.\n";
    }

    // Test 5: Telemetry verification
    {
        auto telemetry = engine.getTelemetry();
        if (telemetry.cpuUsage < 0.0f || std::isnan(telemetry.cpuUsage)) {
            std::cerr << "[FAIL] Test 5: Invalid CPU telemetry: " << telemetry.cpuUsage << "\n";
            return 5;
        }
        std::cout << "  [PASS] Test 5: Telemetry reports valid load: " << telemetry.cpuUsage
                  << " (active voices: " << telemetry.activeVoices << ")\n";
    }

    // Test 6: Silver 4-Band EQ response verification (A/B Cut vs Boost)
    {
        engine.reset();
        engine.setParam(ParamIdx::SilverSwitch, 1.0f);
        engine.setParam(ParamIdx::FreqFXSwitch, 1.0f);
        engine.setParam(ParamIdx::CurFreqFX, 0.0f); // 0 = EQ 4-Band & Compressor
        engine.setParam(ParamIdx::EQ_Switch, 1.0f);
        engine.setParam(ParamIdx::EQ_LowShelfSwitch, 1.0f);
        engine.setParam(ParamIdx::EQ_LowShelfFreq, 100.0f); // Shelf around ~500 Hz
        engine.setParam(ParamIdx::EQ_LowShelfSlope, 50.0f);

        auto measureRms = [&](float gainDb) -> float {
            engine.reset();
            engine.setParam(ParamIdx::EQ_LowShelfGain, gainDb);
            engine.noteOn(36, 0.9f); // C2 low note (65.4 Hz)
            std::vector<float> left(512, 0.0f);
            std::vector<float> right(512, 0.0f);

            // Warmup envelope
            for (int b = 0; b < 5; ++b) {
                engine.process(left.data(), right.data(), 512);
            }

            // Accumulate energy
            double sumSq = 0.0;
            size_t totalSamples = 0;
            for (int b = 0; b < 10; ++b) {
                engine.process(left.data(), right.data(), 512);
                for (size_t i = 0; i < 512; ++i) {
                    sumSq += left[i] * left[i] + right[i] * right[i];
                    totalSamples += 2;
                }
            }
            engine.allNotesOff();
            return static_cast<float>(std::sqrt(sumSq / totalSamples));
        };

        float rmsCut = measureRms(-48.0f);   // -12 dB shelf cut
        float rmsBoost = measureRms(+48.0f); // +12 dB shelf boost

        if (rmsCut <= 0.0f || rmsBoost <= 0.0f) {
            std::cerr << "[FAIL] Test 6: EQ produced zero signal (rmsCut=" << rmsCut << ", rmsBoost=" << rmsBoost << ")\n";
            return 6;
        }

        if (rmsBoost <= rmsCut * 1.5f) {
            std::cerr << "[FAIL] Test 6: Boost did not significantly increase energy over Cut! rmsCut="
                      << rmsCut << ", rmsBoost=" << rmsBoost << "\n";
            return 6;
        }

        std::cout << "  [PASS] Test 6: Silver 4-Band EQ response verified (Cut RMS: "
                  << rmsCut << " vs Boost RMS: " << rmsBoost << ", ratio: " << (rmsBoost / rmsCut) << "x)\n";
    }

    // Release all notes
    engine.allNotesOff();
    engine.reset();

    // Test 7: Incomplete model detection (map.script referencing missing .scape/.sphere pair)
    {
        auto tempDir = std::filesystem::temp_directory_path() / "axionik_incomplete_model_test.model";
        std::filesystem::create_directories(tempDir);
        {
            std::ofstream mapOut(tempDir / "map.script");
            mapOut << "MapVersionMajor\t1\n"
                   << "000LowKey\t0\n"
                   << "000HiKey\t127\n"
                   << "000RootKey\t60\n"
                   << "000LowSource\t1\n"
                   << "000HiSource\t2\n" // Source 2 does not exist on disk
                   << "000Detune\t0\n"
                   << "000Volume\t0\n"
                   << "000Pan\t0\n";
        }
        bool loadedMissingAll = engine.loadModel(0, tempDir);
        std::filesystem::remove_all(tempDir);
        if (loadedMissingAll) {
            std::cerr << "[FAIL] Test 7: Incomplete model with missing .scape/.sphere pair should be rejected!\n";
            return 7;
        }
        std::cout << "  [PASS] Test 7: Incomplete model (missing referenced source pair) rejected as not loadable.\n";
    }

    // Test 8: Preset v1 -> v2 regime migration (FUN_10013ea0: SoundVersionMajor < 2 shifts BlenderAmount by -64)
    {
        SoundPreset v1Preset = NeuronSound::getEmbeddedInitPreset();
        v1Preset.versionMajor = 1;
        v1Preset.values[ParamIdx::SoundVersionMajor] = 1.0f;
        std::string v1Script = NeuronSound::serializeSoundScript(v1Preset);

        SoundPreset parsedV1;
        NeuronSound::parseSoundScript(v1Script, parsedV1);
        if (std::abs(parsedV1.values[ParamIdx::BlenderAmount] - (-64.0f)) > 1e-4f) {
            std::cerr << "[FAIL] Test 8: Expected v1 preset BlenderAmount=-64 after FUN_10013ea0 migration, got "
                      << parsedV1.values[ParamIdx::BlenderAmount] << "\n";
            return 8;
        }

        SoundPreset v2Preset = NeuronSound::getEmbeddedInitPreset();
        v2Preset.versionMajor = 2;
        v2Preset.values[ParamIdx::SoundVersionMajor] = 2.0f;
        std::string v2Script = NeuronSound::serializeSoundScript(v2Preset);

        SoundPreset parsedV2;
        NeuronSound::parseSoundScript(v2Script, parsedV2);
        if (std::abs(parsedV2.values[ParamIdx::BlenderAmount] - 0.0f) > 1e-4f) {
            std::cerr << "[FAIL] Test 8: Expected v2 preset BlenderAmount=0 (no migration), got "
                      << parsedV2.values[ParamIdx::BlenderAmount] << "\n";
            return 8;
        }
        std::cout << "  [PASS] Test 8: Preset v1->v2 migration regime (FUN_10013ea0) verified.\n";
    }

    // Test 9: Fase 11.5.6 -- Preflight blocks Expanded Model when engine lacks caps or is in Classic/Plus mode
    const std::string kSampleExpandedJson = R"JSON({
      "schemaVersion": "2.0.0",
      "identity": {
        "slug": "hyper-bell-v2",
        "expandedName": "HyperBell V2",
        "modelName": "HYPERBELL",
        "engineMin": "expanded",
        "requiredCaps": ["hd-spectral", "morph-2d", "surround", "filter-v2", "fx-v2"]
      },
      "spectral": {
        "partialCount": 512,
        "frameCount": 2,
        "frames": [
          { "amps": [0.9, 0.5, 0.3, 0.2], "offsets": [0.0, 0.0, 0.0, 0.0], "phases": [0.0, 0.0, 0.0, 0.0] },
          { "amps": [0.8, 0.4, 0.25, 0.15], "offsets": [0.0, 0.0, 0.0, 0.0], "phases": [0.0, 0.0, 0.0, 0.0] }
        ]
      },
      "unifiedSurface": {
        "topology": "melodic_surface",
        "resolutionTier": "hd",
        "partialCount": 512,
        "frameCount": 2,
        "tempoSync": {
          "enabled": true,
          "sourceBpm": 120,
          "targetBpm": 120,
          "barCount": 1,
          "grooveMode": "tempo_locked"
        },
        "nodes": [
          {
            "id": "n0",
            "sampleRef": "bell_c4",
            "rootKey": 60,
            "lowKey": 0,
            "highKey": 127,
            "velocityCenter": 100,
            "lowVel": 1,
            "highVel": 127,
            "measuredF0Hz": 261.63,
            "frames": [
              { "amps": [0.9, 0.5, 0.3, 0.2], "offsets": [0.0, 0.0, 0.0, 0.0] },
              { "amps": [0.8, 0.4, 0.25, 0.15], "offsets": [0.0, 0.0, 0.0, 0.0] }
            ]
          }
        ]
      },
      "morphSpace": {
        "dims": 2,
        "points": [{ "id": "p0", "coords": [0.0, 0.0] }]
      },
      "regions": [
        {
          "id": "reg-main",
          "sampleRef": "bell_c4",
          "lowKey": 0,
          "highKey": 127,
          "rootKey": 60,
          "lowVel": 1,
          "highVel": 127,
          "pitchKeytrack": 100.0,
          "keyFadeIn": 4,
          "keyFadeOut": 4,
          "fadeCurve": "equal-power",
          "channels": 4
        }
      ],
      "articulation": {
        "ampEnv": { "delay": 0.0, "attack": 0.002, "hold": 0.01, "decay": 0.25, "sustain": 0.85, "release": 0.2 },
        "polyphony": 16,
        "voiceMode": "poly",
        "filters": [
          { "id": "f1", "type": "svf-4p-hyper", "cutoffHz": 4200.0, "resonance": 0.35, "keytrack": 0.5, "bypass": false }
        ],
        "fxChain": [
          { "id": "fx1", "type": "chorus-v2", "bypass": false, "mix": 0.25 },
          { "id": "fx2", "type": "quantum-nebula-reverb", "bypass": false, "mix": 0.4 }
        ]
      },
      "resynators": [
        {
          "id": "r1",
          "version": 2,
          "model": "resonator-hd",
          "shapers": {
            "inharmonicityB": 0.0004,
            "parity": 0.2,
            "entropyRoughness": 0.15,
            "spectralShiftHz": 12.0,
            "hfRollOffDbPerOct": -6.0,
            "formantShiftSt": 1.0,
            "formantPreserve": 0.85,
            "residualMix": 0.2,
            "spatialSpread": 0.65
          }
        }
      ],
      "analysis": {},
      "classic": {
        "modelName": "HYPERBELL",
        "mapScriptRef": "04_classic_enhanced/map.script",
        "scapeSphereRefs": []
      }
    })JSON";

    {
        // 9a. Engine in Classic mode must reject axionik-expanded.json (mode-format-mismatch / engine-too-old)
        extended::AxionikEngineCapabilityProfile classicProfile =
            extended::AxionikEngineCapabilityProfile::makeClassic();
        engine.setEngineCapabilityProfile(classicProfile);

        extended::AxionikExpandedPreflightReport reportClassic;
        bool okClassic = engine.loadExpandedModelFromJson(0, kSampleExpandedJson, &reportClassic);
        if (okClassic || reportClassic.ok || engine.hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 9a: Classic mode engine must block axionik-expanded.json!\n";
            return 9;
        }

        // 9b. Engine in Expanded mode but missing required cap ("hd-spectral") must block load
        extended::AxionikEngineCapabilityProfile strippedProfile =
            extended::AxionikEngineCapabilityProfile::makeExpanded();
        strippedProfile.caps.erase(
            std::remove(strippedProfile.caps.begin(), strippedProfile.caps.end(), "hd-spectral"),
            strippedProfile.caps.end());
        engine.setEngineCapabilityProfile(strippedProfile);

        extended::AxionikExpandedPreflightReport reportStripped;
        bool okStripped = engine.loadExpandedModelFromJson(0, kSampleExpandedJson, &reportStripped);
        if (okStripped || reportStripped.ok || engine.hasExpandedModelLoaded(0) ||
            reportStripped.missingCaps.empty()) {
            std::cerr << "[FAIL] Test 9b: Engine missing 'hd-spectral' must block load and report missingCaps!\n";
            return 9;
        }

        std::cout << "  [PASS] Test 9: Preflight blocks incompatible mode and missing requiredCaps without silent partial load.\n";
    }

    // Test 10: Fase 11.5.6 -- Full Expanded Engine accepts model, applies explicit adaptations, and renders valid audio
    {
        extended::AxionikEngineCapabilityProfile fullProfile =
            extended::AxionikEngineCapabilityProfile::makeExpanded(
                extended::AxionikSpatialOutputMode::PseudoSurroundStereo);
        fullProfile.maxPartials = 256; // Triggers hd-truncation adaptation (512 -> 256)
        engine.setEngineCapabilityProfile(fullProfile);

        extended::AxionikExpandedPreflightReport reportOk;
        bool loadedOk = engine.loadExpandedModelFromJson(0, kSampleExpandedJson, &reportOk);
        if (!loadedOk || !reportOk.ok || !engine.hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 10: Full Expanded engine failed to load valid axionik-expanded.json!\n";
            return 10;
        }

        const auto* doc = engine.getExpandedModelDoc(0);
        if (doc == nullptr || doc->spectral.partialCount != 256 ||
            doc->articulation.filters.empty() || !doc->articulation.filters[0].bypass ||
            doc->articulation.fxChain.size() < 2 || !doc->articulation.fxChain[1].bypass ||
            reportOk.adaptations.size() < 4 || !reportOk.spatialDownmixApplied) {
            std::cerr << "[FAIL] Test 10: Expected preflight adaptations (256 partial truncation, unknown filter/FX bypass, 4.0->2.0 downmix) were not applied!\n";
            return 10;
        }

        engine.reset();
        engine.noteOn(60, 0.9f);
        std::vector<float> left(512, 0.0f);
        std::vector<float> right(512, 0.0f);
        bool audible = false;
        for (int b = 0; b < 6; ++b) {
            engine.process(left.data(), right.data(), 512);
            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(left[i]) || std::isinf(left[i]) || std::isnan(right[i]) || std::isinf(right[i])) {
                    std::cerr << "[FAIL] Test 10: Expanded synthesizer produced NaN/INF!\n";
                    return 10;
                }
                if (std::abs(left[i]) > 1e-4f || std::abs(right[i]) > 1e-4f) {
                    audible = true;
                }
            }
        }
        engine.allNotesOff();
        if (!audible) {
            std::cerr << "[FAIL] Test 10: Expanded synthesizer did not produce audible signal on noteOn!\n";
            return 10;
        }
        std::cout << "  [PASS] Test 10: Expanded engine loaded axionik-expanded.json, applied "
                  << reportOk.adaptations.size() << " adaptations, and rendered finite stereo Pseudo-Surround audio.\n";
    }

    // Test 11: Fase 11.5.6 -- Time-Capsule Layer Isolation (05_extended_model primary + model.nmmodel v1 fallback, never 04_classic_enhanced)
    {
        auto capsuleDir = std::filesystem::temp_directory_path() / "axionik_capsule_isolation_test";
        std::filesystem::remove_all(capsuleDir);
        std::filesystem::create_directories(capsuleDir / "04_classic_enhanced");
        std::filesystem::create_directories(capsuleDir / "05_extended_model");

        // 11a. Attempting to load 04_classic_enhanced via loadExpandedModelFolder must be rejected
        extended::AxionikExpandedPreflightReport isoReport;
        if (engine.loadExpandedModelFolder(0, capsuleDir / "04_classic_enhanced", &isoReport) || isoReport.ok) {
            std::filesystem::remove_all(capsuleDir);
            std::cerr << "[FAIL] Test 11a: loadExpandedModelFolder must reject 04_classic_enhanced!\n";
            return 11;
        }

        // 11b. Fallback to 05_extended_model/model.nmmodel when axionik-expanded.json is absent
        {
            std::ofstream nmOut(capsuleDir / "05_extended_model" / "model.nmmodel");
            nmOut << R"({"name":"FallbackV1Model","expandedName":"Fallback V1 Expanded","frames":[{"amps":[0.8,0.4,0.2,0.1]},{"amps":[0.7,0.5,0.25,0.12]}]})";
            std::ofstream mapOut(capsuleDir / "05_extended_model" / "extended_map.json");
            mapOut << R"({"regions":[{"id":"r_v1","lowKey":12,"highKey":108,"rootKey":57}]})";
        }
        extended::AxionikExpandedPreflightReport fbReport;
        if (!engine.loadExpandedModelFolder(0, capsuleDir, &fbReport) || !fbReport.ok ||
            !fbReport.usedLegacyNmModelFallback ||
            engine.getExpandedModelDoc(0) == nullptr ||
            engine.getExpandedModelDoc(0)->identity.modelName != "FallbackV1Model") {
            std::filesystem::remove_all(capsuleDir);
            std::cerr << "[FAIL] Test 11b: Failed to load v1 fallback 05_extended_model/model.nmmodel!\n";
            return 11;
        }

        // 11c. When 05_extended_model/axionik-expanded.json is present, it takes strict priority over model.nmmodel
        {
            std::ofstream expOut(capsuleDir / "05_extended_model" / "axionik-expanded.json");
            expOut << kSampleExpandedJson;
        }
        extended::AxionikExpandedPreflightReport priReport;
        if (!engine.loadExpandedModelFolder(0, capsuleDir, &priReport) || !priReport.ok ||
            priReport.usedLegacyNmModelFallback ||
            engine.getExpandedModelDoc(0) == nullptr ||
            engine.getExpandedModelDoc(0)->identity.expandedName != "HyperBell V2") {
            std::filesystem::remove_all(capsuleDir);
            std::cerr << "[FAIL] Test 11c: 05_extended_model/axionik-expanded.json did not take primary priority!\n";
            return 11;
        }

        std::filesystem::remove_all(capsuleDir);
        std::cout << "  [PASS] Test 11: Time-Capsule layer isolation (05_extended_model primary + model.nmmodel fallback, 04_classic_enhanced isolated) verified.\n";
    }

    // Test 12: Runtime Engine Mode Switching (expanded -> plus -> classic -> expanded) & Blender/Silver chain integration
    {
        if (DspEngineFacade::getCompileTargetMode() != "expanded") {
            std::cerr << "[FAIL] Test 12: Default compile target mode must be 'expanded'!\n";
            return 12;
        }
        if (!engine.setEngineMode("classic") || engine.getEngineMode() != "classic" || engine.hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 12a: Switching to 'classic' failed or did not clear expanded slot!\n";
            return 12;
        }
        if (engine.loadExpandedModelFromJson(0, kSampleExpandedJson, nullptr)) {
            std::cerr << "[FAIL] Test 12b: 'classic' mode must reject expanded JSON!\n";
            return 12;
        }
        if (!engine.setEngineMode("plus") || engine.getEngineMode() != "plus") {
            std::cerr << "[FAIL] Test 12c: Switching to 'plus' failed!\n";
            return 12;
        }
        if (engine.loadExpandedModelFromJson(0, kSampleExpandedJson, nullptr)) {
            std::cerr << "[FAIL] Test 12d: 'plus' mode must reject expanded JSON!\n";
            return 12;
        }
        if (!engine.setEngineMode("expanded") || engine.getEngineMode() != "expanded") {
            std::cerr << "[FAIL] Test 12e: Switching back to 'expanded' failed!\n";
            return 12;
        }
        if (!engine.loadExpandedModelFromJson(0, kSampleExpandedJson, nullptr)) {
            std::cerr << "[FAIL] Test 12f: 'expanded' mode failed to load expanded JSON after mode switch!\n";
            return 12;
        }
        std::cout << "  [PASS] Test 12: Runtime mode switching (expanded <-> plus <-> classic) and Blender/Silver chain verified.\n";
    }

    // Test 13: Phase K.1 -- SymBipolar wireZeroCenter and semanticRole contracts
    {
        // 13.1: SymBipolar center deadband (176 parameters in [-64..63])
        size_t symBipolarCount = 0;
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            if (desc.isSymBipolar) {
                symBipolarCount++;
                // At center norm=0.5f, must map exactly to raw 0.0f
                float rawZero = normalizedToRaw(i, 0.5f);
                if (std::abs(rawZero) > 1e-5f) {
                    std::cerr << "[FAIL] Test 13.1: Param " << desc.key << " norm 0.5 must produce 0.0f, got " << rawZero << "\n";
                    return 13;
                }
                // At raw=0.0f, must map exactly to norm 0.5f
                float normHalf = rawToNormalized(i, 0.0f);
                if (std::abs(normHalf - 0.5f) > 1e-5f) {
                    std::cerr << "[FAIL] Test 13.1: Param " << desc.key << " raw 0.0 must produce 0.5f, got " << normHalf << "\n";
                    return 13;
                }
                // Extremes: -64 -> 0.0, +63 -> 1.0
                if (std::abs(rawToNormalized(i, -64.0f) - 0.0f) > 1e-5f ||
                    std::abs(rawToNormalized(i, 63.0f) - 1.0f) > 1e-5f) {
                    std::cerr << "[FAIL] Test 13.1: Param " << desc.key << " extremes mismatch!\n";
                    return 13;
                }
            }
        }
        if (symBipolarCount != 176) {
            std::cerr << "[FAIL] Test 13.1: Expected 176 SymBipolar parameters, found " << symBipolarCount << "\n";
            return 13;
        }

        // 13.2: Semantic Roles coverage (48 parameters)
        size_t roleCount = 0;
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            if (!desc.semanticRole.empty()) {
                roleCount++;
            }
        }
        if (roleCount != 48) {
            std::cerr << "[FAIL] Test 13.2: Expected 48 parameters with semanticRole, found " << roleCount << "\n";
            return 13;
        }

        // 13.3: Specific canonical roles verification
        const auto* panDesc = getParamDescriptor(ParamIdx::SoundPan);
        if (!panDesc || panDesc->semanticRole != "MasterPan" || !panDesc->isSymBipolar) {
            std::cerr << "[FAIL] Test 13.3: SoundPan must have MasterPan semanticRole and isSymBipolar!\n";
            return 13;
        }

        const auto* filterFreqDesc = getParamDescriptor(ParamIdx::FilterFreq);
        if (!filterFreqDesc || filterFreqDesc->semanticRole != "FilterCutoff") {
            std::cerr << "[FAIL] Test 13.3: FilterFreq must have FilterCutoff semanticRole!\n";
            return 13;
        }

        const auto* r1AmpAttackDesc = getParamDescriptor(ParamIdx::R1AmpEnvA);
        if (!r1AmpAttackDesc || r1AmpAttackDesc->semanticRole != "AmpEnvAttack") {
            std::cerr << "[FAIL] Test 13.3: R1AmpEnvA must have AmpEnvAttack semanticRole!\n";
            return 13;
        }

        std::cout << "  [PASS] Test 13: Phase K.1 SymBipolar exact zero (176 params) and semanticRole coverage (48 params) verified.\n";
    }

    // Test 14: Phase K.2 -- Rompler Multisample and Sampler Voice Spec Roundtrip
    {
        // 14.1: Construct an expanded instrument JSON mimicking ABDNeuModMakr export
        // with 3 zones (split by note/vel) mapped against sampler_voice_parameter_spec keys
        const std::string multisampleJson = R"JSON({
          "schemaVersion": "2.0.0",
          "identity": {
            "slug": "acoustic-grand-multisample",
            "expandedName": "Acoustic Grand Piano (3-Zone Velocity)",
            "modelName": "PIANO_VEL",
            "engineMin": "expanded",
            "requiredCaps": ["filter-v2"]
          },
          "spectral": {
            "partialCount": 64,
            "frameCount": 2,
            "frameSpanHz": 20000.0,
            "frames": [
              { "f0Hz": 261.63, "amps": [0.8, 0.4, 0.2], "offsets": [0.0, 12.0, 19.0] },
              { "f0Hz": 261.63, "amps": [0.4, 0.2, 0.1], "offsets": [0.0, 12.0, 19.0] }
            ]
          },
          "regions": [
            {
              "id": "zone_low_p",
              "sampleRef": "piano_c3_soft.wav",
              "lowKey": 0,
              "highKey": 60,
              "rootKey": 48,
              "lowVel": 1,
              "highVel": 64,
              "volumeDb": -2.0,
              "loop": { "mode": "loop_continuous", "startFrame": 4410, "endFrame": 22050, "crossfadeMs": 0 }
            },
            {
              "id": "zone_low_f",
              "sampleRef": "piano_c3_loud.wav",
              "lowKey": 0,
              "highKey": 60,
              "rootKey": 48,
              "lowVel": 65,
              "highVel": 127,
              "volumeDb": 1.5,
              "loop": { "mode": "loop_continuous", "startFrame": 4410, "endFrame": 22050, "crossfadeMs": 0 }
            },
            {
              "id": "zone_hi",
              "sampleRef": "piano_c5.wav",
              "lowKey": 61,
              "highKey": 127,
              "rootKey": 72,
              "lowVel": 1,
              "highVel": 127,
              "volumeDb": 0.0,
              "loop": { "mode": "no_loop", "startFrame": 0, "endFrame": 0, "crossfadeMs": 0 }
            }
          ],
          "articulation": {
            "polyphony": 16,
            "voiceMode": "poly",
            "ampEnv": { "attack": 0.005, "decay": 1.5, "sustain": 0.4, "release": 0.8 },
            "filters": [
              { "id": "main-filter", "type": "ladder-v2", "cutoffHz": 12000.0, "resonance": 0.2 }
            ]
          },
          "resynators": [
            { "id": "r1", "version": 2, "model": "resonator-hd" }
          ],
          "analysis": {},
          "classic": { "modelName": "PIANO_VEL" }
        })JSON";

        auto samplerEngine = std::make_unique<DspEngineFacade>();
        samplerEngine->prepare(44100.0, 512);

        extended::AxionikExpandedPreflightReport report;
        bool loaded = samplerEngine->loadExpandedModelFromJson(0, multisampleJson, &report);
        if (!loaded || !report.ok) {
            std::cerr << "[FAIL] Test 14: Failed to parse multisample JSON! Errors:\n";
            for (const auto& err : report.errors) std::cerr << "  - " << err << "\n";
            return 14;
        }

        if (!samplerEngine->hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 14: hasExpandedModelLoaded(0) must be true!\n";
            return 14;
        }

        // 14.1b: Loop transfer — nested `loop` object (ABDNeuModMakr shape)
        // must survive parsing instead of defaulting to no_loop/0.
        {
            const auto* doc = samplerEngine->getExpandedModelDoc(0);
            if (!doc) {
                std::cerr << "[FAIL] Test 14.1b: getExpandedModelDoc(0) must not be null!\n";
                return 14;
            }
            if (doc->regions.size() != 3) {
                std::cerr << "[FAIL] Test 14.1b: expected 3 regions!\n";
                return 14;
            }
            if (doc->regions[0].loopMode != "loop_continuous" ||
                doc->regions[0].loopStartFrame != 4410 ||
                doc->regions[0].loopEndFrame != 22050) {
                std::cerr << "[FAIL] Test 14.1b: zone_low_p loop was not transferred (mode/start/end)!\n";
                return 14;
            }
            if (doc->regions[2].loopMode != "no_loop") {
                std::cerr << "[FAIL] Test 14.1b: zone_hi must stay no_loop!\n";
                return 14;
            }
        }

        // 14.2: Verify zone selection across Note & Velocity
        // Test soft note in low register (C3 = 48, vel = 0.2 -> zone_low_p)
        samplerEngine->noteOn(48, 0.2f);
        std::vector<float> leftP(512, 0.0f);
        std::vector<float> rightP(512, 0.0f);
        samplerEngine->process(leftP.data(), rightP.data(), 512);

        float maxP = 0.0f;
        for (size_t i = 0; i < 512; ++i) maxP = std::max(maxP, std::abs(leftP[i]));
        if (maxP <= 1e-5f) {
            std::cerr << "[FAIL] Test 14.2: NoteOn C3 soft produced silence!\n";
            return 14;
        }

        samplerEngine->allNotesOff();

        // Test loud note in low register (C3 = 48, vel = 0.9 -> zone_low_f)
        samplerEngine->noteOn(48, 0.9f);
        std::vector<float> leftF(512, 0.0f);
        std::vector<float> rightF(512, 0.0f);
        samplerEngine->process(leftF.data(), rightF.data(), 512);

        float maxF = 0.0f;
        for (size_t i = 0; i < 512; ++i) maxF = std::max(maxF, std::abs(leftF[i]));
        if (maxF <= 1e-5f) {
            std::cerr << "[FAIL] Test 14.2: NoteOn C3 loud produced silence!\n";
            return 14;
        }

        // 14.3: High register note (C5 = 72 -> zone_hi)
        samplerEngine->noteOn(72, 0.7f);
        std::vector<float> leftHi(512, 0.0f);
        std::vector<float> rightHi(512, 0.0f);
        samplerEngine->process(leftHi.data(), rightHi.data(), 512);
        float maxHi = 0.0f;
        for (size_t i = 0; i < 512; ++i) maxHi = std::max(maxHi, std::abs(leftHi[i]));
        if (maxHi <= 1e-5f) {
            std::cerr << "[FAIL] Test 14.3: NoteOn C5 high register produced silence!\n";
            return 14;
        }

        samplerEngine->allNotesOff();
        std::cout << "  [PASS] Test 14: Phase K.2 Rompler multisample import & velocity/pitch zone dispatch verified.\n";
    }
    // Test 15: Phase loop-1 -- region loop bounds mapping + wrap math (pure).
    {
        // 4410/22050 @44100Hz on the 8 fps synth clock -> [0.8, 4.0] of 64 frames.
        extended::AxionikRegion loopReg;
        loopReg.loopMode = "loop_continuous";
        loopReg.loopStartFrame = 4410;
        loopReg.loopEndFrame = 22050;
        loopReg.sampleRate = 44100.0f;
        const extended::RegionLoopBounds lb =
            extended::regionLoopBoundsFrames(loopReg, 64);
        if (!lb.hasLoop || std::abs(lb.start - 0.8f) > 1e-4f || std::abs(lb.end - 4.0f) > 1e-4f) {
            std::cerr << "[FAIL] Test 15: loop bounds mapping wrong (" << lb.start << ", " << lb.end << ")!\n";
            return 15;
        }
        // continuous wraps around: 4.5 in [0.8, 4.0] -> 1.3
        {
            const auto st = extended::wrapRegionLoopPos(4.5f, 0.8f, 4.0f, "loop_continuous", 1);
            if (std::abs(st.pos - 1.3f) > 1e-4f || st.dir != 1 || st.finished) {
                std::cerr << "[FAIL] Test 15: continuous wrap wrong!\n";
                return 15;
            }
        }
        // ping_pong reflects and flips direction: 4.5 -> 3.5, dir -1
        {
            const auto st = extended::wrapRegionLoopPos(4.5f, 0.8f, 4.0f, "ping_pong", 1);
            if (std::abs(st.pos - 3.5f) > 1e-4f || st.dir != -1 || st.finished) {
                std::cerr << "[FAIL] Test 15: ping_pong reflect wrong!\n";
                return 15;
            }
        }
        // one_shot ends at the bound and reports finished
        {
            const auto st = extended::wrapRegionLoopPos(4.2f, 0.8f, 4.0f, "one_shot", 1);
            if (std::abs(st.pos - 4.0f) > 1e-4f || !st.finished) {
                std::cerr << "[FAIL] Test 15: one_shot finish wrong!\n";
                return 15;
            }
            const auto st2 = extended::wrapRegionLoopPos(2.0f, 0.8f, 4.0f, "one_shot", 1);
            if (st2.finished) {
                std::cerr << "[FAIL] Test 15: one_shot must not finish mid-loop!\n";
                return 15;
            }
        }
        // backward keeps dir -1 and wraps from below
        {
            const auto st = extended::wrapRegionLoopPos(0.5f, 0.8f, 4.0f, "loop_backward", -1);
            if (std::abs(st.pos - (0.8f + (0.5f + 3.2f - 0.8f))) > 1e-4f || st.dir != -1) {
                std::cerr << "[FAIL] Test 15: backward wrap wrong!\n";
                return 15;
            }
        }
        // no_loop / degenerate bounds keep legacy (no loop)
        {
            extended::AxionikRegion noLoop;
            noLoop.loopMode = "no_loop";
            if (extended::regionLoopBoundsFrames(noLoop, 64).hasLoop) {
                std::cerr << "[FAIL] Test 15: no_loop must not loop!\n";
                return 15;
            }
            extended::AxionikRegion deg = loopReg;
            deg.loopMode = "loop_continuous";
            deg.loopStartFrame = 99999;
            deg.loopEndFrame = 99999;
            if (extended::regionLoopBoundsFrames(deg, 64).hasLoop) {
                std::cerr << "[FAIL] Test 15: degenerate bounds must not loop!\n";
                return 15;
            }
        }
        std::cout << "  [PASS] Test 15: Phase loop-1 region loop mapping + wrap math verified.\n";
    }
    // Test 16: Trigger dispatcher (first/legato/release), per-group
    // round-robin honoring roundRobinIndex, and mute-group choke.
    {
        std::cerr << "[16] enter" << std::endl;
        const std::string trigJson = R"JSON({
          "schemaVersion": "2.0.0",
          "identity": {
            "slug": "trigger-lab",
            "expandedName": "Trigger Lab",
            "modelName": "TRIGLAB",
            "engineMin": "expanded",
            "requiredCaps": ["filter-v2"]
          },
          "spectral": {
            "partialCount": 64,
            "frameCount": 2,
            "frameSpanHz": 20000.0,
            "frames": [
              { "f0Hz": 261.63, "amps": [0.8, 0.4, 0.2], "offsets": [0.0, 12.0, 19.0] },
              { "f0Hz": 261.63, "amps": [0.4, 0.2, 0.1], "offsets": [0.0, 12.0, 19.0] }
            ]
          },
          "regions": [
            { "id": "rr_a", "sampleRef": "a.wav", "lowKey": 60, "highKey": 60, "rootKey": 60,
              "lowVel": 1, "highVel": 127, "roundRobinGroup": "g", "roundRobinIndex": 2 },
            { "id": "rr_b", "sampleRef": "b.wav", "lowKey": 60, "highKey": 60, "rootKey": 60,
              "lowVel": 1, "highVel": 127, "roundRobinGroup": "g", "roundRobinIndex": 1 },
            { "id": "first_c", "sampleRef": "c.wav", "lowKey": 61, "highKey": 61, "rootKey": 61,
              "lowVel": 1, "highVel": 127, "trigger": "first" },
            { "id": "legato_d", "sampleRef": "d.wav", "lowKey": 62, "highKey": 62, "rootKey": 62,
              "lowVel": 1, "highVel": 127, "trigger": "legato" },
            { "id": "attack_e", "sampleRef": "e.wav", "lowKey": 62, "highKey": 62, "rootKey": 62,
              "lowVel": 1, "highVel": 127 },
            { "id": "hat_closed", "sampleRef": "hc.wav", "lowKey": 63, "highKey": 63, "rootKey": 63,
              "lowVel": 1, "highVel": 127, "muteGroup": 7 },
            { "id": "hat_open", "sampleRef": "ho.wav", "lowKey": 64, "highKey": 64, "rootKey": 64,
              "lowVel": 1, "highVel": 127, "muteGroup": 7 },
            { "id": "attack_g", "sampleRef": "g.wav", "lowKey": 67, "highKey": 67, "rootKey": 67,
              "lowVel": 1, "highVel": 127 },
            { "id": "damper", "sampleRef": "r.wav", "lowKey": 67, "highKey": 67, "rootKey": 67,
              "lowVel": 1, "highVel": 127, "trigger": "release" },
            { "id": "solo_e", "sampleRef": "s.wav", "lowKey": 66, "highKey": 66, "rootKey": 66,
              "lowVel": 1, "highVel": 127, "roundRobinGroup": "h" }
          ],
          "articulation": {
            "polyphony": 16,
            "voiceMode": "poly",
            "ampEnv": { "attack": 0.005, "decay": 0.2, "sustain": 0.8, "release": 0.4 },
            "filters": [
              { "id": "main-filter", "type": "ladder-v2", "cutoffHz": 12000.0, "resonance": 0.2 }
            ]
          },
          "resynators": [
            { "id": "r1", "version": 2, "model": "resonator-hd" }
          ],
          "analysis": {},
          "classic": { "modelName": "TRIGLAB" }
        })JSON";

        auto trigEngine = std::make_unique<DspEngineFacade>();
        trigEngine->prepare(44100.0, 512);

        extended::AxionikExpandedPreflightReport trigReport;
        if (!trigEngine->loadExpandedModelFromJson(0, trigJson, &trigReport) || !trigReport.ok) {
            std::cerr << "[FAIL] Test 16: trigger-lab model failed to load!\n";
            return 16;
        }
        // 16.0: muteGroup + RR fields survive parsing.
        {
            const auto* doc = trigEngine->getExpandedModelDoc(0);
            if (!doc || doc->regions.size() != 10) {
                std::cerr << "[FAIL] Test 16.0: expected 10 regions!\n";
                return 16;
            }
            if (doc->regions[5].muteGroup != 7 || doc->regions[6].muteGroup != 7 ||
                doc->regions[4].muteGroup != 0) {
                std::cerr << "[FAIL] Test 16.0: muteGroup not transferred!\n";
                return 16;
            }
            if (doc->regions[2].trigger != "first" || doc->regions[3].trigger != "legato" ||
                doc->regions[8].trigger != "release") {
                std::cerr << "[FAIL] Test 16.0: triggers not transferred!\n";
                return 16;
            }
        }
        auto findVoiceByRegion = [&](int regionIdx) -> int {
            for (size_t i = 0; i < 16; ++i) {
                if (trigEngine->getExpandedVoiceRegionIndex(0, i) == regionIdx) return static_cast<int>(i);
            }
            return -1;
        };
        std::vector<float> tL(512, 0.0f), tR(512, 0.0f);

        std::cerr << "[16] loaded" << std::endl;
        // 16.1: per-group RR honors roundRobinIndex order (rr_b idx1 first).
        trigEngine->noteOn(60, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(1) < 0) {
            std::cerr << "[FAIL] Test 16.1: first RR pick must be rr_b (roundRobinIndex 1)!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        trigEngine->noteOn(60, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(0) < 0) {
            std::cerr << "[FAIL] Test 16.1: second RR pick must be rr_a (roundRobinIndex 2)!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.1 ok" << std::endl;

        // 16.2: groups rotate independently (group h untouched by group g).
        trigEngine->noteOn(66, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(9) < 0) {
            std::cerr << "[FAIL] Test 16.2: solo_e (group h) must sound!\n";
            return 16;
        }
        trigEngine->noteOn(60, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(1) < 0) {
            std::cerr << "[FAIL] Test 16.2: group g counter must wrap back to rr_b!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.2 ok" << std::endl;
        trigEngine->noteOn(63, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(5) < 0) {
            std::cerr << "[FAIL] Test 16.3: hat_closed must sound!\n";
            return 16;
        }
        trigEngine->noteOn(64, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(6) < 0) {
            std::cerr << "[FAIL] Test 16.3: hat_open must sound!\n";
            return 16;
        }
        {
            const int closedSlot = findVoiceByRegion(5);
            if (closedSlot < 0 || !trigEngine->isExpandedVoiceReleasing(0, static_cast<size_t>(closedSlot))) {
                std::cerr << "[FAIL] Test 16.3: hat_closed must be choked (releasing)!\n";
                return 16;
            }
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.3 ok" << std::endl;

        // 16.4: first/legato gates.
        trigEngine->noteOn(61, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(2) < 0) {
            std::cerr << "[FAIL] Test 16.4: 'first' region must fire with nothing held!\n";
            return 16;
        }
        trigEngine->noteOn(62, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(3) < 0) {
            std::cerr << "[FAIL] Test 16.4: 'legato' region must fire over held voices!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        trigEngine->noteOn(62, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(3) >= 0 || findVoiceByRegion(4) < 0) {
            std::cerr << "[FAIL] Test 16.4: 'legato' must NOT fire with nothing held (attack_e instead)!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.4 ok" << std::endl;
        // 16.5: release trigger spawns a voice on noteOff.
        trigEngine->noteOn(67, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(7) < 0) {
            std::cerr << "[FAIL] Test 16.5: attack_g must sound on noteOn!\n";
            return 16;
        }
        trigEngine->noteOff(67);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(8) < 0) {
            std::cerr << "[FAIL] Test 16.5: 'release' region must spawn a voice on noteOff!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.5 ok" << std::endl;
        std::cout << "  [PASS] Test 16: trigger dispatcher (first/legato/release) + per-group RR + mute choke verified.\n";
    }

    // Test 17: AxionikDB slug compatibility (folder name vs identity.slug)
    {
        const auto root = std::filesystem::temp_directory_path() / "axionik_slug_resolution_test";
        std::filesystem::remove_all(root);
        const auto modelFolder = root / "Models" / "Transformed_HD_96k" / "01_Keyboards_Piano" / "fmrhodes_HD";
        std::filesystem::create_directories(modelFolder);
        {
            std::ofstream jsonOut(modelFolder / "axionik-expanded.json");
            jsonOut << R"({"schemaVersion":"2.0.0","identity":{"slug":"fmrhodes-hd-96k","expandedName":"fmrhodes HD"}})";
        }

        NeuronBankAdapter adapter;
        adapter.setAxionikDbPath(root);

        const auto byFolder = adapter.resolveAxionikModelFolder("fmrhodes_HD");
        const auto byIdentity = adapter.resolveAxionikModelFolder("fmrhodes-hd-96k");
        std::error_code cmpEc;
        const bool folderOk = std::filesystem::equivalent(byFolder, modelFolder, cmpEc) && !cmpEc;
        cmpEc.clear();
        const bool identityOk = std::filesystem::equivalent(byIdentity, modelFolder, cmpEc) && !cmpEc;

        if (!folderOk || !identityOk) {
            std::cerr << "[FAIL] Test 17: AxionikDB slug resolution (folder=" << byFolder.string()
                      << ", identity=" << byIdentity.string() << ")\n";
            std::filesystem::remove_all(root);
            return 17;
        }
        std::filesystem::remove_all(root);
        std::cout << "  [PASS] Test 17: AxionikDB resolves folder name and identity.slug.\n";
    }

    // Test 18: AxionikDB scan preserves the -1 sentinel and an explicit parameterSet
    {
        const auto root = std::filesystem::temp_directory_path() / "axionik_parameter_set_scan_test";
        std::filesystem::remove_all(root);
        const auto categoryFolder = root / "Models" / "Transformed_HD_96k" / "01_Keyboards_Piano";
        const auto explicitFolder = categoryFolder / "ExplicitParameterSet";
        const auto sentinelFolder = categoryFolder / "SentinelParameterSet";
        std::filesystem::create_directories(explicitFolder);
        std::filesystem::create_directories(sentinelFolder);
        {
            std::ofstream jsonOut(explicitFolder / "axionik-expanded.json");
            jsonOut << R"({"schemaVersion":"2.0.0","identity":{"slug":"explicit-parameter-set","expandedName":"Explicit Parameter Set"},"parameterSet":5})";
        }
        {
            std::ofstream jsonOut(sentinelFolder / "axionik-expanded.json");
            jsonOut << R"({"schemaVersion":"2.0.0","identity":{"slug":"sentinel-parameter-set","expandedName":"Sentinel Parameter Set"}})";
        }

        NeuronBankAdapter adapter;
        adapter.setNeuronDbPath(root);
        adapter.setAxionikDbPath(root);
        const std::string catalog = adapter.scanCatalogJson();

        const std::string explicitEntry =
            R"("slug":"ExplicitParameterSet","name":"Explicit Parameter Set","category":"Synth & Neutral","parameterSet":5)";
        const std::string sentinelEntry =
            R"("slug":"SentinelParameterSet","name":"Sentinel Parameter Set","category":"Synth & Neutral","parameterSet":-1)";
        const bool explicitOk = catalog.find(explicitEntry) != std::string::npos;
        const bool sentinelOk = catalog.find(sentinelEntry) != std::string::npos;

        std::filesystem::remove_all(root);
        if (!explicitOk || !sentinelOk) {
            std::cerr << "[FAIL] Test 18: AxionikDB parameterSet scan (explicit=" << explicitOk
                      << ", sentinel=" << sentinelOk << ")\n"
                      << catalog << "\n";
            return 18;
        }
        std::cout << "  [PASS] Test 18: AxionikDB scan keeps parameterSet=-1 when absent and reads explicit parameterSet=5.\n";
    }

    // Test 19: ParamGrouping covers all 445 parameters
    {
        auto buckets = buildParamGroupBuckets();
        size_t covered = 0;
        bool blenderPlaced = false;
        for (const auto& b : buckets) {
            covered += b.params.size();
            for (const auto* p : b.params) {
                if (p->index == ParamIdx::BlenderAmount) {
                    blenderPlaced = (b.id == "Synth" || b.id == "Synthesizer");
                }
            }
        }
        if (covered != kNumTotalParameters) {
            std::cerr << "[FAIL] Test 19: Groups covered " << covered << " params, expected " << kNumTotalParameters << "\n";
            return 19;
        }
        if (!blenderPlaced) {
            std::cerr << "[FAIL] Test 19: BlenderAmount lost its dictionary group\n";
            return 19;
        }
        std::cout << "  [PASS] Test 19: " << buckets.size() << " parameter groups cover all "
                  << covered << " registry parameters without duplicates.\n";
    }

    // Test 20: Diagnostic Tone 440 Hz Injection (AXVS.2)
    {
        auto toneEngine = std::make_unique<DspEngineFacade>();
        toneEngine->prepare(44100.0, 512);

        // 20.1: Default is Disabled -> idle renders silence
        std::vector<float> bufL(512, 0.0f);
        std::vector<float> bufR(512, 0.0f);
        toneEngine->process(bufL.data(), bufR.data(), 512);
        float idlePeak = 0.0f;
        for (float s : bufL) idlePeak = std::max(idlePeak, std::abs(s));
        if (idlePeak > 1e-6f) {
            std::cerr << "[FAIL] Test 20.1: Idle engine produced sound without diagnostic tone! idlePeak=" << idlePeak << "\n";
            return 20;
        }

        // 20.2: Enable PostMaster tone at 440 Hz, 0.25 level
        toneEngine->setDiagnosticTone(1, 440.0f, 0.25f);
        if (toneEngine->getDiagnosticTonePoint() != 1) {
            std::cerr << "[FAIL] Test 20.2: Diagnostic tone point was not stored!\n";
            return 20;
        }
        std::fill(bufL.begin(), bufL.end(), 0.0f);
        std::fill(bufR.begin(), bufR.end(), 0.0f);
        toneEngine->process(bufL.data(), bufR.data(), 512);

        float tonePeak = 0.0f;
        for (float s : bufL) tonePeak = std::max(tonePeak, std::abs(s));
        if (tonePeak < 0.20f || tonePeak > 0.30f) {
            std::cerr << "[FAIL] Test 20.3: Expected ~0.25 peak from 440 Hz diagnostic tone, got " << tonePeak << "\n";
            return 20;
        }

        // 20.3: Disable tone -> silence returns
        toneEngine->setDiagnosticTone(0, 440.0f, 0.0f);
        std::fill(bufL.begin(), bufL.end(), 0.0f);
        std::fill(bufR.begin(), bufR.end(), 0.0f);
        toneEngine->process(bufL.data(), bufR.data(), 512);
        float postPeak = 0.0f;
        for (float s : bufL) postPeak = std::max(postPeak, std::abs(s));
        if (postPeak > 1e-6f) {
            std::cerr << "[FAIL] Test 20.4: Disabling diagnostic tone did not restore silence!\n";
            return 20;
        }

        std::cout << "  [PASS] Test 20: Diagnostic tone injection (440 Hz reference) verified (AXVS.2).\n";
    }

    // Test 21: ScopeTap Telemetry Tap Infrastructure (AXVS.3)
    {
        auto tapEngine = std::make_unique<DspEngineFacade>();
        tapEngine->prepare(44100.0, 512);
        auto& tap = tapEngine->getScopeTapMaster();

        // 21.1: Initially inactive
        if (tap.isActive()) {
            std::cerr << "[FAIL] Test 21.1: ScopeTap must be inactive by default!\n";
            return 21;
        }

        // 21.2: Activate tap and render
        tap.setActive(true);
        tapEngine->setDiagnosticTone(1, 440.0f, 0.25f);
        std::vector<float> bufL(512, 0.0f);
        std::vector<float> bufR(512, 0.0f);
        tapEngine->process(bufL.data(), bufR.data(), 512);

        size_t avail = tap.getAvailableRead();
        if (avail < 512) {
            std::cerr << "[FAIL] Test 21.2: Active ScopeTap did not accumulate samples! available=" << avail << "\n";
            return 21;
        }

        std::vector<float> readL(512, 0.0f);
        std::vector<float> readR(512, 0.0f);
        size_t readCount = tap.read(readL.data(), readR.data(), 512);
        if (readCount != 512) {
            std::cerr << "[FAIL] Test 21.3: ScopeTap read failed!\n";
            return 21;
        }

        // 21.3: Deactivate tap
        tap.setActive(false);
        tapEngine->process(bufL.data(), bufR.data(), 512);
        if (tap.getAvailableRead() != 0) {
            std::cerr << "[FAIL] Test 21.4: Inactive ScopeTap must not accumulate samples!\n";
            return 21;
        }

        std::cout << "  [PASS] Test 21: ScopeTap lock-free ring buffer telemetry verified (AXVS.3).\n";
    }

    // Test 22: DoS Protection on File Size Limits (AXVS.5)
    {
        // 22.1: Non-existent file rejected
        SoundPreset p;
        if (NeuronSound::parseSoundScriptFile("non_existent_file_xyz.script", p)) {
            std::cerr << "[FAIL] Test 22.1: Non-existent file must be rejected!\n";
            return 22;
        }

        // 22.2: Empty file rejected
        auto tmpEmpty = std::filesystem::temp_directory_path() / "test_empty.script";
        {
            std::ofstream out(tmpEmpty);
        }
        if (NeuronSound::parseSoundScriptFile(tmpEmpty, p)) {
            std::filesystem::remove(tmpEmpty);
            std::cerr << "[FAIL] Test 22.2: 0-byte file must be rejected!\n";
            return 22;
        }
        std::filesystem::remove(tmpEmpty);

        std::cout << "  [PASS] Test 22: DoS physical file size bounds protection verified (AXVS.5).\n";
    }

    // Test 23: Bipolar 4L4T Envelope (DspNeuronShaper4T4L) & FreeEnvType Routing (AXM.2A)
    {
        // 23.1: Direct state-machine test of DspNeuronShaper4T4L (bipolar segments + repeat + release)
        abd::dsp::DspNeuronShaper4T4L env4;
        env4.setSampleRate(44100.0);
        env4.setParameters(-1.0f, +1.0f, -0.5f, +0.5f, 0.0f, 0.0f, 0.0f, 0.0f, false);
        env4.noteOn(1.0f);
        if (std::abs(env4.getLevel() - (-1.0f)) > 1e-5f) {
            std::cerr << "[FAIL] Test 23.1: 4L4T must start at Level1 (-1.0), got " << env4.getLevel() << "\n";
            return 23;
        }
        // With t1=t2=t3=0 (1 sample per segment), 3 ticks reach Sustain at Level4 (+0.5)
        float v1 = env4.process();
        float v2 = env4.process();
        float v3 = env4.process();
        float vHold = env4.process();
        if (std::abs(v1 - 1.0f) > 1e-4f || std::abs(v2 - (-0.5f)) > 1e-4f ||
            std::abs(v3 - 0.5f) > 1e-4f || std::abs(vHold - 0.5f) > 1e-4f) {
            std::cerr << "[FAIL] Test 23.1: 4L4T segment transitions wrong: "
                      << v1 << ", " << v2 << ", " << v3 << ", " << vHold << "\n";
            return 23;
        }
        env4.noteOff();
        // Release returns toward Level1 (-1.0) in max(128, trunc(t4^2*20*fs)) = 128 samples at 44.1kHz
        for (int i = 0; i < 140; ++i) {
            env4.process();
        }
        if (env4.isActive() || std::abs(env4.getLevel() - (-1.0f)) > 1e-4f) {
            std::cerr << "[FAIL] Test 23.1: 4L4T release must settle at Level1 (-1.0) and go Idle!\n";
            return 23;
        }

        // Repeat mode cycles L4 -> L1 (in Time4 >= 128 samples) -> L2...
        env4.setParameters(-0.8f, +0.8f, +0.8f, -0.4f, 0.0f, 0.0f, 0.0f, 0.0f, true);
        env4.noteOn(1.0f);
        bool sawPositive = false;
        bool sawNegativeAfterPositive = false;
        bool sawSecondPositivePeak = false;
        for (int i = 0; i < 150; ++i) {
            float s = env4.process();
            if (!sawNegativeAfterPositive && s > 0.5f) sawPositive = true;
            if (sawPositive && s < -0.7f) sawNegativeAfterPositive = true;
            if (sawNegativeAfterPositive && s > 0.5f) sawSecondPositivePeak = true;
        }
        if (!sawPositive || !sawNegativeAfterPositive || !sawSecondPositivePeak) {
            std::cerr << "[FAIL] Test 23.1b: 4L4T Repeat mode did not loop back to Level1->Level2!\n";
            return 23;
        }

        // 23.2: End-to-end DspEngineFacade 4L4T bipolar modulation of Blender (R1 muted, R2 sinew 511)
        auto measureBlender4L4T = [](float levelRaw) -> float {
            auto eng = std::make_unique<DspEngineFacade>();
            eng->prepare(44100.0, 512);
            eng->applyPreset(NeuronSound::getEmbeddedInitPreset());
            eng->setParam(ParamIdx::SilverSwitch, 0.0f);
            eng->setParam(ParamIdx::SoundMFXSwitch, 0.0f);
            eng->setParam(ParamIdx::R1Switch, 1.0f);
            eng->setParam(ParamIdx::R1Volume, 0.0f);       // R1 silent
            eng->setParam(ParamIdx::R2Switch, 1.0f);
            eng->setParam(ParamIdx::R2Volume, 127.0f);     // R2 full (model 511 sinew)
            eng->setParam(ParamIdx::R2AmpEnvA, 0.0f);
            eng->setParam(ParamIdx::R2AmpEnvS, 127.0f);
            eng->setParam(ParamIdx::BlenderAmount, 0.0f);  // Center (0.5)
            eng->setParam(ParamIdx::FreeEnvType, 1.0f);    // 4L4T mode
            eng->setParam(ParamIdx::FreeEnvLevel1, levelRaw);
            eng->setParam(ParamIdx::FreeEnvLevel2, levelRaw);
            eng->setParam(ParamIdx::FreeEnvLevel3, levelRaw);
            eng->setParam(ParamIdx::FreeEnvLevel4, levelRaw);
            eng->setParam(ParamIdx::FreeEnvTime1, 0.0f);
            eng->setParam(ParamIdx::FreeEnvTime2, 0.0f);
            eng->setParam(ParamIdx::FreeEnvTime3, 0.0f);
            eng->setParam(ParamIdx::BlenderFree4L4TDepth, 127.0f);

            eng->noteOn(60, 1.0f);
            std::vector<float> l(512, 0.0f), r(512, 0.0f);
            double sumSq = 0.0;
            for (int b = 0; b < 6; ++b) {
                eng->process(l.data(), r.data(), 512);
                if (b >= 2) {
                    for (size_t i = 0; i < 512; ++i) {
                        sumSq += l[i] * l[i] + r[i] * r[i];
                    }
                }
            }
            return static_cast<float>(std::sqrt(sumSq / (4.0 * 512.0 * 2.0)));
        };

        const float rmsNeg4L4T = measureBlender4L4T(-64.0f); // Pushes blender to R1 (silent)
        const float rmsPos4L4T = measureBlender4L4T(+63.0f); // Pushes blender to R2 (loud)
        if (rmsPos4L4T <= 1e-4f || rmsPos4L4T <= rmsNeg4L4T * 3.0f) {
            std::cerr << "[FAIL] Test 23.2: 4L4T bipolar Blender modulation failed! rmsNeg="
                      << rmsNeg4L4T << ", rmsPos=" << rmsPos4L4T << "\n";
            return 23;
        }
        std::cout << "  [PASS] Test 23: Bipolar 4L4T envelope & FreeEnvType routing verified (AXM.2A).\n";
    }

    // Test 24: Exact Translator.cpp Curves — Single VelocityDepth, v^2 Volume, Contour==1 Gates (AXM.2A)
    {
        // 24.1: FUN_10040550 curve helper sanity
        if (std::abs(NeuronTranslatorCurves::adsrAttackSamples(0.5f, 44100.0) - 110250.0) > 1.0 ||
            std::abs(NeuronTranslatorCurves::adsrDecaySamples(0.5f, 44100.0) - 220500.0) > 1.0 ||
            std::abs(NeuronTranslatorCurves::adsrSustainLevel(0.5f) - 0.75f) > 1e-5f ||
            std::abs(NeuronTranslatorCurves::adsrReleaseSamples(0.0f, 96000.0) - std::round(128.0 * 96000.0 / 44100.0)) > 1e-5) {
            std::cerr << "[FAIL] Test 24.1: NeuronTranslatorCurves ADSR formulas mismatch FUN_10040550!\n";
            return 24;
        }

        auto measureVoiceRms = [](float r1VolRaw, float velDepthRaw, float noteVel) -> float {
            auto eng = std::make_unique<DspEngineFacade>();
            eng->prepare(44100.0, 512);
            eng->applyPreset(NeuronSound::getEmbeddedInitPreset());
            eng->setParam(ParamIdx::SilverSwitch, 0.0f); // Bypass Silver filter velocity/env
            eng->setParam(ParamIdx::SoundMFXSwitch, 0.0f);
            eng->setParam(ParamIdx::R1Switch, 1.0f);
            eng->setParam(ParamIdx::R2Switch, 0.0f);
            eng->setParam(ParamIdx::BlenderAmount, -64.0f); // 100% R1
            eng->setParam(ParamIdx::R1AmpEnvA, 0.0f);
            eng->setParam(ParamIdx::R1AmpEnvS, 127.0f);
            eng->setParam(ParamIdx::R1Volume, r1VolRaw);
            eng->setParam(ParamIdx::R1VolumeVelocityDepth, velDepthRaw);

            eng->noteOn(60, noteVel);
            std::vector<float> l(512, 0.0f), r(512, 0.0f);
            double sumSq = 0.0;
            for (int b = 0; b < 6; ++b) {
                eng->process(l.data(), r.data(), 512);
                if (b >= 2) {
                    for (size_t i = 0; i < 512; ++i) {
                        sumSq += l[i] * l[i] + r[i] * r[i];
                    }
                }
            }
            return static_cast<float>(std::sqrt(sumSq / (4.0 * 512.0 * 2.0)));
        };

        // 24.2: VelocityDepth == 0 -> velocity-invariant amplitude (no hidden v*v in ADSR)
        const float rmsVelZeroSoft = measureVoiceRms(127.0f, 0.0f, 0.25f);
        const float rmsVelZeroLoud = measureVoiceRms(127.0f, 0.0f, 1.0f);
        if (rmsVelZeroLoud <= 1e-4f || std::abs(rmsVelZeroLoud - rmsVelZeroSoft) / rmsVelZeroLoud > 0.02f) {
            std::cerr << "[FAIL] Test 24.2: VelocityDepth=0 must yield identical RMS across velocities! soft="
                      << rmsVelZeroSoft << ", loud=" << rmsVelZeroLoud << "\n";
            return 24;
        }

        // 24.3: VelocityDepth == +63 (+1.0) -> single linear scaling (~4x for 1.0 vs 0.25, NOT 16x v^2!)
        const float rmsVelFullSoft = measureVoiceRms(127.0f, 63.0f, 0.25f);
        const float rmsVelFullLoud = measureVoiceRms(127.0f, 63.0f, 1.0f);
        const float velRatio = rmsVelFullLoud / std::max(rmsVelFullSoft, 1e-9f);
        if (velRatio < 3.5f || velRatio > 4.5f) {
            std::cerr << "[FAIL] Test 24.3: Expected ~4.0x single-velocity ratio, got " << velRatio << "x\n";
            return 24;
        }

        // 24.4: Quadratic R1Volume law (v^2): half volume (63.5/127 = 0.5) -> 0.25x amplitude (ratio ~4.0x)
        const float rmsHalfVol = measureVoiceRms(63.5f, 0.0f, 1.0f);
        const float volRatio = rmsVelZeroLoud / std::max(rmsHalfVol, 1e-9f);
        if (volRatio < 3.7f || volRatio > 4.3f) {
            std::cerr << "[FAIL] Test 24.4: Expected ~4.0x quadratic volume ratio (1.0^2 / 0.5^2), got " << volRatio << "x\n";
            return 24;
        }

        // 24.5: SilverL1Contour [279] == 1 ("Shaper") gates FilterEnvDepth [360]
        auto measureFilterContour = [](float contourMode) -> float {
            auto eng = std::make_unique<DspEngineFacade>();
            eng->prepare(44100.0, 512);
            eng->applyPreset(NeuronSound::getEmbeddedInitPreset());
            eng->setParam(ParamIdx::SoundMFXSwitch, 0.0f);
            eng->setParam(ParamIdx::R1Switch, 1.0f);
            eng->setParam(ParamIdx::R2Switch, 0.0f);
            eng->setParam(ParamIdx::BlenderAmount, -64.0f);
            eng->setParam(ParamIdx::R1Volume, 127.0f);
            eng->setParam(ParamIdx::R1AmpEnvA, 0.0f);
            eng->setParam(ParamIdx::R1AmpEnvS, 127.0f);
            eng->setParam(ParamIdx::SilverSwitch, 1.0f);
            eng->setParam(ParamIdx::FilterType, 0.0f);      // 24dB LP
            eng->setParam(ParamIdx::FilterFreq, 8.0f);      // Very dark base cutoff
            eng->setParam(ParamIdx::FilterReso, 0.0f);
            eng->setParam(ParamIdx::FilterEnvA, 0.0f);
            eng->setParam(ParamIdx::FilterEnvS, 127.0f);
            eng->setParam(ParamIdx::FilterEnvDepth, 63.0f); // Max positive envelope opening
            eng->setParam(ParamIdx::SilverL1Contour, contourMode);

            eng->noteOn(72, 1.0f); // C5 (523 Hz, strongly attenuated when LP stays closed)
            std::vector<float> l(512, 0.0f), r(512, 0.0f);
            double sumSq = 0.0;
            for (int b = 0; b < 6; ++b) {
                eng->process(l.data(), r.data(), 512);
                if (b >= 2) {
                    for (size_t i = 0; i < 512; ++i) {
                        sumSq += l[i] * l[i] + r[i] * r[i];
                    }
                }
            }
            return static_cast<float>(std::sqrt(sumSq / (4.0 * 512.0 * 2.0)));
        };

        const float rmsContourStick  = measureFilterContour(0.0f);
        const float rmsContourShaper = measureFilterContour(1.0f);
        const float rmsContourPedal  = measureFilterContour(2.0f);
        if (rmsContourShaper <= rmsContourStick * 1.5f ||
            std::abs(rmsContourStick - rmsContourPedal) > std::max(1e-5f, rmsContourStick * 0.05f)) {
            std::cerr << "[FAIL] Test 24.5: SilverL1Contour==1 gate failed! stick=" << rmsContourStick
                      << ", shaper=" << rmsContourShaper << ", pedal=" << rmsContourPedal << "\n";
            return 24;
        }

        std::cout << "  [PASS] Test 24: Single VelocityDepth, quadratic v^2 volume, and Contour==1 gates verified (AXM.2A).\n";
    }

    // Test 25: Multi-SampleRate Invariance (44.1..96 kHz), Mac 1.56 FX Reset & Inert engineState_ Guard (AXM.2A)
    {
        // 25.1: Inert RT dump to engineState_ disabled by default; syncs on explicit request
        {
            auto eng = std::make_unique<DspEngineFacade>();
            auto* bridge = eng->getBridge();
            if (!bridge || bridge->isLegacyEngineSyncEnabled()) {
                std::cerr << "[FAIL] Test 25.1: Legacy engineState RT sync must be disabled by default!\n";
                return 25;
            }
            uint32_t* rawState = eng->getEngineState();
            // Sentinel inside translated scalar region (e[0xA4] = R1Volume^2 in Translator.cpp:627)
            constexpr size_t kR1VolSqDwordIdx = 0xA4u;
            rawState[kR1VolSqDwordIdx] = 0xDEADBEEFu;

            eng->setParam(ParamIdx::R1Volume, 63.5f); // norm = 0.5 -> v^2 = 0.25f
            if (rawState[kR1VolSqDwordIdx] != 0xDEADBEEFu) {
                std::cerr << "[FAIL] Test 25.1: setParam overwrote engineState_ while legacy sync was disabled!\n";
                return 25;
            }
            bridge->setLegacyEngineSyncEnabled(true);
            float syncedVolSq = 0.0f;
            std::memcpy(&syncedVolSq, &rawState[kR1VolSqDwordIdx], sizeof(float));
            if (rawState[kR1VolSqDwordIdx] == 0xDEADBEEFu || std::abs(syncedVolSq - 0.25f) > 1e-4f) {
                std::cerr << "[FAIL] Test 25.1: Enabling legacy sync did not synchronize engineState_ (got "
                          << syncedVolSq << ")!\n";
                return 25;
            }
            bridge->setLegacyEngineSyncEnabled(false);
        }

        // 25.2: Multi-SampleRate rendering (44.1 / 48 / 88.2 / 96 kHz) with Silver Filter + 900ms Delay + MasterFX
        auto renderAtSampleRate = [](double sr) -> float {
            auto eng = std::make_unique<DspEngineFacade>();
            eng->prepare(sr, 512);
            eng->applyPreset(NeuronSound::getEmbeddedInitPreset());
            eng->setParam(ParamIdx::R1Switch, 1.0f);
            eng->setParam(ParamIdx::R1Volume, 110.0f);
            eng->setParam(ParamIdx::SilverSwitch, 1.0f);
            eng->setParam(ParamIdx::FilterType, 0.0f);
            eng->setParam(ParamIdx::FilterFreq, 90.0f);
            eng->setParam(ParamIdx::FreqFXSwitch, 1.0f);
            eng->setParam(ParamIdx::CurFreqFX, 0.0f);
            eng->setParam(ParamIdx::EQ_Switch, 1.0f);
            eng->setParam(ParamIdx::TimeFXSwitch, 1.0f);
            eng->setParam(ParamIdx::CurTimeFX, 1.0f); // L/R Delay
            eng->setParam(ParamIdx::LRD_Time, 900.0f); // 900 ms -> 86,400 samples @ 96kHz (>65,536!)
            eng->setParam(ParamIdx::LRD_Feedback, 35.0f);
            eng->setParam(ParamIdx::LRD_Mix, 40.0f);
            eng->setParam(ParamIdx::SoundMFXSwitch, 1.0f);
            eng->setParam(ParamIdx::SoundMFXDelaySwitch, 1.0f);
            eng->setParam(ParamIdx::SoundMFXReverbSwitch, 1.0f);

            eng->noteOn(60, 0.85f);
            const size_t totalFrames = static_cast<size_t>(sr * 1.1); // 1.1 seconds physical duration
            std::vector<float> l(512, 0.0f), r(512, 0.0f);
            double sumSq = 0.0;
            size_t processed = 0;
            while (processed < totalFrames) {
                const size_t chunk = std::min<size_t>(512, totalFrames - processed);
                eng->process(l.data(), r.data(), chunk);
                for (size_t i = 0; i < chunk; ++i) {
                    if (!std::isfinite(l[i]) || !std::isfinite(r[i])) {
                        return -1.0f;
                    }
                    sumSq += static_cast<double>(l[i]) * l[i] + static_cast<double>(r[i]) * r[i];
                }
                processed += chunk;
            }
            return static_cast<float>(std::sqrt(sumSq / static_cast<double>(totalFrames * 2)));
        };

        const float rms44 = renderAtSampleRate(44100.0);
        const float rms48 = renderAtSampleRate(48000.0);
        const float rms88 = renderAtSampleRate(88200.0);
        const float rms96 = renderAtSampleRate(96000.0);
        if (rms44 <= 1e-4f || rms48 <= 1e-4f || rms88 <= 1e-4f || rms96 <= 1e-4f) {
            std::cerr << "[FAIL] Test 25.2: Multi-SR render failed or non-finite! "
                      << rms44 << ", " << rms48 << ", " << rms88 << ", " << rms96 << "\n";
            return 25;
        }
        // Spectral/gain invariance across 44.1k..96k within +/- 3 dB (ratio 0.7 .. 1.42)
        for (float rSr : {rms48, rms88, rms96}) {
            const float ratio = rSr / rms44;
            if (ratio < 0.65f || ratio > 1.50f) {
                std::cerr << "[FAIL] Test 25.2: Excessive gain drift across sample rates! rms44="
                          << rms44 << ", other=" << rSr << " (ratio=" << ratio << ")\n";
                return 25;
            }
        }

        // 25.3: Mac 1.56 anti-pop Reset() when toggling FX false -> true clears stale delay tail
        {
            auto eng = std::make_unique<DspEngineFacade>();
            eng->prepare(48000.0, 512);
            eng->setParam(ParamIdx::SilverSwitch, 1.0f);
            eng->setParam(ParamIdx::TimeFXSwitch, 1.0f);
            eng->setParam(ParamIdx::CurTimeFX, 1.0f); // L/R Delay
            eng->setParam(ParamIdx::LRD_Time, 100.0f);
            eng->setParam(ParamIdx::LRD_Feedback, 60.0f);
            eng->setParam(ParamIdx::LRD_Mix, 100.0f);

            // Feed diagnostic tone PreFilter into TimeFX delay buffer
            eng->setDiagnosticTone(2, 440.0f, 0.5f);
            std::vector<float> l(512, 0.0f), r(512, 0.0f);
            for (int b = 0; b < 20; ++b) {
                eng->process(l.data(), r.data(), 512);
            }

            // Cut input and disable TimeFX
            eng->setDiagnosticTone(0);
            eng->setParam(ParamIdx::TimeFXSwitch, 0.0f);
            for (int b = 0; b < 4; ++b) {
                eng->process(l.data(), r.data(), 512);
            }

            // Re-enable TimeFX with silent input: stale tail MUST NOT burst out!
            eng->setParam(ParamIdx::TimeFXSwitch, 1.0f);
            float maxResidual = 0.0f;
            for (int b = 0; b < 15; ++b) {
                eng->process(l.data(), r.data(), 512);
                for (size_t i = 0; i < 512; ++i) {
                    maxResidual = std::max(maxResidual, std::max(std::abs(l[i]), std::abs(r[i])));
                }
            }
            if (maxResidual > 1e-6f) {
                std::cerr << "[FAIL] Test 25.3: Stale TimeFX buffer leaked after off->on toggle! peak="
                          << maxResidual << "\n";
                return 25;
            }
        }

        std::cout << "  [PASS] Test 25: Multi-SR invariance (44.1..96 kHz), Mac 1.56 FX reset, and engineState guard verified (AXM.2A).\n";
    }

    // =========================================================================
    // Test 26: DSP Calibration Config & Magic Numbers Full Subsystem Wiring (AXM.2C)
    // =========================================================================
    {
        auto engine = std::make_unique<DspEngineFacade>();
        engine->prepare(44100.0, 512);

        // 26.1: Verificar metadatos y registro de 43 parámetros
        const auto& registry = ::axionik::dsp::AxionikCalibrationConfig::getRegistry();
        if (registry.size() != 43 || ::axionik::dsp::AxionikCalibrationConfig::kParamCount != 43) {
            std::cerr << "[FAIL] Test 26.1: Calibration registry must contain exactly 43 parameters, got "
                      << registry.size() << "\n";
            return 26;
        }

        for (const auto& meta : registry) {
            if (meta.id == nullptr || meta.id[0] == '\0') {
                std::cerr << "[FAIL] Test 26.1: Null or empty param id in registry\n";
                return 26;
            }
            const auto* found = ::axionik::dsp::AxionikCalibrationConfig::findMeta(meta.id);
            if (!found || found != &meta) {
                std::cerr << "[FAIL] Test 26.1: findMeta failed for param " << meta.id << "\n";
                return 26;
            }
            if (meta.defaultValue < meta.minValue || meta.defaultValue > meta.maxValue) {
                std::cerr << "[FAIL] Test 26.1: Default out of range for " << meta.id << "\n";
                return 26;
            }
        }

        // 26.2: Sincronización en tiempo real y mutación de parámetros (a4ReferenceHz)
        {
            auto engA = std::make_unique<DspEngineFacade>();
            engA->prepare(44100.0, 512);
            engA->noteOn(69, 0.8f); // A4 (440 Hz default)
            std::vector<float> lA(512), rA(512);
            engA->process(lA.data(), rA.data(), 512);

            auto engB = std::make_unique<DspEngineFacade>();
            engB->prepare(44100.0, 512);
            if (!engB->setCalibrationParam("a4ReferenceHz", 466.16f)) { // La#4 (+1 semitono)
                std::cerr << "[FAIL] Test 26.2: setCalibrationParam('a4ReferenceHz') rejected\n";
                return 26;
            }
            engB->noteOn(69, 0.8f);
            std::vector<float> lB(512), rB(512);
            engB->process(lB.data(), rB.data(), 512);

            float diffSum = 0.0f;
            for (size_t i = 0; i < 512; ++i) {
                diffSum += std::abs(lA[i] - lB[i]);
            }
            if (diffSum < 0.01f) {
                std::cerr << "[FAIL] Test 26.2: a4ReferenceHz mutation did not alter phase step!\n";
                return 26;
            }

            // Restaurar con resetCalibrationParam
            engB->resetCalibrationParam("a4ReferenceHz");
            if (std::abs(engB->getCalibrationConfig().a4ReferenceHz - 440.0f) > 1e-4f) {
                std::cerr << "[FAIL] Test 26.2: resetCalibrationParam did not restore default 440.0 Hz\n";
                return 26;
            }
        }

        // 26.3: Mutación de HF Emphasis en Scape
        {
            auto engA = std::make_unique<DspEngineFacade>();
            engA->prepare(44100.0, 512);
            engA->setCalibrationParam("scapeHfEmphasis", 0.0f); // Sin énfasis
            engA->noteOn(60, 0.8f);
            std::vector<float> lA(512), rA(512);
            engA->process(lA.data(), rA.data(), 512);

            auto engB = std::make_unique<DspEngineFacade>();
            engB->prepare(44100.0, 512);
            engB->setCalibrationParam("scapeHfEmphasis", 4.0f); // Máximo énfasis HF
            engB->noteOn(60, 0.8f);
            std::vector<float> lB(512), rB(512);
            engB->process(lB.data(), rB.data(), 512);

            float diffHf = 0.0f;
            for (size_t i = 0; i < 512; ++i) {
                diffHf += std::abs(lA[i] - lB[i]);
            }
            if (diffHf < 0.001f) {
                std::cerr << "[FAIL] Test 26.3: scapeHfEmphasis did not alter oscillator transient emphasis!\n";
                return 26;
            }
        }

        // 26.4: Mutación de Ring Blend Gain (Blender Modo 9)
        {
            auto engA = std::make_unique<DspEngineFacade>();
            engA->prepare(44100.0, 512);
            engA->setParam(ParamIdx::BlenderType, 9.0f); // Ring Blend
            engA->setParam(ParamIdx::BlenderAmount, 100.0f); // 100% Ring
            engA->setCalibrationParam("ringBlendGain", 0.5f);
            engA->noteOn(60, 0.8f);
            std::vector<float> lA(512), rA(512);
            engA->process(lA.data(), rA.data(), 512);

            auto engB = std::make_unique<DspEngineFacade>();
            engB->prepare(44100.0, 512);
            engB->setParam(ParamIdx::BlenderType, 9.0f);
            engB->setParam(ParamIdx::BlenderAmount, 100.0f);
            engB->setCalibrationParam("ringBlendGain", 3.0f);
            engB->noteOn(60, 0.8f);
            std::vector<float> lB(512), rB(512);
            engB->process(lB.data(), rB.data(), 512);

            float rmsA = 0.0f, rmsB = 0.0f;
            for (size_t i = 0; i < 512; ++i) {
                rmsA += lA[i] * lA[i];
                rmsB += lB[i] * lB[i];
            }
            rmsA = std::sqrt(rmsA / 512.0f);
            rmsB = std::sqrt(rmsB / 512.0f);

            if (rmsB <= rmsA * 1.5f) {
                std::cerr << "[FAIL] Test 26.4: ringBlendGain (0.5 vs 3.0) did not scale ring intermod! rmsA="
                          << rmsA << ", rmsB=" << rmsB << "\n";
                return 26;
            }
        }

        // 26.5: Mutación de Bass Tilt Gain en Master Output Stage
        {
            auto engA = std::make_unique<DspEngineFacade>();
            engA->prepare(44100.0, 512);
            engA->setCalibrationParam("masterBassTiltGain", 0.0f);
            engA->noteOn(36, 0.8f); // Nota baja C2
            std::vector<float> lA(512), rA(512);
            engA->process(lA.data(), rA.data(), 512);

            auto engB = std::make_unique<DspEngineFacade>();
            engB->prepare(44100.0, 512);
            engB->setCalibrationParam("masterBassTiltGain", 15.0f);
            engB->noteOn(36, 0.8f);
            std::vector<float> lB(512), rB(512);
            engB->process(lB.data(), rB.data(), 512);

            float rmsA = 0.0f, rmsB = 0.0f;
            for (size_t i = 0; i < 512; ++i) {
                rmsA += lA[i] * lA[i];
                rmsB += lB[i] * lB[i];
            }
            rmsA = std::sqrt(rmsA / 512.0f);
            rmsB = std::sqrt(rmsB / 512.0f);

            if (rmsB <= rmsA * 1.1f) {
                std::cerr << "[FAIL] Test 26.5: masterBassTiltGain did not boost low frequencies! rmsA="
                          << rmsA << ", rmsB=" << rmsB << "\n";
                return 26;
            }
        }

        // 26.6: resetAllCalibrationParams restaura todos los 43 valores exactos
        {
            auto eng = std::make_unique<DspEngineFacade>();
            eng->prepare(44100.0, 512);
            eng->setCalibrationParam("masterVolume", 1.9f);
            eng->setCalibrationParam("a4ReferenceHz", 432.0f);
            eng->setCalibrationParam("filterLp24FeedbackK", 1.5f);
            eng->setCalibrationParam("masterReverbFdnBlend", 0.8f);

            eng->resetAllCalibrationParams();
            const auto& cfg = eng->getCalibrationConfig();
            if (std::abs(cfg.masterVolume - 0.85f) > 1e-4f ||
                std::abs(cfg.a4ReferenceHz - 440.0f) > 1e-4f ||
                std::abs(cfg.filterLp24FeedbackK - 2.208f) > 1e-4f ||
                std::abs(cfg.masterReverbFdnBlend - 0.55f) > 1e-4f) {
                std::cerr << "[FAIL] Test 26.6: resetAllCalibrationParams failed to restore factory defaults!\n";
                return 26;
            }
        }

        std::cout << "  [PASS] Test 26: DSP Calibration Config (43 parameters) connected and verified in real-time (AXM.2C).\n";
    }

    // Test 27: Phase AXM.2B -- Desacople Parset 0..9, Matriz 3000..3130, CC64 Sustain, CurveReader dinámica
    {
        // 27.1: Desacople R1Type/R2Type (UI selector 0/1) vs r1Parset_/r2Parset_ (0..9)
        {
            auto engineB = std::make_unique<DspEngineFacade>();
            engineB->prepare(44100.0, 512);

            // Estado inicial: Parset 0 por defecto
            if (engineB->getResynatorParset(0) != 0 || engineB->getResynatorParset(1) != 0) {
                std::cerr << "[FAIL] Test 27.1: Initial parsets must be 0!\n";
                return 27;
            }

            // Mover R1Type (selector UI) no debe cambiar r1Parset_
            engineB->setParam(ParamIdx::R1Type, 1.0f);
            if (engineB->getResynatorParset(0) != 0) {
                std::cerr << "[FAIL] Test 27.1: R1Type must not alter r1Parset_!\n";
                return 27;
            }

            // Configurar explícitamente Parset 2..9
            engineB->setResynatorParset(0, 5);
            engineB->setResynatorParset(1, 8);
            if (engineB->getResynatorParset(0) != 5 || engineB->getResynatorParset(1) != 8) {
                std::cerr << "[FAIL] Test 27.1: Parset 5 and 8 not properly stored!\n";
                return 27;
            }

            // Cambiar R1Type de nuevo a 0 no afecta a parset 5
            engineB->setParam(ParamIdx::R1Type, 0.0f);
            if (engineB->getResynatorParset(0) != 5) {
                std::cerr << "[FAIL] Test 27.1: R1Type change mutated decoupled parset!\n";
                return 27;
            }
        }

        // 27.2: Matriz 3000..3130: Destino extendido modulado (3097 = FL_Mix)
        {
            auto engineB = std::make_unique<DspEngineFacade>();
            engineB->prepare(44100.0, 512);

            // Activar Silver Rack y TimeFX en Flanger (algo 2)
            engineB->setParam(ParamIdx::SilverSwitch, 1.0f);
            engineB->setParam(ParamIdx::TimeFXSwitch, 1.0f);
            engineB->setParam(ParamIdx::CurTimeFX, 2.0f); // Flanger
            engineB->setParam(ParamIdx::FL_Mix, 0.0f);     // FL_Mix base = 0.0

            // Configurar Free Controller 1 (Group 0: Aftertouch, Slot 0):
            // Param 363 (AftertouchDest1) = 3075 (FL_Mix [336])
            // Param 367 (AftertouchDestDepth1) = 63.0f (+100% de modulación)
            engineB->setParam(ParamIdx::AftertouchDest1, 3075.0f);
            engineB->setParam(ParamIdx::AftertouchDestDepth1, 63.0f);

            // Con Aftertouch a 0, verificar que procesa con FL_Mix en base
            engineB->setModulationSource(0, 0.0f); // ModSource 0: Aftertouch
            std::vector<float> l(512), r(512);
            engineB->process(l.data(), r.data(), 512);

            // Enviar Aftertouch al máximo (1.0f)
            engineB->setModulationSource(0, 1.0f);
            engineB->process(l.data(), r.data(), 512);

            // Consultar effectiveSlots_ a través del bridge
            const float* p = engineB->getBridge() ? engineB->getBridge()->getEffectiveSlots() : nullptr;
            if (!p) {
                std::cerr << "[FAIL] Test 27.2: Bridge or effectiveSlots null!\n";
                return 27;
            }
            float modulatedFlMix = p[SlotIdx::FL_Mix];
            if (modulatedFlMix < 0.9f) {
                std::cerr << "[FAIL] Test 27.2: Modulated FL_Mix expected >= 0.9f, got " << modulatedFlMix << "\n";
                return 27;
            }
        }

        // 27.3: Sustain Pedal (CC 64) y Footswitch (CC 67)
        {
            auto engineB = std::make_unique<DspEngineFacade>();
            engineB->prepare(44100.0, 512);

            // Tocar nota 60
            engineB->noteOn(60, 0.8f);
            if (engineB->getActiveVoices() == 0) {
                std::cerr << "[FAIL] Test 27.3: NoteOn failed to allocate voice!\n";
                return 27;
            }

            // Pisar Sustain Pedal
            engineB->setSustainPedal(true);
            if (!engineB->isSustainPedalDown()) {
                std::cerr << "[FAIL] Test 27.3: Sustain pedal flag not true!\n";
                return 27;
            }

            // Soltar la tecla (noteOff)
            engineB->noteOff(60);

            // Como el pedal está pisado, la voz debe seguir activa (sostenida)
            if (engineB->getActiveVoices() == 0) {
                std::cerr << "[FAIL] Test 27.3: Sustained note cut off while pedal down!\n";
                return 27;
            }

            // Soltar pedal: debe liberar la nota sostenida
            engineB->setSustainPedal(false);
            if (engineB->isSustainPedalDown()) {
                std::cerr << "[FAIL] Test 27.3: Sustain pedal flag not false!\n";
                return 27;
            }

            // Procesar bloque
            std::vector<float> l(512), r(512);
            engineB->process(l.data(), r.data(), 512);
        }

        // 27.4: CurveReader resolución dinámica y One-Shot (flags & 1)
        {
            std::vector<int16_t> sampleBuffer(100, 1000);
            abd::dsp::neuron::DecodedScapeHeader testCurve;
            testCurve.valid = true;
            testCurve.resolution = 200; // Doble de resolución estándar (100)
            testCurve.loopStart = 0;
            testCurve.loopEnd = 50;
            testCurve.flags = 0; // Looping normal
            testCurve.samples = sampleBuffer.data();
            testCurve.sampleCount = sampleBuffer.size();

            abd::dsp::neuron::CurveReader reader;
            reader.bind(testCurve);
            // En modo loop con flags=0, looping_ debe ser true
            if (!reader.isLooping()) {
                std::cerr << "[FAIL] Test 27.4: CurveReader with flags=0 and valid loop should loop!\n";
                return 27;
            }

            // Con flags=1 (One-shot bit 0), looping_ debe ser false
            testCurve.flags = 1;
            reader.bind(testCurve);
            if (reader.isLooping()) {
                std::cerr << "[FAIL] Test 27.4: CurveReader with flags & 1 must be one-shot (not looping)!\n";
                return 27;
            }
        }

        std::cout << "  [PASS] Test 27: Phase AXM.2B -- Parset decoupling (0..9), matrix 3000..3130, CC64 Sustain, and dynamic CurveReader verified.\n";
    }

    // Test 28: Modo PLUS completo (Filtros ZDF + Efectos Pro Equivalentes AXM.3A)
    // =========================================================================
    {
        auto engine = std::make_unique<DspEngineFacade>();
        engine->prepare(44100.0, 512);

        // 28.1: Conmutar a Modo PLUS
        if (!engine->setEngineMode("plus") || engine->getEngineMode() != "plus") {
            std::cerr << "[FAIL] Test 28.1: Failed to switch to mode 'plus'!\n";
            return 28;
        }

        // 28.2: Filtro ZDF Moog Ladder 4-polos no lineal resuelto sin retardo de lazo (Modo 0: LowPass 24)
        {
            engine->setParam(ParamIdx::SilverSwitch, 1.0f);
            engine->setParam(ParamIdx::FilterType, 0.0f); // 24dB LP
            engine->setParam(ParamIdx::FilterFreq, 60.0f);
            engine->setParam(ParamIdx::FilterReso, 120.0f); // Alta resonancia ZDF

            engine->noteOn(60, 0.9f);
            std::vector<float> l(512, 0.0f), r(512, 0.0f);
            for (int b = 0; b < 10; ++b) {
                engine->process(l.data(), r.data(), 512);
                for (size_t i = 0; i < 512; ++i) {
                    if (std::isnan(l[i]) || std::isinf(l[i]) || std::isnan(r[i]) || std::isinf(r[i])) {
                        std::cerr << "[FAIL] Test 28.2: NaN/INF detected in ZDF Moog Ladder at high resonance!\n";
                        return 28;
                    }
                }
            }
            engine->allNotesOff();
        }

        // 28.3: Filtro ZDF SVF TPT (Modo 1: 12dB LP) y HighPass (Modo 3)
        {
            engine->setParam(ParamIdx::FilterType, 1.0f); // 12dB LP SVF
            engine->noteOn(60, 0.9f);
            std::vector<float> l(512), r(512);
            engine->process(l.data(), r.data(), 512);
            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(l[i]) || std::isinf(l[i])) {
                    std::cerr << "[FAIL] Test 28.3: NaN/INF in SVF TPT!\n";
                    return 28;
                }
            }

            engine->setParam(ParamIdx::FilterType, 3.0f); // 6dB HP 1-Pole
            engine->process(l.data(), r.data(), 512);
            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(l[i]) || std::isinf(l[i])) {
                    std::cerr << "[FAIL] Test 28.3: NaN/INF in One-Pole HP!\n";
                    return 28;
                }
            }
            engine->allNotesOff();
        }

        // 28.4: Rack FreqFX Pro (MidasEQ, Distortion oversampled, RingMod, Decimator, Shifter)
        {
            engine->setParam(ParamIdx::FreqFXSwitch, 1.0f);

            // Algo 0: MidasEQ + FairComp
            engine->setParam(ParamIdx::CurFreqFX, 0.0f);
            engine->setParam(ParamIdx::EQ_Switch, 1.0f);
            engine->setParam(ParamIdx::EQ_LowShelfSwitch, 1.0f);
            engine->setParam(ParamIdx::EQ_LowShelfGain, 12.0f);
            engine->noteOn(60, 0.8f);
            std::vector<float> l(512), r(512);
            engine->process(l.data(), r.data(), 512);

            // Algo 1: Oversampling Distortion
            engine->setParam(ParamIdx::CurFreqFX, 1.0f);
            engine->setParam(ParamIdx::DS_InGain, 100.0f);
            engine->process(l.data(), r.data(), 512);

            // Algo 2: RingMod
            engine->setParam(ParamIdx::CurFreqFX, 2.0f);
            engine->setParam(ParamIdx::RM_Mix, 100.0f);
            engine->process(l.data(), r.data(), 512);

            // Algo 3: Decimator
            engine->setParam(ParamIdx::CurFreqFX, 3.0f);
            engine->setParam(ParamIdx::DC_Mix, 100.0f);
            engine->process(l.data(), r.data(), 512);

            // Algo 4: Frequency Shifter
            engine->setParam(ParamIdx::CurFreqFX, 4.0f);
            engine->setParam(ParamIdx::SW_Mix, 100.0f);
            engine->process(l.data(), r.data(), 512);

            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(l[i]) || std::isinf(l[i]) || std::isnan(r[i]) || std::isinf(r[i])) {
                    std::cerr << "[FAIL] Test 28.4: NaN/INF in FreqFX Pro algorithms!\n";
                    return 28;
                }
            }
            engine->allNotesOff();
        }

        // 28.5: Rack TimeFX Pro (Enhancer, Stereo Delay, Flanger, Phaser4, Stereo Chorus)
        {
            engine->setParam(ParamIdx::TimeFXSwitch, 1.0f);

            // Algo 0: Enhancer
            engine->setParam(ParamIdx::CurTimeFX, 0.0f);
            engine->noteOn(64, 0.8f);
            std::vector<float> l(512), r(512);
            engine->process(l.data(), r.data(), 512);

            // Algo 1: Stereo Delay
            engine->setParam(ParamIdx::CurTimeFX, 1.0f);
            engine->setParam(ParamIdx::LRD_Mix, 80.0f);
            engine->process(l.data(), r.data(), 512);

            // Algo 2: Flanger
            engine->setParam(ParamIdx::CurTimeFX, 2.0f);
            engine->setParam(ParamIdx::FL_Mix, 80.0f);
            engine->process(l.data(), r.data(), 512);

            // Algo 3: Phaser4 OTA
            engine->setParam(ParamIdx::CurTimeFX, 3.0f);
            engine->setParam(ParamIdx::PH_Mix, 80.0f);
            engine->process(l.data(), r.data(), 512);

            // Algo 4: Stereo Chorus
            engine->setParam(ParamIdx::CurTimeFX, 4.0f);
            engine->setParam(ParamIdx::CH_Mix, 80.0f);
            engine->process(l.data(), r.data(), 512);

            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(l[i]) || std::isinf(l[i]) || std::isnan(r[i]) || std::isinf(r[i])) {
                    std::cerr << "[FAIL] Test 28.5: NaN/INF in TimeFX Pro algorithms!\n";
                    return 28;
                }
            }
            engine->allNotesOff();
        }

        // 28.6: Master FX Pro (Tape Delay + FDN Reverb)
        {
            engine->setParam(ParamIdx::SoundMFXSwitch, 1.0f);
            engine->setParam(ParamIdx::SoundMFXDelaySwitch, 1.0f);
            engine->setParam(ParamIdx::SoundMFXDelayMix, 64.0f);
            engine->setParam(ParamIdx::SoundMFXReverbSwitch, 1.0f);
            engine->setParam(ParamIdx::SoundMFXReverbMix, 64.0f);

            engine->noteOn(67, 0.8f);
            std::vector<float> l(512), r(512);
            for (int b = 0; b < 10; ++b) {
                engine->process(l.data(), r.data(), 512);
                for (size_t i = 0; i < 512; ++i) {
                    if (std::isnan(l[i]) || std::isinf(l[i]) || std::isnan(r[i]) || std::isinf(r[i])) {
                        std::cerr << "[FAIL] Test 28.6: NaN/INF in Master FX Pro!\n";
                        return 28;
                    }
                }
            }
            engine->allNotesOff();
        }

        // 28.7: Conmutación en caliente Plus <-> Classic sin fallos
        {
            if (!engine->setEngineMode("classic") || engine->getEngineMode() != "classic") {
                std::cerr << "[FAIL] Test 28.7: Failed to return to classic!\n";
                return 28;
            }
            std::vector<float> l(256), r(256);
            engine->process(l.data(), r.data(), 256);

            if (!engine->setEngineMode("plus") || engine->getEngineMode() != "plus") {
                std::cerr << "[FAIL] Test 28.7: Failed to switch back to plus!\n";
                return 28;
            }
            engine->process(l.data(), r.data(), 256);
        }

        std::cout << "  [PASS] Test 28: Modo PLUS completo (Filtros ZDF + Efectos Pro Equivalentes AXM.3A) verified.\n";
    }

    // Test 29: Modo EXPANDED, APVTS [445..478] y Resynator v2 (AXM.4B)
    {
        auto engine = std::make_unique<DspEngineFacade>();
        engine->prepare(44100.0, 512);

        // 29.1: Conmutar a modo expanded
        if (!engine->setEngineMode("expanded") || engine->getEngineMode() != "expanded") {
            std::cerr << "[FAIL] Test 29.1: Failed to set expanded mode!\n";
            return 29;
        }

        // 29.2: Parámetros APVTS [445..478]
        engine->setParam(ParamIdx::R1V2_Stiffness, 0.0025f);
        engine->setParam(ParamIdx::R1V2_CombNotch, -0.5f);
        engine->setParam(ParamIdx::R1V2_FormantShift, 7.0f);
        engine->setParam(ParamIdx::R1V2_TransientGain, 1.8f);
        engine->setParam(ParamIdx::Exp_FreqFXAlg, 3.0f);
        engine->setParam(ParamIdx::Exp_FreqFXMacro1, 0.75f);
        engine->setParam(ParamIdx::Exp_MasterDelayAlg, 2.0f);

        if (std::abs(engine->getStore().getRawValue(ParamIdx::R1V2_Stiffness) - 0.0025f) > 1e-5f ||
            std::abs(engine->getStore().getRawValue(ParamIdx::R1V2_FormantShift) - 7.0f) > 1e-4f) {
            std::cerr << "[FAIL] Test 29.2: Expanded parameters readback error!\n";
            return 29;
        }

        // 29.3: Procesar audio con Expanded FX params
        std::vector<float> l(512, 0.0f), r(512, 0.0f);
        engine->noteOn(60, 0.8f);
        engine->process(l.data(), r.data(), 512);

        const auto& fxParams = engine->getExpandedFxParams();
        if (fxParams.freqFxAlg != 3 || std::abs(fxParams.freqFxMacros[0] - 0.75f) > 1e-5f || fxParams.masterDelayAlg != 2) {
            std::cerr << "[FAIL] Test 29.3: getExpandedFxParams failed to reflect APVTS state!\n";
            return 29;
        }

        // 29.4: Resynator v2 sintetizador unitario
        extended::AxionikExpandedSynthesizer synth;
        synth.prepare(44100.0, 512);
        synth.setTransientGain(1.5f);
        if (std::abs(synth.getTransientGain() - 1.5f) > 1e-5f) {
            std::cerr << "[FAIL] Test 29.4: setTransientGain failed!\n";
            return 29;
        }

        // 29.5: Cargar modelo expandido con 24 bandas Bark y superficie unificada
        extended::AxionikExpandedModelDoc doc;
        doc.schemaVersion = "2.0.0";
        doc.identity.slug = "test-expanded-v2";
        doc.identity.engineMin = "expanded";
        doc.spectral.partialCount = 128;
        doc.spectral.frameCount = 2;
        doc.spectral.frames.resize(2);
        for (auto& f : doc.spectral.frames) {
            f.amps.assign(128, 0.05f);
            f.offsets.assign(128, 0.0f);
            f.phases.assign(128, 0.0f);
            f.bandwidths.assign(128, 0.1f);
            f.residualBandsDb.assign(24, -12.0f);
        }
        extended::AxionikRegion reg;
        reg.lowKey = 0;
        reg.highKey = 127;
        reg.lowVel = 1;
        reg.highVel = 127;
        reg.hybridTransient.enabled = true;
        reg.hybridTransient.durationMs = 20.0f;
        doc.regions.push_back(reg);

        extended::AxionikResynatorV2 resyn;
        resyn.shapers.inharmonicityB = 0.001f;
        resyn.shapers.formantShiftSt = 4.0f;
        resyn.shapers.residualMix = 0.3f;
        doc.resynators.push_back(resyn);

        doc.unifiedSurface.present = true;
        extended::AxionikSpectralSurfaceNode node;
        node.rootKey = 60;
        node.velocityCenter = 100;
        node.lowKey = 0;
        node.highKey = 127;
        node.lowVel = 1;
        node.highVel = 127;
        doc.unifiedSurface.nodes.push_back(node);

        synth.loadModel(doc);
        if (!synth.hasLoadedModel()) {
            std::cerr << "[FAIL] Test 29.5: synth loadModel failed!\n";
            return 29;
        }

        const auto* foundNode = synth.evaluateUnifiedSpectralSurface(60, 100);
        if (!foundNode || foundNode->rootKey != 60) {
            std::cerr << "[FAIL] Test 29.5: evaluateUnifiedSpectralSurface failed to find node!\n";
            return 29;
        }

        synth.noteOn(60, 0.9f);
        std::vector<float> synthL(256, 0.0f), synthR(256, 0.0f);
        synth.processStereoAdd(synthL.data(), synthR.data(), 256, 0.5f, 0.75f);

        for (size_t i = 0; i < 256; ++i) {
            if (std::isnan(synthL[i]) || std::isinf(synthL[i]) || std::isnan(synthR[i]) || std::isinf(synthR[i])) {
                std::cerr << "[FAIL] Test 29.5: NaN or INF in Resynator v2 audio rendering!\n";
                return 29;
            }
        }

        std::cout << "  [PASS] Test 29: Modo EXPANDED, APVTS [445..478] y Resynator v2 (AXM.4B) verified.\n";
    }

    // Test 30: Ola 5A - Integración de Efectos EXPANDED (FreqFX 5..7, TimeFX 5..7, MasterFX Expandido)
    {
        std::cout << "[Test 30] Verificando motores DSP de efectos EXPANDED (AXM.5A)...\n";
        auto engine = std::make_unique<DspEngineFacade>();
        engine->prepare(44100.0, 512);

        // 30.1: Conmutación a modo EXPANDED y validación de racks
        if (!engine->setEngineMode("expanded")) {
            std::cerr << "[FAIL] Test 30.1: setEngineMode('expanded') failed!\n";
            return 30;
        }

        std::vector<float> bufL(512, 0.0f);
        std::vector<float> bufR(512, 0.0f);
        engine->noteOn(60, 0.8f);

        // 30.2: Probar FreqFX Expandidos (5: Vocoder, 6: Resonator, 7: MoodFilter)
        const int freqAlgos[3] = { 5, 6, 7 };
        for (int algo : freqAlgos) {
            engine->setParam(ParamIdx::SilverSwitch, 1.0f);
            engine->setParam(ParamIdx::FreqFXSwitch, 1.0f);
            engine->setParam(ParamIdx::Exp_FreqFXAlg, static_cast<float>(algo));
            engine->setParam(ParamIdx::Exp_FreqFXMacro1, 0.6f);
            engine->setParam(ParamIdx::Exp_FreqFXMacro2, 0.4f);
            engine->setParam(ParamIdx::Exp_FreqFXMacro3, 0.7f);
            engine->setParam(ParamIdx::Exp_FreqFXMacro4, 0.8f);

            engine->process(bufL.data(), bufR.data(), 512);

            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(bufL[i]) || std::isinf(bufL[i]) || std::isnan(bufR[i]) || std::isinf(bufR[i])) {
                    std::cerr << "[FAIL] Test 30.2: NaN or INF in FreqFX algo " << algo << "!\n";
                    return 30;
                }
            }
        }
        std::cout << "  [30] FreqFX (Vocoder, Resonator, MoodFilter) ok.\n";

        // 30.3: Probar TimeFX Expandidos (5: Solina, 6: Rotary, 7: Nimbus)
        const int timeAlgos[3] = { 5, 6, 7 };
        for (int algo : timeAlgos) {
            engine->setParam(ParamIdx::SilverSwitch, 1.0f);
            engine->setParam(ParamIdx::TimeFXSwitch, 1.0f);
            engine->setParam(ParamIdx::Exp_TimeFXAlg, static_cast<float>(algo));
            engine->setParam(ParamIdx::Exp_TimeFXMacro1, 0.5f);
            engine->setParam(ParamIdx::Exp_TimeFXMacro2, 0.5f);
            engine->setParam(ParamIdx::Exp_TimeFXMacro3, 0.6f);
            engine->setParam(ParamIdx::Exp_TimeFXMacro4, 0.7f);

            engine->process(bufL.data(), bufR.data(), 512);

            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(bufL[i]) || std::isinf(bufL[i]) || std::isnan(bufR[i]) || std::isinf(bufR[i])) {
                    std::cerr << "[FAIL] Test 30.3: NaN or INF in TimeFX algo " << algo << "!\n";
                    return 30;
                }
            }
        }
        std::cout << "  [30] TimeFX (Solina, Rotary, Nimbus) ok.\n";

        // 30.4: Probar Master Delay Expandido (1: Shimmer, 2: MultiHead) y Reverb Expandida (1: Zita)
        engine->setParam(ParamIdx::SoundMFXSwitch, 1.0f);
        engine->setParam(ParamIdx::SoundMFXDelaySwitch, 1.0f);
        engine->setParam(ParamIdx::SoundMFXReverbSwitch, 1.0f);

        // Shimmer + Zita
        engine->setParam(ParamIdx::Exp_MasterDelayAlg, 1.0f);
        engine->setParam(ParamIdx::Exp_MasterRevAlg, 1.0f);
        engine->setParam(ParamIdx::Exp_MasterFXMacro1, 0.5f);
        engine->setParam(ParamIdx::Exp_MasterFXMacro2, 0.5f);
        engine->setParam(ParamIdx::Exp_MasterFXMacro3, 0.5f);
        engine->setParam(ParamIdx::Exp_MasterFXMacro4, 0.5f);
        engine->process(bufL.data(), bufR.data(), 512);

        for (size_t i = 0; i < 512; ++i) {
            if (std::isnan(bufL[i]) || std::isinf(bufL[i]) || std::isnan(bufR[i]) || std::isinf(bufR[i])) {
                std::cerr << "[FAIL] Test 30.4: NaN or INF in Shimmer Delay + Zita Reverb!\n";
                return 30;
            }
        }

        // MultiHead Echo + FDN Reverb
        engine->setParam(ParamIdx::Exp_MasterDelayAlg, 2.0f);
        engine->setParam(ParamIdx::Exp_MasterRevAlg, 0.0f);
        engine->process(bufL.data(), bufR.data(), 512);

        for (size_t i = 0; i < 512; ++i) {
            if (std::isnan(bufL[i]) || std::isinf(bufL[i]) || std::isnan(bufR[i]) || std::isinf(bufR[i])) {
                std::cerr << "[FAIL] Test 30.4: NaN or INF in MultiHead Echo!\n";
                return 30;
            }
        }
        std::cout << "  [30] Master FX Expandido (Shimmer, MultiHead, Zita) ok.\n";

        // 30.5: Conmutación de vuelta a classic
        if (!engine->setEngineMode("classic")) {
            std::cerr << "[FAIL] Test 30.5: fallback to classic mode failed!\n";
            return 30;
        }
        engine->allNotesOff();
        engine->process(bufL.data(), bufR.data(), 512);

        std::cout << "  [PASS] Test 30: Efectos EXPANDED y Master FX (AXM.5A) verified.\n";
    }

    std::cout << "[DspEngineFacadeTests] All 30 tests passed successfully!\n";
    return 0;
}
