// ============================================================================
// ABDAxionikVS — DspEngineFacade.cpp
// Implementación de la fachada desacoplada del motor DSP de ABDAxionikVS
// ============================================================================

#include "DspEngineFacade.h"
#include "AxionikParamIndices.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <sstream>

namespace abd::axionik {

namespace {
[[nodiscard]] std::string readFileText(const std::filesystem::path& path) {
  std::ifstream ifs(path, std::ios::in | std::ios::binary);
  if (!ifs.is_open()) return {};
  std::ostringstream oss;
  oss << ifs.rdbuf();
  return oss.str();
}
} // namespace

DspEngineFacade::DspEngineFacade() {
  bridge_ = std::make_unique<ParameterEngineBridge>(store_);
  // Conectar los Resynators v2 (modo expanded) a la entrada de voces del BlockRenderer
  // para que pasen por Blender -> Slicer -> Silver (Filtros + FreqFX + TimeFX) -> Master FX
  blockRenderer_.setExpandedVoiceRenderCallback(
      [this](float* leftAcc, float* rightAcc, size_t blockSize,
             float blenderAmount, int /*blenderType*/) {
        const bool exp0 = expandedSynths_[0].hasLoadedModel();
        const bool exp1 = expandedSynths_[1].hasLoadedModel();
        if (!exp0 && !exp1) return;

        using namespace abd::axionik::ParamIdx;
        const float* p = bridge_ ? bridge_->getEffectiveSlots() : nullptr;
        const bool r1On = getSlotRaw(p, SlotIdx::R1Switch, R1Switch) > 0.5f;
        const bool r2On = getSlotRaw(p, SlotIdx::R2Switch, R2Switch) > 0.5f;

        float gainR1 = 1.0f;
        float gainR2 = 1.0f;
        if (exp0 && exp1) {
          gainR1 = 1.0f - std::clamp(blenderAmount, 0.0f, 1.0f);
          gainR2 = std::clamp(blenderAmount, 0.0f, 1.0f);
        }

        if (exp0 && r1On && gainR1 > 1e-5f) {
          const float morphX1 = getSlotNorm(p, SlotIdx::R1L1Scape1Value, R1L1Scape1Value);
          const float morphY1 = getSlotNorm(p, SlotIdx::R1L1Sphere1Value, R1L1Sphere1Value);
          expandedSynths_[0].processStereoAdd(leftAcc, rightAcc, blockSize,
                                              morphX1, morphY1, gainR1);
        }
        if (exp1 && r2On && gainR2 > 1e-5f) {
          const float morphX2 = getSlotNorm(p, SlotIdx::R2L1Scape1Value, R2L1Scape1Value);
          const float morphY2 = getSlotNorm(p, SlotIdx::R2L1Sphere1Value, R2L1Sphere1Value);
          expandedSynths_[1].processStereoAdd(leftAcc, rightAcc, blockSize,
                                              morphX2, morphY2, gainR2);
        }
      });

  // Inicializar con preset 000 de librería o embebido 000 InitSound y modelo
  // 511 (sinew)
  if (!bankAdapter_.loadPresetBySlot(0, currentPreset_)) {
    currentPreset_ = NeuronSound::getEmbeddedInitPreset();
  }
  bankAdapter_.initDefaultModelsAndPresets(bridge_->getEngineState(), store_);
  applyPreset(currentPreset_);
}

DspEngineFacade::~DspEngineFacade() = default;

void DspEngineFacade::prepare(double sampleRate, size_t maxBlockSize) {
  sampleRate_ = sampleRate > 0.0 ? sampleRate : kLegacyBaseSampleRate;
  maxBlockSize_ = maxBlockSize > 0 ? maxBlockSize : 512;
  antiPopTotalSamples_ = std::max(
      size_t(1), static_cast<size_t>(
                     sampleRate_ * kAntiPopRampSeconds)); // 2ms rampa anti-pops
  voicePool_.setSampleRate(sampleRate_);
  blockRenderer_.prepare(sampleRate_, maxBlockSize_);
  stickPlayer_.prepare(sampleRate_);
  expandedSynths_[0].prepare(sampleRate_, maxBlockSize_);
  expandedSynths_[1].prepare(sampleRate_, maxBlockSize_);
}

void DspEngineFacade::reset() {
  voicePool_.reset();
  blockRenderer_.reset();
  stickPlayer_.reset();
  expandedSynths_[0].reset();
  expandedSynths_[1].reset();
  activeVoices_ = 0;
}

void DspEngineFacade::noteOn(uint8_t note, float velocity) {
  const bool exp0 = expandedSynths_[0].hasLoadedModel();
  const bool exp1 = expandedSynths_[1].hasLoadedModel();

  if (exp0) {
    expandedSynths_[0].noteOn(note, velocity);
  }
  if (exp1) {
    expandedSynths_[1].noteOn(note, velocity);
  }
  if (!exp0 || !exp1) {
    const auto &r1Zone = bankAdapter_.getZone(0, note);
    const auto &r2Zone = bankAdapter_.getZone(1, note);
    voicePool_.noteOn(note, velocity, r1Zone, r2Zone, 1.0f);
  }

  activeVoices_ = voicePool_.getActiveVoiceCount() +
                  expandedSynths_[0].getActiveVoiceCount() +
                  expandedSynths_[1].getActiveVoiceCount();

  if (stickPlayer_.hasEvents() &&
      (!stickPlayer_.isPlaying() || activeVoices_ <= 1)) {
    stickPlayer_.trigger();
  }
}

void DspEngineFacade::noteOff(uint8_t note) {
  voicePool_.noteOff(note);
  expandedSynths_[0].noteOff(note);
  expandedSynths_[1].noteOff(note);
  activeVoices_ = voicePool_.getActiveVoiceCount() +
                  expandedSynths_[0].getActiveVoiceCount() +
                  expandedSynths_[1].getActiveVoiceCount();
}

void DspEngineFacade::allNotesOff() {
  voicePool_.allNotesOff();
  expandedSynths_[0].allNotesOff();
  expandedSynths_[1].allNotesOff();
  stickPlayer_.stop();
  activeVoices_ = 0;
}

void DspEngineFacade::setParam(uint32_t index, float rawValue) {
  store_.setRawValue(index, rawValue);
}

void DspEngineFacade::setParamNormalized(uint32_t index,
                                         float normalizedValue) {
  store_.setNormalizedValue(index, normalizedValue);
}

bool DspEngineFacade::setEngineMode(std::string_view modeStr) noexcept {
  // Regla de variantes: solo la compilación más alta (AXIONIK_TARGET_MODEL == 2, expanded)
  // puede bajar en caliente a plus o classic; las compilaciones classic o plus quedan fijas.
#if AXIONIK_TARGET_MODEL == 0
  if (modeStr != "classic") return false;
#elif AXIONIK_TARGET_MODEL == 1
  if (modeStr != "plus" && modeStr != "classic-enhanced") return false;
#endif

  if (modeStr == "classic") {
    engineProfile_ = extended::AxionikEngineCapabilityProfile::makeClassic();
    expandedSynths_[0].clearModel();
    expandedSynths_[1].clearModel();
    voicePool_.reset();
    blockRenderer_.reset();
    antiPopRemaining_ = antiPopTotalSamples_;
    return true;
  }
  if (modeStr == "plus" || modeStr == "classic-enhanced") {
    engineProfile_ = extended::AxionikEngineCapabilityProfile::makePlus();
    expandedSynths_[0].clearModel();
    expandedSynths_[1].clearModel();
    voicePool_.reset();
    blockRenderer_.reset();
    antiPopRemaining_ = antiPopTotalSamples_;
    return true;
  }
  if (modeStr == "expanded" || modeStr == "extended" || modeStr == "expanded-v1") {
    engineProfile_ = extended::AxionikEngineCapabilityProfile::makeExpanded(
        engineProfile_.spatialOutputMode);
    voicePool_.reset();
    blockRenderer_.reset();
    antiPopRemaining_ = antiPopTotalSamples_;
    return true;
  }
  return false;
}

bool DspEngineFacade::loadExpandedModelFromJson(
    int slot,
    std::string_view jsonText,
    extended::AxionikExpandedPreflightReport* outReport) {
  if (slot < 0 || slot > 1) return false;
  const size_t s = static_cast<size_t>(slot);

  extended::AxionikExpandedModelDoc parsedDoc;
  extended::AxionikExpandedPreflightReport report =
      extended::preflightExpandedModelForAxionik(jsonText, engineProfile_, &parsedDoc);
  lastExpandedReports_[s] = report;
  if (outReport != nullptr) {
    *outReport = report;
  }

  if (!report.ok) {
    // Bloqueo estricto: jamás cargar parcialmente en silencio cuando ok == false
    expandedSynths_[s].clearModel();
    return false;
  }

  extended::applyExpandedPreflightAdaptations(parsedDoc, engineProfile_);
  voicePool_.reset();
  expandedSynths_[s].prepare(sampleRate_, maxBlockSize_);
  expandedSynths_[s].loadModel(parsedDoc);
  blockRenderer_.reset();
  antiPopRemaining_ = antiPopTotalSamples_;
  return true;
}

bool DspEngineFacade::loadExpandedModelFromLegacyNmModelJson(
    int slot,
    std::string_view nmmodelJson,
    std::string_view extendedMapJson,
    extended::AxionikExpandedPreflightReport* outReport) {
  if (slot < 0 || slot > 1) return false;
  const size_t s = static_cast<size_t>(slot);

  extended::AxionikExpandedModelDoc fallbackDoc;
  if (!extended::parseLegacyNmModelV1Json(nmmodelJson, extendedMapJson, fallbackDoc)) {
    extended::AxionikExpandedPreflightReport errReport;
    errReport.ok = false;
    errReport.errors.push_back(
        "invalid-json: Fallback v1 model.nmmodel inválido o sin espectros utilizables.");
    lastExpandedReports_[s] = errReport;
    if (outReport != nullptr) *outReport = errReport;
    expandedSynths_[s].clearModel();
    return false;
  }

  // Serializar un sobre mínimo v2.0.0 para validar capacidades y targetMode con preflightExpandedModelForAxionik
  std::ostringstream minJson;
  minJson << "{\"schemaVersion\":\"2.0.0\","
          << "\"identity\":{\"slug\":\"legacy-nmmodel-v1\",\"expandedName\":\"" << fallbackDoc.identity.expandedName
          << "\",\"modelName\":\"" << fallbackDoc.identity.modelName
          << "\",\"engineMin\":\"expanded\",\"requiredCaps\":[]},"
          << "\"spectral\":{\"partialCount\":" << fallbackDoc.spectral.partialCount
          << ",\"frameCount\":" << fallbackDoc.spectral.frameCount
          << ",\"frames\":[{\"amps\":[0.5]}]},"
          << "\"regions\":[{\"id\":\"r0\",\"sampleRef\":\"s0\",\"lowKey\":0,\"highKey\":127,\"rootKey\":60,\"lowVel\":1,\"highVel\":127}],"
          << "\"articulation\":{\"ampEnv\":{\"delay\":0,\"attack\":0.01,\"hold\":0,\"decay\":0.1,\"sustain\":1,\"release\":0.1},\"filters\":[],\"fxChain\":[]},"
          << "\"resynators\":[{\"id\":\"r1\",\"version\":2,\"model\":\"resonator-hd\"}],"
          << "\"analysis\":{},\"classic\":{\"modelName\":\"FALLBACK\",\"mapScriptRef\":\"04_classic_enhanced/map.script\",\"scapeSphereRefs\":[]}}";

  extended::AxionikExpandedPreflightReport report =
      extended::preflightExpandedModelForAxionik(minJson.str(), engineProfile_, nullptr);
  report.usedLegacyNmModelFallback = true;
  report.warnings.push_back(
      "legacy-nmmodel-v1-fallback: Cargado desde respaldo espectral v1 (05_extended_model/model.nmmodel).");
  lastExpandedReports_[s] = report;
  if (outReport != nullptr) {
    *outReport = report;
  }

  if (!report.ok) {
    expandedSynths_[s].clearModel();
    return false;
  }

  extended::applyExpandedPreflightAdaptations(fallbackDoc, engineProfile_);
  voicePool_.reset();
  expandedSynths_[s].prepare(sampleRate_, maxBlockSize_);
  expandedSynths_[s].loadModel(fallbackDoc);
  blockRenderer_.reset();
  antiPopRemaining_ = antiPopTotalSamples_;
  return true;
}

bool DspEngineFacade::loadExpandedModelFolder(
    int slot,
    const std::filesystem::path& folderOrCapsulePath,
    extended::AxionikExpandedPreflightReport* outReport) {
  if (slot < 0 || slot > 1) return false;
  const size_t s = static_cast<size_t>(slot);

  // Aislamiento estricto: prohibido consumir 04_classic_enhanced/ como modelo extendido
  if (folderOrCapsulePath.filename() == "04_classic_enhanced") {
    extended::AxionikExpandedPreflightReport errReport;
    errReport.ok = false;
    errReport.errors.push_back(
        "layer-isolation-violation: 04_classic_enhanced es exclusivo de los modos classic/plus y no puede cargarse en el motor expanded.");
    lastExpandedReports_[s] = errReport;
    if (outReport != nullptr) *outReport = errReport;
    expandedSynths_[s].clearModel();
    return false;
  }

  // Si se pasa directamente el fichero JSON o .nmmodel
  if (std::filesystem::is_regular_file(folderOrCapsulePath)) {
    if (folderOrCapsulePath.filename() == "axionik-expanded.json") {
      return loadExpandedModelFromJson(slot, readFileText(folderOrCapsulePath), outReport);
    }
    if (folderOrCapsulePath.extension() == ".nmmodel") {
      const auto mapPath = folderOrCapsulePath.parent_path() / "extended_map.json";
      const std::string mapText = std::filesystem::exists(mapPath) ? readFileText(mapPath) : std::string{};
      return loadExpandedModelFromLegacyNmModelJson(slot, readFileText(folderOrCapsulePath), mapText, outReport);
    }
  }

  // Resolver subcarpeta 05_extended_model si folderOrCapsulePath es la raíz de una Time-Capsule
  const std::filesystem::path extDir =
      std::filesystem::exists(folderOrCapsulePath / "05_extended_model")
          ? (folderOrCapsulePath / "05_extended_model")
          : folderOrCapsulePath;

  // 1. Fuente primaria: 05_extended_model/axionik-expanded.json
  const std::filesystem::path primaryJsonPath = extDir / "axionik-expanded.json";
  if (std::filesystem::exists(primaryJsonPath)) {
    return loadExpandedModelFromJson(slot, readFileText(primaryJsonPath), outReport);
  }

  // 2. Respaldo espectral v1: 05_extended_model/model.nmmodel (+ extended_map.json)
  const std::filesystem::path fallbackNmPath = extDir / "model.nmmodel";
  if (std::filesystem::exists(fallbackNmPath)) {
    const std::filesystem::path mapPath = extDir / "extended_map.json";
    const std::string mapText = std::filesystem::exists(mapPath) ? readFileText(mapPath) : std::string{};
    return loadExpandedModelFromLegacyNmModelJson(slot, readFileText(fallbackNmPath), mapText, outReport);
  }

  extended::AxionikExpandedPreflightReport errReport;
  errReport.ok = false;
  errReport.errors.push_back(
      "not-expanded-model: No se encontró 05_extended_model/axionik-expanded.json ni 05_extended_model/model.nmmodel.");
  lastExpandedReports_[s] = errReport;
  if (outReport != nullptr) *outReport = errReport;
  expandedSynths_[s].clearModel();
  return false;
}

bool DspEngineFacade::loadModel(int slot,
                                const std::filesystem::path &modelFolder) {
  if (!bridge_ || slot < 0 || slot > 1)
    return false;

  const bool isExplicitExtendedDir =
      (modelFolder.filename() == "05_extended_model") ||
      (modelFolder.filename() == "axionik-expanded.json") ||
      (modelFolder.extension() == ".nmmodel") ||
      std::filesystem::exists(modelFolder / "axionik-expanded.json") ||
      std::filesystem::exists(modelFolder / "model.nmmodel");

  const bool hasCapsuleExtendedDir =
      std::filesystem::exists(modelFolder / "05_extended_model" / "axionik-expanded.json") ||
      std::filesystem::exists(modelFolder / "05_extended_model" / "model.nmmodel");

  const bool isExpandedMode =
      (engineProfile_.generation == "expanded" || engineProfile_.generation == "expanded-v1");

  if (isExplicitExtendedDir || (hasCapsuleExtendedDir && isExpandedMode)) {
    return loadExpandedModelFolder(slot, modelFolder, nullptr);
  }

  expandedSynths_[static_cast<size_t>(slot)].clearModel();
  voicePool_.reset();
  activeVoices_ = 0;

  // En modo classic / plus sobre una Time-Capsule, enrutar exclusivamente a 04_classic_enhanced o 02_legacy_original
  std::filesystem::path effectiveClassicFolder = modelFolder;
  if (!std::filesystem::exists(modelFolder / "Model.dat") &&
      !std::filesystem::exists(modelFolder / "model.dat")) {
    if (std::filesystem::exists(modelFolder / "04_classic_enhanced")) {
      effectiveClassicFolder = modelFolder / "04_classic_enhanced";
    } else if (std::filesystem::exists(modelFolder / "02_legacy_original")) {
      effectiveClassicFolder = modelFolder / "02_legacy_original";
    }
  }

  bool ok =
      bankAdapter_.loadModel(slot, effectiveClassicFolder, bridge_->getEngineState());
  if (ok) {
    // Corrección Mac 1.56 (Stephan Bernsee): limpieza de estados y rampa
    // anti-pops de 2ms
    blockRenderer_.reset();
    antiPopRemaining_ = antiPopTotalSamples_;
  }
  return ok;
}

bool DspEngineFacade::loadPreset(const std::filesystem::path &soundFolder) {
  SoundPreset preset;
  if (!NeuronSound::loadSoundFolder(soundFolder, preset)) {
    return false;
  }
  return applyPreset(preset);
}

bool DspEngineFacade::loadPresetFromScript(const std::string &scriptText) {
  SoundPreset preset;
  if (!NeuronSound::parseSoundScript(scriptText, preset)) {
    return false;
  }
  return applyPreset(preset);
}

bool DspEngineFacade::applyPreset(const SoundPreset &preset) {
  // Silenciar voces activas ANTES de reemplazar modelos en bankAdapter_ (evita
  // punteros colgantes en NeuronVoice)
  voicePool_.reset();
  activeVoices_ = 0;
  currentPreset_ = preset;
  // 1. Cargar los 445 parámetros en el almacén de configuración
  // En presets v1 (SoundVersionMajor < 2), FUN_10013ea0 resta 64.0 a
  // BlenderAmount [262] sin recorte posterior
  for (size_t i = 0; i < kNumTotalParameters; ++i) {
    if (i == ParamIdx::BlenderAmount && preset.versionMajor < 2) {
      store_.setRawValueUnclamped(static_cast<uint32_t>(i), preset.values[i],
                                  false);
    } else {
      store_.setRawValue(static_cast<uint32_t>(i), preset.values[i], false);
    }
  }
  // 2. Disparar observadores y actualizar el motor
  store_.notifyAll();

  // 3. Cargar trayectorias vectoriales de joysticks si existen en el preset
  stickPlayer_.loadEvents(preset.stickEvents);

  // 4. Cargar los modelos vinculados en R1 y R2 si existen en la librería
  if (bridge_) {
    if (preset.r1ModelIndex >= 0) {
      expandedSynths_[0].clearModel();
      bankAdapter_.loadModelBySlot(0, preset.r1ModelIndex,
                                   bridge_->getEngineState());
    }
    if (preset.r2ModelIndex >= 0) {
      expandedSynths_[1].clearModel();
      bankAdapter_.loadModelBySlot(1, preset.r2ModelIndex,
                                   bridge_->getEngineState());
    }
  }

  // 5. Sincronizar estado de voces inmediatamente (envolventes, niveles y
  // switches del preset)
  const float *p = bridge_ ? bridge_->getEffectiveSlots() : nullptr;
  float globalLfoSignal = updateModulationAndPitch(p, 0);
  updateResynatorLayers(p, globalLfoSignal);
  updateEnvelopes(p);

  // 6. Recentrar Pitch Bend, limpiar colas circulares (Mac 1.56) y activar
  // rampa anti-pops de 2ms
  pitchBendWheel_ = 0.0f;
  voicePool_.updatePitchBendFactor(1.0f);
  blockRenderer_.reset();
  antiPopRemaining_ = antiPopTotalSamples_;
  return true;
}

void DspEngineFacade::processVectorSticks(size_t numSamples) {
  stickPlayer_.processBlock(numSamples,
                            [this](uint32_t paramIdx, float rawVal) {
                              store_.setRawValue(paramIdx, rawVal);
                              if (onStickParamChanged_) {
                                onStickParamChanged_(paramIdx, rawVal);
                              }
                            });
}

float DspEngineFacade::updateModulationAndPitch(const float *p,
                                                size_t numSamples) {
  using namespace abd::axionik::ParamIdx;

  // Pitch Bend: clamp semitones to [-48, +48] to avoid exponential overflow
  float pbRange = getSlotRaw(p, SlotIdx::PitchBendRange, PitchBendRange);
  if (pbRange <= 0.0f)
    pbRange = 2.0f;
  float semitones = std::clamp(pitchBendWheel_ * pbRange, -48.0f, 48.0f);
  float pbFactor = std::pow(2.0f, semitones / 12.0f);
  voicePool_.updatePitchBendFactor(pbFactor);

  // Voice allocation and master sound routing (mínimo 12 voces de polifonía si el preset clásico especificaba <= 6)
  float rawVoices = store_.getRawValue(SoundNumVoices);
  size_t maxVoices = static_cast<size_t>(
      std::clamp(std::max(rawVoices, 12.0f), 1.0f, calibration_.maxPolyphonyVoices));
  voicePool_.setMaxActiveVoices(maxVoices);

  float soundPan = getSlotRaw(p, SlotIdx::SoundPan, SoundPan) / 64.0f;
  float soundPanKt =
      getSlotRaw(p, SlotIdx::SoundPanKeyTrack, SoundPanKeyTrack) / 64.0f;
  voicePool_.updateVoicePan(soundPan, soundPanKt);

  float r1VelSw =
      getSlotRaw(p, SlotIdx::R1ModelVelocitySwitch, R1ModelVelocitySwitch) /
      127.0f;
  float r2VelSw =
      getSlotRaw(p, SlotIdx::R2ModelVelocitySwitch, R2ModelVelocitySwitch) /
      127.0f;
  voicePool_.setVelocitySwitchThresholds(r1VelSw, r2VelSw);

  // Resynator enables (si hay un modelo v2 cargado en expandedSynths_[slot], silenciar la ranura v1 en voicePool_ para evitar doble disparo)
  bool r1On = getSlotRaw(p, SlotIdx::R1Switch, R1Switch) > 0.5f;
  bool r2On = getSlotRaw(p, SlotIdx::R2Switch, R2Switch) > 0.5f;
  voicePool_.updateResynatorEnabled(0, r1On && !expandedSynths_[0].hasLoadedModel());
  voicePool_.updateResynatorEnabled(1, r2On && !expandedSynths_[1].hasLoadedModel());

  // Global LFO calculation with symbolic table size
  constexpr double kNeuronLfoTableSize =
      static_cast<double>(abd::dsp::DspNeuronLfoTables::kTableSize);
  bool lfoOn = getSlotRaw(p, SlotIdx::LFOSwitch, LFOSwitch) > 0.5f;
  float globalLfoSignal = 0.0f;
  if (lfoOn) {
    float lfoDepth = getSlotNorm(p, SlotIdx::LFODepth, LFODepth);
    float lfoRateNorm = getSlotRaw(p, SlotIdx::LFORate, LFORate) / 1000.0f;
    float lfoRateHz = calibration_.lfoMinRateHz + std::clamp(lfoRateNorm, 0.0f, 1.0f) * calibration_.lfoMaxRateSpanHz;
    int lfoWave =
        static_cast<int>(getSlotRaw(p, SlotIdx::LFOWaveForm, LFOWaveForm));
    globalLfoPhase_ += static_cast<double>(lfoRateHz) *
                       (kNeuronLfoTableSize / sampleRate_) *
                       static_cast<double>(numSamples);
    while (globalLfoPhase_ >= kNeuronLfoTableSize) {
      globalLfoPhase_ -= kNeuronLfoTableSize;
    }
    globalLfoSignal = abd::dsp::DspNeuronLfoTables::readInterpolated(
                          lfoWave, globalLfoPhase_) *
                      lfoDepth;
  }
  return globalLfoSignal;
}

void DspEngineFacade::updateResynatorLayers(const float *p,
                                            float globalLfoSignal) {
  using namespace abd::axionik::ParamIdx;

  auto applyLfo = [p, globalLfoSignal, this](float baseVal, size_t lfoSlot, uint32_t lfoParam) noexcept {
    float depth = p ? p[lfoSlot] : (store_.getRawValue(lfoParam) / 64.0f);
    return std::clamp(baseVal + globalLfoSignal * depth * 0.5f, 0.0f, 1.0f);
  };

  // Resynator 1: Layers L1, L2, L3 (con modulación LFO por eje [47,48,57,58,67,68,77,78,87,88,97,98])
  float r1_sc1 = applyLfo(getSlotNorm(p, SlotIdx::R1L1Scape1Value, R1L1Scape1Value), SlotIdx::R1L1Scape1LfoDepth, R1L1Scape1LfoDepth);
  float r1_sc2 = applyLfo(getSlotNorm(p, SlotIdx::R1L1Scape2Value, R1L1Scape2Value), SlotIdx::R1L1Scape2LfoDepth, R1L1Scape2LfoDepth);
  float r1_sp1 = applyLfo(getSlotNorm(p, SlotIdx::R1L1Sphere1Value, R1L1Sphere1Value), SlotIdx::R1L1Sphere1LfoDepth, R1L1Sphere1LfoDepth);
  float r1_sp2 = applyLfo(getSlotNorm(p, SlotIdx::R1L1Sphere2Value, R1L1Sphere2Value), SlotIdx::R1L1Sphere2LfoDepth, R1L1Sphere2LfoDepth);
  voicePool_.updateVoiceLayerParams(0, 0, r1_sc1, r1_sc2, r1_sp1, r1_sp2, 1.0f);

  float r1_l2_sc1 = applyLfo(getSlotNorm(p, SlotIdx::R1L2Scape1Value, R1L2Scape1Value), SlotIdx::R1L2Scape1LfoDepth, R1L2Scape1LfoDepth);
  float r1_l2_sc2 = applyLfo(getSlotNorm(p, SlotIdx::R1L2Scape2Value, R1L2Scape2Value), SlotIdx::R1L2Scape2LfoDepth, R1L2Scape2LfoDepth);
  float r1_l2_sp1 = applyLfo(getSlotNorm(p, SlotIdx::R1L2Sphere1Value, R1L2Sphere1Value), SlotIdx::R1L2Sphere1LfoDepth, R1L2Sphere1LfoDepth);
  float r1_l2_sp2 = applyLfo(getSlotNorm(p, SlotIdx::R1L2Sphere2Value, R1L2Sphere2Value), SlotIdx::R1L2Sphere2LfoDepth, R1L2Sphere2LfoDepth);
  voicePool_.updateVoiceLayerParams(0, 1, r1_l2_sc1, r1_l2_sc2, r1_l2_sp1,
                                    r1_l2_sp2, calibration_.layer2BaseLevel);

  float r1_l3_sc1 = applyLfo(getSlotNorm(p, SlotIdx::R1L3Scape1Value, R1L3Scape1Value), SlotIdx::R1L3Scape1LfoDepth, R1L3Scape1LfoDepth);
  float r1_l3_sc2 = applyLfo(getSlotNorm(p, SlotIdx::R1L3Scape2Value, R1L3Scape2Value), SlotIdx::R1L3Scape2LfoDepth, R1L3Scape2LfoDepth);
  float r1_l3_sp1 = applyLfo(getSlotNorm(p, SlotIdx::R1L3Sphere1Value, R1L3Sphere1Value), SlotIdx::R1L3Sphere1LfoDepth, R1L3Sphere1LfoDepth);
  float r1_l3_sp2 = applyLfo(getSlotNorm(p, SlotIdx::R1L3Sphere2Value, R1L3Sphere2Value), SlotIdx::R1L3Sphere2LfoDepth, R1L3Sphere2LfoDepth);
  voicePool_.updateVoiceLayerParams(0, 2, r1_l3_sc1, r1_l3_sc2, r1_l3_sp1,
                                    r1_l3_sp2, calibration_.layer3BaseLevel);

  // Resynator 2: Layers L1, L2, L3 (con modulación LFO por eje [127,128,137,138,147,148,157,158,167,168,177,178])
  float r2_sc1 = applyLfo(getSlotNorm(p, SlotIdx::R2L1Scape1Value, R2L1Scape1Value), SlotIdx::R2L1Scape1LfoDepth, R2L1Scape1LfoDepth);
  float r2_sc2 = applyLfo(getSlotNorm(p, SlotIdx::R2L1Scape2Value, R2L1Scape2Value), SlotIdx::R2L1Scape2LfoDepth, R2L1Scape2LfoDepth);
  float r2_sp1 = applyLfo(getSlotNorm(p, SlotIdx::R2L1Sphere1Value, R2L1Sphere1Value), SlotIdx::R2L1Sphere1LfoDepth, R2L1Sphere1LfoDepth);
  float r2_sp2 = applyLfo(getSlotNorm(p, SlotIdx::R2L1Sphere2Value, R2L1Sphere2Value), SlotIdx::R2L1Sphere2LfoDepth, R2L1Sphere2LfoDepth);
  voicePool_.updateVoiceLayerParams(1, 0, r2_sc1, r2_sc2, r2_sp1, r2_sp2, 1.0f);

  float r2_l2_sc1 = applyLfo(getSlotNorm(p, SlotIdx::R2L2Scape1Value, R2L2Scape1Value), SlotIdx::R2L2Scape1LfoDepth, R2L2Scape1LfoDepth);
  float r2_l2_sc2 = applyLfo(getSlotNorm(p, SlotIdx::R2L2Scape2Value, R2L2Scape2Value), SlotIdx::R2L2Scape2LfoDepth, R2L2Scape2LfoDepth);
  float r2_l2_sp1 = applyLfo(getSlotNorm(p, SlotIdx::R2L2Sphere1Value, R2L2Sphere1Value), SlotIdx::R2L2Sphere1LfoDepth, R2L2Sphere1LfoDepth);
  float r2_l2_sp2 = applyLfo(getSlotNorm(p, SlotIdx::R2L2Sphere2Value, R2L2Sphere2Value), SlotIdx::R2L2Sphere2LfoDepth, R2L2Sphere2LfoDepth);
  voicePool_.updateVoiceLayerParams(1, 1, r2_l2_sc1, r2_l2_sc2, r2_l2_sp1,
                                    r2_l2_sp2, calibration_.layer2BaseLevel);

  float r2_l3_sc1 = applyLfo(getSlotNorm(p, SlotIdx::R2L3Scape1Value, R2L3Scape1Value), SlotIdx::R2L3Scape1LfoDepth, R2L3Scape1LfoDepth);
  float r2_l3_sc2 = applyLfo(getSlotNorm(p, SlotIdx::R2L3Scape2Value, R2L3Scape2Value), SlotIdx::R2L3Scape2LfoDepth, R2L3Scape2LfoDepth);
  float r2_l3_sp1 = applyLfo(getSlotNorm(p, SlotIdx::R2L3Sphere1Value, R2L3Sphere1Value), SlotIdx::R2L3Sphere1LfoDepth, R2L3Sphere1LfoDepth);
  float r2_l3_sp2 = applyLfo(getSlotNorm(p, SlotIdx::R2L3Sphere2Value, R2L3Sphere2Value), SlotIdx::R2L3Sphere2LfoDepth, R2L3Sphere2LfoDepth);
  voicePool_.updateVoiceLayerParams(1, 2, r2_l3_sc1, r2_l3_sc2, r2_l3_sp1,
                                    r2_l3_sp2, calibration_.layer3BaseLevel);

  // Parset algorithms
  int r1Parset = static_cast<int>(store_.getRawValue(R1Type));
  int r2Parset = static_cast<int>(store_.getRawValue(R2Type));
  voicePool_.updateVoiceParset(0, r1Parset);
  voicePool_.updateVoiceParset(1, r2Parset);

  // Tuning and volume (+ ModelSizeOffset [32], [112])
  int r1Oct = static_cast<int>(getSlotRaw(p, SlotIdx::R1Octave, R1Octave));
  int r1Semi =
      static_cast<int>(std::round(getSlotRaw(p, SlotIdx::R1Semi, R1Semi)));
  float r1PitchLfo = p ? p[SlotIdx::R1PitchLfoDepth]
                       : (store_.getRawValue(R1PitchLfoDepth) / 64.0f);
  float r1SizeOff = p ? p[SlotIdx::R1ModelSizeOffset]
                      : (store_.getRawValue(R1ModelSizeOffset) / 64.0f);
  float r1Cents = getSlotRaw(p, SlotIdx::R1Cents, R1Cents) +
                  globalLfoSignal * r1PitchLfo * calibration_.pitchLfoMaxCents +
                  r1SizeOff * calibration_.modelSizeOffsetCents;
  voicePool_.updateVoiceTuning(0, r1Oct, r1Semi, r1Cents);

  float r1AmpLfo = p ? p[SlotIdx::R1AmpLfoDepth]
                     : (store_.getRawValue(R1AmpLfoDepth) / 64.0f);
  float r1VelDepth = p ? p[SlotIdx::R1VolumeVelocityDepth]
                       : (store_.getRawValue(R1VolumeVelocityDepth) / 64.0f);
  float r1AmpKt = p ? p[SlotIdx::R1AmpKeyTrack]
                    : (store_.getRawValue(R1AmpKeyTrack) / 64.0f);
  float r1Vol = std::clamp(getSlotNorm(p, SlotIdx::R1Volume, R1Volume) *
                               (1.0f + globalLfoSignal * r1AmpLfo * 0.5f),
                           0.0f, 1.5f);
  voicePool_.updateVoiceVolume(0, r1Vol, r1VelDepth, r1AmpKt);

  int r2Oct = static_cast<int>(getSlotRaw(p, SlotIdx::R2Octave, R2Octave));
  int r2Semi =
      static_cast<int>(std::round(getSlotRaw(p, SlotIdx::R2Semi, R2Semi)));
  float r2PitchLfo = p ? p[SlotIdx::R2PitchLfoDepth]
                       : (store_.getRawValue(R2PitchLfoDepth) / 64.0f);
  float r2SizeOff = p ? p[SlotIdx::R2ModelSizeOffset]
                      : (store_.getRawValue(R2ModelSizeOffset) / 64.0f);
  float r2Cents = getSlotRaw(p, SlotIdx::R2Cents, R2Cents) +
                  globalLfoSignal * r2PitchLfo * calibration_.pitchLfoMaxCents +
                  r2SizeOff * calibration_.modelSizeOffsetCents;
  voicePool_.updateVoiceTuning(1, r2Oct, r2Semi, r2Cents);

  float r2AmpLfo = p ? p[SlotIdx::R2AmpLfoDepth]
                     : (store_.getRawValue(R2AmpLfoDepth) / 64.0f);
  float r2VelDepth = p ? p[SlotIdx::R2VolumeVelocityDepth]
                       : (store_.getRawValue(R2VolumeVelocityDepth) / 64.0f);
  float r2AmpKt = p ? p[SlotIdx::R2AmpKeyTrack]
                    : (store_.getRawValue(R2AmpKeyTrack) / 64.0f);
  float r2Vol = std::clamp(getSlotNorm(p, SlotIdx::R2Volume, R2Volume) *
                               (1.0f + globalLfoSignal * r2AmpLfo * 0.5f),
                           0.0f, 1.5f);
  voicePool_.updateVoiceVolume(1, r2Vol, r2VelDepth, r2AmpKt);
}

void DspEngineFacade::updateEnvelopes(const float *p) {
  using namespace abd::axionik::ParamIdx;

  float r1aNorm = getSlotNorm(p, SlotIdx::R1AmpEnvA, R1AmpEnvA);
  float r1dNorm = getSlotNorm(p, SlotIdx::R1AmpEnvD, R1AmpEnvD);
  float r1sLvl = getSlotNorm(p, SlotIdx::R1AmpEnvS, R1AmpEnvS);
  float r1rNorm = getSlotNorm(p, SlotIdx::R1AmpEnvR, R1AmpEnvR);
  bool r1AmpRep = getSlotRaw(p, SlotIdx::R1AmpEnvMode, R1AmpEnvMode) > 0.5f;
  voicePool_.updateAmpEnvelope(0, r1aNorm, r1dNorm, r1sLvl, r1rNorm, r1AmpRep);

  float r2aNorm = getSlotNorm(p, SlotIdx::R2AmpEnvA, R2AmpEnvA);
  float r2dNorm = getSlotNorm(p, SlotIdx::R2AmpEnvD, R2AmpEnvD);
  float r2sLvl = getSlotNorm(p, SlotIdx::R2AmpEnvS, R2AmpEnvS);
  float r2rNorm = getSlotNorm(p, SlotIdx::R2AmpEnvR, R2AmpEnvR);
  bool r2AmpRep = getSlotRaw(p, SlotIdx::R2AmpEnvMode, R2AmpEnvMode) > 0.5f;
  voicePool_.updateAmpEnvelope(1, r2aNorm, r2dNorm, r2sLvl, r2rNorm, r2AmpRep);

  float faNorm = getSlotNorm(p, SlotIdx::FilterEnvA, FilterEnvA);
  float fdNorm = getSlotNorm(p, SlotIdx::FilterEnvD, FilterEnvD);
  float fsLvl = getSlotNorm(p, SlotIdx::FilterEnvS, FilterEnvS);
  float frNorm = getSlotNorm(p, SlotIdx::FilterEnvR, FilterEnvR);
  bool fEnvRep = getSlotRaw(p, SlotIdx::FilterEnvMode, FilterEnvMode) > 0.5f;
  voicePool_.updateFilterEnvelope(faNorm, fdNorm, fsLvl, frNorm, fEnvRep);
  float fEnvVel = p ? p[SlotIdx::FilterEnvVelocityDepth]
                    : (store_.getRawValue(FilterEnvVelocityDepth) / 64.0f);
  voicePool_.updateFilterEnvVelocityDepth(fEnvVel);

  // R1 ResEnv / R2 ResEnv & ParaEnv Depths ([187..199], [217..229])
  float r1Ra = getSlotNorm(p, SlotIdx::R1ResEnvA, R1ResEnvA);
  float r1Rd = getSlotNorm(p, SlotIdx::R1ResEnvD, R1ResEnvD);
  float r1Rs = getSlotNorm(p, SlotIdx::R1ResEnvS, R1ResEnvS);
  float r1Rr = getSlotNorm(p, SlotIdx::R1ResEnvR, R1ResEnvR);
  bool r1ResRep = getSlotRaw(p, SlotIdx::R1ResEnvMode, R1ResEnvMode) > 0.5f;
  voicePool_.updateResEnvelopes(0, r1Ra, r1Rd, r1Rs, r1Rr, r1ResRep);

  float r1ParaVel = p ? p[SlotIdx::R1ParaEnvVelocityDepth] : (store_.getRawValue(R1ParaEnvVelocityDepth) / 64.0f);
  float r1Sc1ED = p ? p[SlotIdx::R1L1Scape1EnvDepth] : (store_.getRawValue(R1L1Scape1EnvDepth) / 64.0f);
  float r1Sc2ED = p ? p[SlotIdx::R1L1Scape2EnvDepth] : (store_.getRawValue(R1L1Scape2EnvDepth) / 64.0f);
  float r1Sp1ED = p ? p[SlotIdx::R1L1Sphere1EnvDepth] : (store_.getRawValue(R1L1Sphere1EnvDepth) / 64.0f);
  float r1Sp2ED = p ? p[SlotIdx::R1L1Sphere2EnvDepth] : (store_.getRawValue(R1L1Sphere2EnvDepth) / 64.0f);
  voicePool_.updateResEnvModDepths(0, r1Sc1ED, r1Sc2ED, r1Sp1ED, r1Sp2ED, r1ParaVel);

  float r2Ra = getSlotNorm(p, SlotIdx::R2ResEnvA, R2ResEnvA);
  float r2Rd = getSlotNorm(p, SlotIdx::R2ResEnvD, R2ResEnvD);
  float r2Rs = getSlotNorm(p, SlotIdx::R2ResEnvS, R2ResEnvS);
  float r2Rr = getSlotNorm(p, SlotIdx::R2ResEnvR, R2ResEnvR);
  bool r2ResRep = getSlotRaw(p, SlotIdx::R2ResEnvMode, R2ResEnvMode) > 0.5f;
  voicePool_.updateResEnvelopes(1, r2Ra, r2Rd, r2Rs, r2Rr, r2ResRep);

  float r2ParaVel = p ? p[SlotIdx::R2ParaEnvVelocityDepth] : (store_.getRawValue(R2ParaEnvVelocityDepth) / 64.0f);
  float r2Sc1ED = p ? p[SlotIdx::R2L1Scape1EnvDepth] : (store_.getRawValue(R2L1Scape1EnvDepth) / 64.0f);
  float r2Sc2ED = p ? p[SlotIdx::R2L1Scape2EnvDepth] : (store_.getRawValue(R2L1Scape2EnvDepth) / 64.0f);
  float r2Sp1ED = p ? p[SlotIdx::R2L1Sphere1EnvDepth] : (store_.getRawValue(R2L1Sphere1EnvDepth) / 64.0f);
  float r2Sp2ED = p ? p[SlotIdx::R2L1Sphere2EnvDepth] : (store_.getRawValue(R2L1Sphere2EnvDepth) / 64.0f);
  voicePool_.updateResEnvModDepths(1, r2Sc1ED, r2Sc2ED, r2Sp1ED, r2Sp2ED, r2ParaVel);

  // R1 FreeEnv [204..210] / R2 FreeEnv [234..240] & Routing [251, 255] + Pitch/Blender Free Depths
  float r1Fa = getSlotNorm(p, SlotIdx::R1FreeEnvA, R1FreeEnvA);
  float r1Fd = getSlotNorm(p, SlotIdx::R1FreeEnvD, R1FreeEnvD);
  float r1Fs = getSlotNorm(p, SlotIdx::R1FreeEnvS, R1AmpEnvS != R1FreeEnvS ? R1FreeEnvS : R1FreeEnvS);
  float r1Fr = getSlotNorm(p, SlotIdx::R1FreeEnvR, R1FreeEnvR);
  bool r1FreeRep = getSlotRaw(p, SlotIdx::R1FreeEnvMode, R1FreeEnvMode) > 0.5f;

  float r2Fa = getSlotNorm(p, SlotIdx::R2FreeEnvA, R2FreeEnvA);
  float r2Fd = getSlotNorm(p, SlotIdx::R2FreeEnvD, R2FreeEnvD);
  float r2Fs = getSlotNorm(p, SlotIdx::R2FreeEnvS, R2FreeEnvS);
  float r2Fr = getSlotNorm(p, SlotIdx::R2FreeEnvR, R2FreeEnvR);
  bool r2FreeRep = getSlotRaw(p, SlotIdx::R2FreeEnvMode, R2FreeEnvMode) > 0.5f;

  int freeDest = static_cast<int>(store_.getRawValue(ShaperResySelect));
  float tlFreeDepth = getSlotNorm(p, SlotIdx::TLFreeEnvDepth, TLFreeEnvDepth);
  float r1FreeDepth = getSlotNorm(p, SlotIdx::R1FreeEnvDepth, R1FreeEnvDepth);
  float r2FreeDepth = getSlotNorm(p, SlotIdx::R2FreeEnvDepth, R2FreeEnvDepth);
  float effFreeDepth = std::max({tlFreeDepth, r1FreeDepth, r2FreeDepth});

  float r1FreePitch = p ? (p[SlotIdx::R1FreeADSR1PitchDepth] + p[SlotIdx::R1FreeADSR2PitchDepth] + p[SlotIdx::R1Free4L4TPitchDepth])
                        : (store_.getRawValue(R1FreeADSR1PitchDepth) / 64.0f);
  float r2FreePitch = p ? (p[SlotIdx::R2FreeADSR1PitchDepth] + p[SlotIdx::R2FreeADSR2PitchDepth] + p[SlotIdx::R2Free4L4TPitchDepth])
                        : (store_.getRawValue(R2FreeADSR1PitchDepth) / 64.0f);
  float blenderFree = p ? (p[SlotIdx::BlenderFreeADSR1Depth] + p[SlotIdx::BlenderFreeADSR2Depth] + p[SlotIdx::BlenderFree4L4TDepth])
                        : (store_.getRawValue(BlenderFreeADSR1Depth) / 64.0f);

  voicePool_.updateFreeEnvelopes(0, r1Fa, r1Fd, r1Fs, r1Fr, r1FreeRep, freeDest, effFreeDepth, r1FreePitch, r2FreePitch, blenderFree);
  voicePool_.updateFreeEnvelopes(1, r2Fa, r2Fd, r2Fs, r2Fr, r2FreeRep, freeDest, effFreeDepth, r1FreePitch, r2FreePitch, blenderFree);
}

DspEngineFacade::RenderBlockParams
DspEngineFacade::updateSilverAndMasterFx(const float *p,
                                         float globalLfoSignal) {
  using namespace abd::axionik::ParamIdx;
  RenderBlockParams params;

  // Blender & Slicer routing
  float blenderLfoMod = p ? p[SlotIdx::BlenderLfoDepth]
                          : (store_.getRawValue(BlenderLfoDepth) / 64.0f);
  float blenderBase =
      p ? p[SlotIdx::BlenderAmount]
        : std::clamp((store_.getRawValue(BlenderAmount) + 64.0f) / 127.0f, 0.0f,
                     1.0f);
  params.blenderNorm = std::clamp(
      blenderBase + globalLfoSignal * blenderLfoMod * 0.5f, 0.0f, 1.0f);
  params.blenderType =
      static_cast<int>(getSlotRaw(p, SlotIdx::BlenderType, BlenderType));

  params.slicerType = static_cast<int>(
      getSlotRaw(p, SlotIdx::SlicerSwitchType, SlicerSwitchType));
  params.slicerDepth =
      p ? p[SlotIdx::SlicerDepth]
        : std::clamp(store_.getRawValue(SlicerDepth) / 127.0f, 0.0f, 1.0f);
  float slicerRateNorm =
      p ? p[SlotIdx::SlicerRate]
        : std::clamp(store_.getRawValue(SlicerRate) / 200.0f, 0.0f, 1.0f);
  params.slicerRateHz =
      std::clamp(std::pow(10.0f, slicerRateNorm * 4.0f - 2.0f), 0.01f, 100.0f);
  params.slicerWave =
      static_cast<int>(getSlotRaw(p, SlotIdx::SlicerWaveForm, SlicerWaveForm));

  // Silver Rack: Filter section
  float filterLfoMod = p ? p[SlotIdx::FilterLfoDepth]
                         : (store_.getRawValue(FilterLfoDepth) / 64.0f);
  float filterFreqBase =
      p ? p[SlotIdx::FilterFreq]
        : std::clamp(store_.getRawValue(FilterFreq) / 127.0f, 0.0f, 1.0f);
  float filterFreqNorm = std::clamp(
      filterFreqBase + globalLfoSignal * filterLfoMod * 0.5f, 0.0f, 1.0f);
  params.cutoffHz =
      std::clamp(calibration_.filterMinCutoffHz * std::pow(calibration_.filterCutoffExpRatio, filterFreqNorm), 5.0f, 20000.0f);

  float filterResoNorm =
      p ? p[SlotIdx::FilterReso]
        : std::clamp(store_.getRawValue(FilterReso) / 127.0f, 0.0f, 1.0f);
  params.resonance = std::clamp(filterResoNorm * calibration_.filterMaxResonance, 0.0f, 1.0f);

  bool silverSwitchOn =
      getSlotRaw(p, SlotIdx::SilverSwitch, SilverSwitch) > 0.5f;
  params.filterType =
      silverSwitchOn
          ? static_cast<int>(getSlotRaw(p, SlotIdx::FilterType, FilterType))
          : -1;

  params.filterEnvDepth = p ? p[SlotIdx::FilterEnvDepth]
                            : (store_.getRawValue(FilterEnvDepth) / 64.0f);
  params.filterKeyTrack = (p ? p[SlotIdx::FilterKeyTrack]
                             : (store_.getRawValue(FilterKeyTrack) / 64.0f)) *
                          64.0f;
  params.filterVelDepth =
      (p ? p[SlotIdx::FilterCutoffVelocityDepth]
         : (store_.getRawValue(FilterCutoffVelocityDepth) / 64.0f)) *
      64.0f;

  auto &silver = blockRenderer_.getSilverRack();

  // FreqFX
  bool freqFxOn = silverSwitchOn &&
                  (getSlotRaw(p, SlotIdx::FreqFXSwitch, FreqFXSwitch) > 0.5f);
  silver.getFreqFX().setEnabled(freqFxOn);
  int freqFxAlgo =
      static_cast<int>(getSlotRaw(p, SlotIdx::CurFreqFX, CurFreqFX));
  silver.getFreqFX().setAlgorithm(freqFxAlgo);

  if (freqFxAlgo == 0) { // EQ 4-Band & Compressor
    silver.getFreqFX().setEQParams(
        store_.getRawValue(EQ_Switch) > 0.5f,
        store_.getRawValue(EQ_LowShelfSwitch) > 0.5f,
        store_.getRawValue(EQ_LowShelfGain),
        store_.getNormalizedValue(EQ_LowShelfFreq),
        store_.getNormalizedValue(EQ_LowShelfSlope),
        store_.getRawValue(EQ_Band1Switch) > 0.5f,
        store_.getRawValue(EQ_Band1Gain),
        store_.getNormalizedValue(EQ_Band1Freq),
        store_.getNormalizedValue(EQ_Band1Q),
        store_.getRawValue(EQ_Band2Switch) > 0.5f,
        store_.getRawValue(EQ_Band2Gain),
        store_.getNormalizedValue(EQ_Band2Freq),
        store_.getNormalizedValue(EQ_Band2Q),
        store_.getRawValue(EQ_HighShelfSwitch) > 0.5f,
        store_.getRawValue(EQ_HighShelfGain),
        store_.getNormalizedValue(EQ_HighShelfFreq),
        store_.getNormalizedValue(EQ_HighShelfSlope));
    silver.getFreqFX().setCompressorParams(
        store_.getRawValue(CR_Switch) > 0.5f, store_.getRawValue(CR_Threshold),
        store_.getRawValue(CR_OutGain),
        store_.getNormalizedValue(CR_Responsiveness));
  } else if (freqFxAlgo == 1) { // Distortion
    float inGain = store_.getNormalizedValue(DS_InGain);
    float preFilt = store_.getNormalizedValue(DS_PreFilter);
    int curve = static_cast<int>(store_.getRawValue(DS_ClipCurveType));
    float outGain = store_.getNormalizedValue(DS_OutGain);
    silver.getFreqFX().setDistortionParams(inGain, preFilt, curve, outGain);
  } else if (freqFxAlgo == 2) { // Ring Modulator
    float mix = store_.getNormalizedValue(RM_Mix);
    float speed = 0.1f + store_.getNormalizedValue(RM_Speed) * 19.9f;
    float depth = store_.getNormalizedValue(RM_Depth);
    int wave = static_cast<int>(store_.getRawValue(RM_WaveForm));
    float modFreq = 20.0f + store_.getNormalizedValue(RM_ModFreq) * 3000.0f;
    float xoDel = store_.getNormalizedValue(RM_XoverDelay) *
                  store_.getNormalizedValue(RM_XoverTime);
    float xoFb = store_.getRawValue(RM_XoverDelayFeedback) / 64.0f;
    silver.getFreqFX().setRingModParams(mix, speed, depth, wave, modFreq, xoDel,
                                        xoFb);
  } else if (freqFxAlgo == 3) { // Decimator
    float mix = store_.getNormalizedValue(DC_Mix);
    int sh =
        1 + static_cast<int>(store_.getNormalizedValue(DC_SHFactor) * 31.0f);
    float cut = store_.getNormalizedValue(DC_PreFilterCutoff);
    silver.getFreqFX().setDecimatorParams(mix, sh, cut);
  } else if (freqFxAlgo == 4) { // Spectral Warp
    float mix = store_.getNormalizedValue(SW_Mix);
    float freq = store_.getNormalizedValue(SW_Frequency);
    float tilt = store_.getNormalizedValue(SW_Tilt);
    float damp = store_.getNormalizedValue(SW_Damping);
    float speed = 0.1f + store_.getNormalizedValue(SW_Speed) * 19.9f;
    float depth = store_.getNormalizedValue(SW_Depth);
    silver.getFreqFX().setSpWarpParams(mix, freq, tilt, damp, speed, depth);
  }

  // TimeFX
  bool timeFxOn = silverSwitchOn &&
                  (getSlotRaw(p, SlotIdx::TimeFXSwitch, TimeFXSwitch) > 0.5f);
  silver.getTimeFX().setEnabled(timeFxOn);
  int timeFxAlgo =
      static_cast<int>(getSlotRaw(p, SlotIdx::CurTimeFX, CurTimeFX));
  silver.getTimeFX().setAlgorithm(timeFxAlgo);

  if (timeFxAlgo == 0) { // Stereo Spread
    float delay = store_.getRawValue(SS_ChanDelay);
    float fdbk = store_.getRawValue(SS_Feedback) / 64.0f;
    silver.getTimeFX().setStereoSpreadParams(delay, fdbk);
  } else if (timeFxAlgo == 1) { // L/R Delay
    float mix = store_.getNormalizedValue(LRD_Mix);
    float timeMs = store_.getRawValue(LRD_Time);
    float fdbk = store_.getRawValue(LRD_Feedback) / 64.0f;
    silver.getTimeFX().setLRDelayParams(mix, timeMs, fdbk);
  } else if (timeFxAlgo == 2) { // Flanger
    float mix = store_.getNormalizedValue(FL_Mix);
    float depth = store_.getNormalizedValue(FL_Depth);
    float speed = 0.1f + store_.getNormalizedValue(FL_Speed) * 15.0f;
    int wave = static_cast<int>(store_.getRawValue(FL_WaveForm));
    float fdbk = store_.getRawValue(FL_Feedback) / 64.0f;
    float stPhase = store_.getNormalizedValue(FL_StereoPhase);
    silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave,
                                           stPhase, 0.0f);
  } else if (timeFxAlgo == 3) { // Phaser
    float mix = store_.getNormalizedValue(PH_Mix);
    float depth = store_.getNormalizedValue(PH_Depth);
    float speed = 0.1f + store_.getNormalizedValue(PH_Speed) * 15.0f;
    int wave = static_cast<int>(store_.getRawValue(PH_WaveForm));
    float fdbk = store_.getRawValue(PH_Feedback) / 64.0f;
    float stPhase = store_.getNormalizedValue(PH_StereoPhase);
    silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave,
                                           stPhase, 0.0f);
  } else if (timeFxAlgo == 4) { // Chorus
    float mix = store_.getNormalizedValue(CH_Mix);
    float depth = store_.getNormalizedValue(CH_Depth);
    float speed = 0.1f + store_.getNormalizedValue(CH_Speed) * 15.0f;
    int wave = static_cast<int>(store_.getRawValue(CH_WaveForm));
    float fdbk = store_.getRawValue(CH_Feedback) / 64.0f;
    float preDel = store_.getNormalizedValue(CH_PreDelay);
    float stPhase = store_.getNormalizedValue(CH_StereoPhase);
    silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave,
                                           stPhase, preDel);
  }

  // Master FX
  bool mfxMasterOn = store_.getRawValue(SoundMFXSwitch) > 0.5f;
  auto &mTime = blockRenderer_.getMasterTimeFX();
  mTime.setMasterEnabled(mfxMasterOn);
  mTime.setDelayEnabled(store_.getRawValue(SoundMFXDelaySwitch) > 0.5f);
  mTime.setReverbEnabled(store_.getRawValue(SoundMFXReverbSwitch) > 0.5f);

  float dMix = store_.getNormalizedValue(SoundMFXDelayMix);
  float dL = store_.getRawValue(SoundMFXDelayLTime);
  float dR = store_.getRawValue(SoundMFXDelayRTime);
  float dFb = store_.getRawValue(SoundMFXDelayFeedback) / 64.0f;
  float dDamp = store_.getNormalizedValue(SoundMFXDelayFdbkDamp);
  mTime.setDelayParameters(dMix, dL, dR, dFb, dDamp);

  float rMix = store_.getNormalizedValue(SoundMFXReverbMix);
  int rRoom = static_cast<int>(store_.getRawValue(SoundMFXReverbRoom));
  float rDecay = store_.getNormalizedValue(SoundMFXRevDecayTime);
  float rDiff = store_.getNormalizedValue(SoundMFXRevDiffusion);
  float rDamp = store_.getNormalizedValue(SoundMFXRevHFDamp);
  mTime.setReverbParameters(rMix, rRoom, rDecay, rDiff, rDamp);

  auto &mMod = blockRenderer_.getMasterModFX();
  mMod.setEnabled(mfxMasterOn);
  float rDetune = store_.getNormalizedValue(SoundMFXRevDetune);
  float rSpeed = store_.getNormalizedValue(SoundMFXRevSpeed);
  mMod.setParameters(rDetune * 0.35f, 0.2f + rSpeed * 2.5f, 0.5f);

  return params;
}

void DspEngineFacade::applyAntiPop(float *leftChannel, float *rightChannel,
                                   size_t numSamples) {
  if (antiPopRemaining_ == 0 || leftChannel == nullptr)
    return;

  size_t fadeSamples = std::min(numSamples, antiPopRemaining_);
  for (size_t i = 0; i < fadeSamples; ++i) {
    float gain = 1.0f - (static_cast<float>(antiPopRemaining_) /
                         static_cast<float>(antiPopTotalSamples_));
    leftChannel[i] *= gain;
    if (rightChannel != nullptr && rightChannel != leftChannel) {
      rightChannel[i] *= gain;
    }
    --antiPopRemaining_;
  }
}

void DspEngineFacade::updatePeaksAndTelemetry(const float *leftChannel,
                                              const float *rightChannel,
                                              size_t numSamples,
                                              float instantLoad) {
  float maxL = 0.0f;
  float maxR = 0.0f;
  for (size_t i = 0; i < numSamples; ++i) {
    float al = std::abs(leftChannel[i]);
    if (al > maxL)
      maxL = al;
    if (rightChannel != nullptr) {
      float ar = std::abs(rightChannel[i]);
      if (ar > maxR)
        maxR = ar;
    }
  }
  peakL_ = maxL;
  peakR_ = (rightChannel != nullptr) ? maxR : maxL;
  activeVoices_ = voicePool_.getActiveVoiceCount() +
                  expandedSynths_[0].getActiveVoiceCount() +
                  expandedSynths_[1].getActiveVoiceCount();

  // Real measured CPU load smoothed with 1-pole IIR filter
  cpuUsage_ = cpuUsage_ * 0.9f + instantLoad * 0.1f;
}

void DspEngineFacade::process(float *leftChannel, float *rightChannel,
                              size_t numSamples) {
  if (leftChannel == nullptr || numSamples == 0)
    return;

#ifndef __EMSCRIPTEN__
  auto startTime = std::chrono::steady_clock::now();
#endif

  // 1. Process recorded vector stick automation
  processVectorSticks(numSamples);

  // 2. Fetch parameters (dual-path precedence: bridge effective slots > store)
  const float *p = bridge_ ? bridge_->getEffectiveSlots() : nullptr;

  // 3. Modulation & Pitch
  float globalLfoSignal = updateModulationAndPitch(p, numSamples);

  // 4. Resynator Layers & Envelopes
  updateResynatorLayers(p, globalLfoSignal);
  updateEnvelopes(p);

  // 5. Silver Rack & Master FX routing
  auto renderParams = updateSilverAndMasterFx(p, globalLfoSignal);

  // 6. Block render (classic voicePool + Fase B Expanded Synthesizers injected before Blender/Slicer/Silver/MasterFX)
  blockRenderer_.process(leftChannel, rightChannel, numSamples, voicePool_,
                         renderParams.blenderNorm, renderParams.blenderType,
                         renderParams.slicerType, renderParams.slicerDepth,
                         renderParams.slicerRateHz, renderParams.slicerWave,
                         renderParams.filterType, renderParams.cutoffHz,
                         renderParams.resonance, renderParams.filterEnvDepth,
                         renderParams.filterKeyTrack,
                         renderParams.filterVelDepth, masterVolume_);

  // 7. Sample-accurate anti-pop fade
  applyAntiPop(leftChannel, rightChannel, numSamples);

  // 8. Performance telemetry
#ifndef __EMSCRIPTEN__
  auto endTime = std::chrono::steady_clock::now();
  float elapsedSec = std::chrono::duration<float>(endTime - startTime).count();
  float blockSec =
      static_cast<float>(numSamples) / static_cast<float>(sampleRate_);
  float instantLoad = (blockSec > 0.0f) ? (elapsedSec / blockSec) : 0.0f;
#else
  float instantLoad = static_cast<float>(voicePool_.getActiveVoiceCount()) * 0.015f;
#endif

  updatePeaksAndTelemetry(leftChannel, rightChannel, numSamples, instantLoad);
}

Telemetry DspEngineFacade::getTelemetry() const noexcept {
  Telemetry t;
  t.cpuUsage = cpuUsage_;
  t.activeVoices = activeVoices_;
  t.peakL = peakL_;
  t.peakR = peakR_;
  return t;
}

} // namespace abd::axionik
