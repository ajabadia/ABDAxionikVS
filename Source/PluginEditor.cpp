// ============================================================================
// ABDAxionikVS — PluginEditor.cpp
// Implementación del editor WebView2 con enlace al dev server y a WebUI/dist/
// ============================================================================

#include "PluginEditor.h"
#include "AppLogger.h"
#include "Generated/BuildVersion.gen.h"
#include <WebView2Bridge/WebView2ResourceProvider.h>
#include <cmath>

#if JUCE_WINDOWS
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#endif

namespace abd::axionik {

namespace {

bool isDevServerReachable(const juce::URL& url) {
    const auto options = juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
                             .withHttpRequestCmd("HEAD")
                             .withConnectionTimeoutMs(200)
                             .withNumRedirectsToFollow(0);

    auto stream = url.createInputStream(options);
    if (stream == nullptr) return false;

    if (auto* webStream = dynamic_cast<juce::WebInputStream*>(stream.get())) {
        return webStream->getStatusCode() == 200;
    }
    return true;
}

juce::String getWebUiDevServerUrl() {
    // Si el usuario especificó una URL explícita por variable de entorno:
    juce::String envUrl = juce::SystemStats::getEnvironmentVariable("ABDAXIONIK_DEV_URL", "").trim();
    if (envUrl.isNotEmpty() && envUrl != "0" && !envUrl.equalsIgnoreCase("off")) {
        return envUrl;
    }
    // Sondeo al puerto por defecto de Vite configurado en vite.config.ts (5320):
    const juce::URL devUrl("http://localhost:5320");
    if (isDevServerReachable(devUrl)) {
        AX_LOG("[EDITOR] Vite dev server detectado en http://localhost:5320 (HMR activo)");
        return "http://localhost:5320";
    }
    return {};
}

juce::File getAndPrepareWebView2UserDataFolder() {
#if JUCE_WINDOWS
    const auto pid = static_cast<uint32_t>(::GetCurrentProcessId());
#else
    const auto pid = static_cast<uint32_t>(juce::Time::getMillisecondCounter());
#endif

    juce::File baseFolder;
    juce::String envFolder = juce::SystemStats::getEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", "").trim();
    if (envFolder.isNotEmpty()) {
        baseFolder = juce::File(envFolder);
    } else {
        baseFolder = juce::File::getSpecialLocation(juce::File::tempDirectory)
                         .getChildFile("ABD_AxionikVS_WebView2");
    }

    // Aislamiento obligatorio por PID de proceso para evitar bloqueos por instancias huerfanas de msedgewebview2.exe
    juce::File pidFolder = baseFolder.getChildFile(juce::String(pid));
    pidFolder.createDirectory();
    return pidFolder;
}

std::optional<juce::WebBrowserComponent::Resource> axionikResourceProvider(const juce::String& url) {
    AX_LOG(juce::String("[RESOURCE] Requested: ") + url);

    juce::File thisFile(__FILE__);
    juce::File projectDir = thisFile.getParentDirectory().getParentDirectory();
    juce::File webUiDir = projectDir.getChildFile("WebUI");

    if (!webUiDir.exists()) {
        juce::File exeDir = juce::File::getSpecialLocation(juce::File::currentExecutableFile).getParentDirectory();
        webUiDir = exeDir.getChildFile("WebUI");
    }

    juce::String decodedPath = abd::webview2::normalizeResourcePath(url);
    AX_LOG(juce::String("[RESOURCE] Normalized path: ") + decodedPath);

    // 1. Bundle de Vite (WebUI/dist): prioridad máxima si existe
    juce::File distDir = webUiDir.getChildFile("dist");
    if (distDir.isDirectory()) {
        juce::File distFile = distDir.getChildFile(decodedPath.replace("/", "\\"));
        if (distFile.existsAsFile()) {
            juce::MemoryBlock mb;
            distFile.loadFileAsData(mb);
            std::vector<std::byte> data(mb.getSize());
            std::memcpy(data.data(), mb.getData(), mb.getSize());
            auto mime = abd::webview2::getMimeTypeForFilename(distFile.getFileName()).toStdString();
            AX_LOG(juce::String("[RESOURCE] Served from dist: ") + distFile.getFullPathName() + " (" + juce::String(mb.getSize()) + " bytes, " + mime + ")");
            return juce::WebBrowserComponent::Resource{
                std::move(data),
                std::move(mime)
            };
        }
    }

    // 2. Archivo crudo en WebUI/
    juce::File rawFile = webUiDir.getChildFile(decodedPath.replace("/", "\\"));
    if (rawFile.existsAsFile()) {
        juce::MemoryBlock mb;
        rawFile.loadFileAsData(mb);
        std::vector<std::byte> data(mb.getSize());
        std::memcpy(data.data(), mb.getData(), mb.getSize());
        auto mime = abd::webview2::getMimeTypeForFilename(rawFile.getFileName()).toStdString();
        AX_LOG(juce::String("[RESOURCE] Served from raw WebUI: ") + rawFile.getFullPathName() + " (" + juce::String(mb.getSize()) + " bytes, " + mime + ")");
        return juce::WebBrowserComponent::Resource{
            std::move(data),
            std::move(mime)
        };
    }

    AX_LOG(juce::String("[RESOURCE] Not found for url: ") + url);
    return std::nullopt;
}

} // namespace

AxionikEditor::AxionikEditor(AxionikProcessor& p)
    : AudioProcessorEditor(&p), processor_(p)
{
    AX_LOG("[EDITOR] AxionikEditor constructor start.");
    const juce::File userDataFolder = getAndPrepareWebView2UserDataFolder();
    AX_LOG(juce::String("[EDITOR] Using WebView2 userDataFolder: ") + userDataFolder.getFullPathName());

    auto options = juce::WebBrowserComponent::Options{}
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled(true)
        .withWinWebView2Options(juce::WebBrowserComponent::Options::WinWebView2()
            .withUserDataFolder(userDataFolder)
            .withBackgroundColour(juce::Colour(0xff12141a)))
        .withResourceProvider(axionikResourceProvider)
        .withEventListener("nativeEvent", [this](const juce::var& msg) {
            handleJsEvent(msg);
        });

    auto initialUrl = juce::WebBrowserComponent::getResourceProviderRoot();
    AX_LOG(juce::String("[EDITOR] Creating JuceWebView2Component with initial URL: ") + initialUrl);

    try {
        webComponent_ = std::make_unique<abd::webview2::JuceWebView2Component>(options, "dark", initialUrl);
        addAndMakeVisible(*webComponent_);
    } catch (const std::exception& e) {
        AX_LOG(juce::String("[EDITOR CRITICAL] Failed to create WebView2 component: ") + e.what());
    } catch (...) {
        AX_LOG("[EDITOR CRITICAL] Unknown exception while creating WebView2 component.");
    }

    setResizable(true, true);
    setResizeLimits(960, 600, 2560, 1800);
    setSize(1340, 740);

    // Arrancar timer de telemetría a 30 Hz
    startTimerHz(30);
    AX_LOG("[EDITOR] AxionikEditor constructor finished successfully.");
}

AxionikEditor::~AxionikEditor() {
    stopTimer();
}

void AxionikEditor::handleJsEvent(const juce::var& msg) {
    if (!msg.isObject()) return;
    auto* obj = msg.getDynamicObject();
    if (!obj) return;

    juce::String type = obj->getProperty("type").toString();
    AX_LOG(juce::String("[BRIDGE IN] Event: ") + type);
    if (type == "PARAM_GESTURE_BEGIN") {
        int index = static_cast<int>(obj->getProperty("index"));
        processor_.beginParameterGestureByIndex(static_cast<uint32_t>(index));
    } else if (type == "PARAM_GESTURE_END") {
        int index = static_cast<int>(obj->getProperty("index"));
        processor_.endParameterGestureByIndex(static_cast<uint32_t>(index));
    } else if (type == "PARAM_SET") {
        int index = static_cast<int>(obj->getProperty("index"));
        float value = static_cast<float>(obj->getProperty("value"));
        // Pasa a través de la capa de abstracción de parámetros de AxionikProcessor (APVTS + Host automation)
        processor_.setParameterByIndex(static_cast<uint32_t>(index), value);
    } else if (type == "NOTE_ON") {
        int note = static_cast<int>(obj->getProperty("note"));
        float vel = static_cast<float>(obj->getProperty("velocity"));
        const juce::ScopedLock sl(processor_.getCallbackLock());
        processor_.getDspEngine().noteOn(static_cast<uint8_t>(note), vel > 0.0f ? vel : 0.8f);
    } else if (type == "NOTE_OFF") {
        int note = static_cast<int>(obj->getProperty("note"));
        const juce::ScopedLock sl(processor_.getCallbackLock());
        processor_.getDspEngine().noteOff(static_cast<uint8_t>(note));
    } else if (type == "ALL_NOTES_OFF") {
        const juce::ScopedLock sl(processor_.getCallbackLock());
        processor_.getDspEngine().allNotesOff();
    } else if (type == "LOAD_PRESET_SCRIPT") {
        juce::String script = obj->getProperty("script").toString();
        processor_.loadPresetFromScript(script.toStdString());
        sendResynatorShapersState(0);
        sendResynatorShapersState(1);
    } else if (type == "LOAD_PRESET_SLOT") {
        int slot = static_cast<int>(obj->getProperty("slot"));
        processor_.loadPresetBySlot(slot);
        sendResynatorShapersState(0);
        sendResynatorShapersState(1);
    } else if (type == "LOAD_MODEL_SLOT") {
        int slot = static_cast<int>(obj->getProperty("slot"));
        int resynator = static_cast<int>(obj->getProperty("resynator"));
        int targetSlot = (resynator == 2) ? 1 : 0;
        processor_.loadModelBySlot(targetSlot, slot);
        sendResynatorShapersState(targetSlot);
    } else if (type == "INIT_PRESET") {
        processor_.initPreset();
        sendResynatorShapersState(0);
        sendResynatorShapersState(1);
    } else if (type == "SET_RESYNATOR_SHAPERS") {
        int resynator = static_cast<int>(obj->getProperty("resynator"));
        int slot = (resynator == 2) ? 1 : 0;
        if (auto* shapersObj = obj->getProperty("shapers").getDynamicObject()) {
            auto readFloat = [&](const char* key, float fallback) {
                const juce::var value = shapersObj->getProperty(key);
                if (!value.isInt() && !value.isDouble()) return fallback;
                const double number = static_cast<double>(value);
                return std::isfinite(number) ? static_cast<float>(number) : fallback;
            };
            extended::AxionikResonatorShapers shapers;
            shapers.inharmonicityB = juce::jlimit(0.0f, 1.0f, readFloat("inharmonicityB", shapers.inharmonicityB));
            shapers.parity = juce::jlimit(-1.0f, 1.0f, readFloat("parity", shapers.parity));
            shapers.entropyRoughness = juce::jlimit(0.0f, 1.0f, readFloat("entropyRoughness", shapers.entropyRoughness));
            shapers.spectralShiftHz = juce::jlimit(-4000.0f, 4000.0f, readFloat("spectralShiftHz", shapers.spectralShiftHz));
            shapers.hfRollOffDbPerOct = juce::jlimit(-24.0f, 0.0f, readFloat("hfRollOffDbPerOct", shapers.hfRollOffDbPerOct));
            shapers.formantShiftSt = juce::jlimit(-24.0f, 24.0f, readFloat("formantShiftSt", shapers.formantShiftSt));
            shapers.formantPreserve = juce::jlimit(0.0f, 1.0f, readFloat("formantPreserve", shapers.formantPreserve));
            shapers.residualMix = juce::jlimit(0.0f, 1.0f, readFloat("residualMix", shapers.residualMix));
            shapers.spatialSpread = juce::jlimit(0.0f, 1.0f, readFloat("spatialSpread", shapers.spatialSpread));
            {
                const juce::ScopedLock sl(processor_.getCallbackLock());
                processor_.getDspEngine().setActiveResonatorShapers(slot, shapers);
            }
        }
        sendResynatorShapersState(slot);
    } else if (type == "PITCH_BEND") {
        float val = static_cast<float>(obj->getProperty("value"));
        processor_.setMidiPitchBend(val);
    } else if (type == "MOD_WHEEL") {
        float val = static_cast<float>(obj->getProperty("value"));
        processor_.setMidiController(kMidiCCModulation, val);
    } else if (type == "CHANNEL_PRESSURE" || type == "AFTERTOUCH") {
        float val = static_cast<float>(obj->getProperty("value"));
        processor_.setMidiChannelPressure(val);
    } else if (type == "MIDI_CC") {
        int cc = static_cast<int>(obj->getProperty("cc"));
        float val = static_cast<float>(obj->getProperty("value"));
        float normVal = val > 1.0f ? (val / 127.0f) : val;
        processor_.setMidiController(cc, normVal);
    } else if (type == "SET_MASTER_VOLUME") {
        float vol = static_cast<float>(obj->getProperty("volume"));
        processor_.getDspEngine().setMasterVolume(vol);
    } else if (type == "SET_ORACLE_CLIP_MODE") {
        bool enabled = static_cast<bool>(obj->getProperty("enabled"));
        processor_.getDspEngine().setOracleClipToZeroMode(enabled);
    } else if (type == "MIDI_LEARN_SYNC") {
        processor_.getMidiLearnManager().loadFromVar(msg, false);
    } else if (type == "MIDI_LEARN_START") {
        int targetIdx = static_cast<int>(obj->getProperty("targetIndex"));
        juce::String targetKey = obj->getProperty("targetKey").toString();
        juce::String modeStr = obj->getProperty("mode").toString();
        auto mode = (modeStr == "add") ? abd::hw::MidiLearnManager::LearnMode::Add
                                       : abd::hw::MidiLearnManager::LearnMode::Replace;
        processor_.getMidiLearnManager().startLearning(targetIdx, targetKey, mode);
    } else if (type == "MIDI_LEARN_CANCEL") {
        processor_.getMidiLearnManager().cancelLearning();
    } else if (type == "HARDWARE_GET_PORT_STATUS") {
        if (webComponent_ != nullptr) {
            juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                              "  window.WebBridge.notify({ type: 'HARDWARE_PORT_STATUS', status: { connected: true, name: 'Host DAW / JUCE MIDI Bus', deviceId: 0 } }); }";
            webComponent_->getWebBrowser().evaluateJavascript(js);
        }
    } else if (type == "HARDWARE_SET_DEVICE_ID" || type == "HARDWARE_TX_DUMP_REQUEST" || type == "HARDWARE_RX_DUMP_SEND_REQUEST" || type == "HARDWARE_DUMP_DISCARD" || type == "HARDWARE_FLUSH_ACTIVE_XFERS") {
        AX_LOG(juce::String("[SYSEX BRIDGE] Handled hardware request: ") + type);
    } else if (type == "CALIBRATION_SET") {
        juce::String paramId = obj->getProperty("id").toString();
        float val = static_cast<float>(obj->getProperty("value"));
        const juce::ScopedLock sl(processor_.getCallbackLock());
        processor_.getDspEngine().setCalibrationParam(paramId.toStdString(), val);
    } else if (type == "CALIBRATION_RESET") {
        juce::String paramId = obj->getProperty("id").toString();
        const juce::ScopedLock sl(processor_.getCallbackLock());
        processor_.getDspEngine().resetCalibrationParam(paramId.toStdString());
    } else if (type == "CALIBRATION_RESET_ALL") {
        const juce::ScopedLock sl(processor_.getCallbackLock());
        processor_.getDspEngine().resetAllCalibrationParams();
    } else if (type == "CALIBRATION_SYNC") {
        if (auto* valuesObj = obj->getProperty("values").getDynamicObject()) {
            const juce::ScopedLock sl(processor_.getCallbackLock());
            for (const auto& prop : valuesObj->getProperties()) {
                processor_.getDspEngine().setCalibrationParam(
                    prop.name.toString().toStdString(),
                    static_cast<float>(prop.value));
            }
        }
    } else if (type == "SET_ENGINE_MODE") {
        juce::String mode = obj->getProperty("mode").toString();
        bool ok = false;
        {
            const juce::ScopedLock sl(processor_.getCallbackLock());
            ok = processor_.getDspEngine().setEngineMode(mode.toStdString());
        }
        if (webComponent_ != nullptr) {
            auto activeSv = processor_.getDspEngine().getEngineMode();
            auto compileSv = DspEngineFacade::getCompileTargetMode();
            juce::String activeMode(activeSv.data(), activeSv.size());
            juce::String compileMode(compileSv.data(), compileSv.size());
            juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                              "  window.WebBridge.notify({ type: 'ENGINE_MODE_CHANGED', mode: '" + activeMode +
                              "', compileTargetMode: '" + compileMode + "', ok: " + (ok ? "true" : "false") + " }); }";
            webComponent_->getWebBrowser().evaluateJavascript(js);
        }
    } else if (type == "LOAD_EXPANDED_MODEL_JSON") {
        int resynator = static_cast<int>(obj->getProperty("resynator"));
        int slot = (resynator == 2) ? 1 : 0;
        juce::String jsonText = obj->getProperty("json").toString();
        extended::AxionikExpandedPreflightReport report;
        bool ok = false;
        juce::String modelName = "Expanded Model";
        {
            const juce::ScopedLock sl(processor_.getCallbackLock());
            ok = processor_.getDspEngine().loadExpandedModelFromJson(slot, jsonText.toStdString(), &report);
            if (ok && processor_.getDspEngine().getExpandedModelDoc(slot) != nullptr) {
                modelName = processor_.getDspEngine().getExpandedModelDoc(slot)->identity.expandedName;
            }
        }
        if (webComponent_ != nullptr) {
            juce::String firstError = report.errors.empty() ? "" : juce::String(report.errors.front()).replace("'", "\\'");
            juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                              "  window.WebBridge.notify({ type: 'EXPANDED_MODEL_PREFLIGHT', resynator: " + juce::String(slot + 1) +
                              ", ok: " + (ok ? "true" : "false") +
                              ", modelName: '" + modelName.replace("'", "\\'") + "'" +
                              ", adaptationsCount: " + juce::String(static_cast<int>(report.adaptations.size())) +
                              ", firstError: '" + firstError + "' }); }";
            webComponent_->getWebBrowser().evaluateJavascript(js);
        }
        sendResynatorShapersState(slot);
    } else if (type == "LOAD_EXPANDED_MODEL_SLUG") {
        int resynator = static_cast<int>(obj->getProperty("resynator"));
        int slot = (resynator == 2) ? 1 : 0;
        juce::String slug = obj->getProperty("slug").toString();
        extended::AxionikExpandedPreflightReport report;
        bool ok = false;
        juce::String modelName = slug;
        {
            const juce::ScopedLock sl(processor_.getCallbackLock());
            ok = processor_.getDspEngine().loadExpandedModelBySlug(slot, slug.toStdString(), &report);
            if (ok && processor_.getDspEngine().getExpandedModelDoc(slot) != nullptr) {
                modelName = processor_.getDspEngine().getExpandedModelDoc(slot)->identity.expandedName;
            }
        }
        if (webComponent_ != nullptr) {
            juce::String firstError = report.errors.empty() ? "" : juce::String(report.errors.front()).replace("'", "\\'");
            juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                              "  window.WebBridge.notify({ type: 'EXPANDED_MODEL_PREFLIGHT', resynator: " + juce::String(slot + 1) +
                              ", ok: " + (ok ? "true" : "false") +
                              ", modelName: '" + modelName.replace("'", "\\'") + "'" +
                              ", adaptationsCount: " + juce::String(static_cast<int>(report.adaptations.size())) +
                              ", firstError: '" + firstError + "' }); }";
            webComponent_->getWebBrowser().evaluateJavascript(js);
        }
        sendResynatorShapersState(slot);
    } else if (type == "SET_BANK_FOLDER_PATH") {
        juce::String bankKind = obj->getProperty("bank").toString();
        juce::String folderPath = obj->getProperty("path").toString();
        {
            const juce::ScopedLock sl(processor_.getCallbackLock());
            if (bankKind == "axionik") {
                processor_.getDspEngine().setAxionikDbPath(folderPath.toStdString());
            } else {
                processor_.getDspEngine().setNeuronDbPath(folderPath.toStdString());
            }
        }
        sendBankCatalogSync();
    } else if (type == "SCAN_BANK" || type == "REFRESH_BANK") {
        if (!isUiReady_) {
            isUiReady_ = true;
            processor_.syncApvtsFromDspEngine();
        }
        sendBankCatalogSync();
    } else if (type == "UI_READY") {
        isUiReady_ = true;
        AX_LOG("[EDITOR] WebUI reported UI_READY!");
        processor_.syncApvtsFromDspEngine();
        sendBankCatalogSync();
        if (webComponent_ != nullptr) {
            auto activeSv = processor_.getDspEngine().getEngineMode();
            auto compileSv = DspEngineFacade::getCompileTargetMode();
            juce::String activeMode(activeSv.data(), activeSv.size());
            juce::String compileMode(compileSv.data(), compileSv.size());
            juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                              "  window.WebBridge.notify({ type: 'ENGINE_MODE_CHANGED', mode: '" + activeMode +
                              "', compileTargetMode: '" + compileMode + "', ok: true }); }";
            webComponent_->getWebBrowser().evaluateJavascript(js);
        }
        sendResynatorShapersState(0);
        sendResynatorShapersState(1);
    } else if (type == "PRESET_DELETE") {
        juce::String presetName = obj->getProperty("name").toString();
        if (presetName.isNotEmpty()) {
            juce::String safeFileName = juce::File::createLegalFileName(presetName) + ".axpreset";
            juce::File presetsDir;
            {
                auto axionikDbPath = processor_.getDspEngine().getBankAdapter().discoverAxionikDbPath();
                if (!axionikDbPath.empty())
                    presetsDir = juce::File(juce::String(axionikDbPath.string())).getChildFile("presets");
            }
            if (presetsDir.getFullPathName().isEmpty()) {
                presetsDir = juce::File::getSpecialLocation(juce::File::userDocumentsDirectory)
                                .getChildFile("ABDAxionikVS").getChildFile("Presets");
            }
            juce::File targetFile = presetsDir.getChildFile(safeFileName);
            bool deleted = false;
            if (targetFile.existsAsFile()) {
                deleted = targetFile.deleteFile();
                AX_LOG(juce::String("[PRESET_DELETE] Deleted preset file: ") + targetFile.getFullPathName() + (deleted ? " (OK)" : " (FAILED)"));
            }
            if (webComponent_ != nullptr) {
                juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                                  "  window.WebBridge.notify({ type: 'PRESET_DELETED_NOTIFICATION', name: '" + presetName.replace("\\", "\\\\").replace("'", "\\'") + "', ok: " + (deleted ? "true" : "false") + " }); }";
                webComponent_->getWebBrowser().evaluateJavascript(js);
            }
        }
    } else if (type == "PRESET_SAVE") {
        juce::String payloadJson = obj->getProperty("payload").toString();
        juce::String presetName;
        {
            juce::var parsedJson;
            auto parseResult = juce::JSON::parse(payloadJson, parsedJson);
            if (parseResult.wasOk() && parsedJson.isObject()) {
                presetName = parsedJson["meta"]["name"].toString();
            }
        }
        if (presetName.isEmpty()) presetName = "Untitled Preset";
        // El nombre viaja dentro de un literal JS entre comillas simples: sanearlo.
        presetName = presetName.replace("\\", "\\\\").replace("'", "\\'").replace("\r", "").replace("\n", "");

        // Sanear nombre de archivo
        juce::String safeFileName = juce::File::createLegalFileName(presetName) + ".axpreset";

        // Carpeta de presets de usuario: AxionikDB/presets si se resuelve, si no Documentos.
        juce::File presetsDir;
        {
            auto axionikDbPath = processor_.getDspEngine().getBankAdapter().discoverAxionikDbPath();
            if (!axionikDbPath.empty())
                presetsDir = juce::File(juce::String(axionikDbPath.string())).getChildFile("presets");
        }
        if (presetsDir.getFullPathName().isEmpty()) {
            presetsDir = juce::File::getSpecialLocation(juce::File::userDocumentsDirectory)
                            .getChildFile("ABDAxionikVS").getChildFile("Presets");
        }
        presetsDir.createDirectory();

        juce::File targetFile = presetsDir.getChildFile(safeFileName);
        bool written = targetFile.replaceWithText(payloadJson);
        AX_LOG(juce::String("[PRESET_SAVE] Saved preset to: ") + targetFile.getFullPathName() + (written ? " (OK)" : " (FAILED)"));

        if (written && webComponent_ != nullptr) {
            juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                              "  window.WebBridge.notify({ type: 'PRESET_SAVED_NOTIFICATION', name: '" + presetName + "', path: '" + targetFile.getFullPathName().replace("\\", "\\\\") + "' }); }";
            webComponent_->getWebBrowser().evaluateJavascript(js);
        }
    }
}

void AxionikEditor::sendResynatorShapersState(int slot) {
    if (webComponent_ == nullptr || slot < 0 || slot > 1) return;

    auto* root = new juce::DynamicObject();
    root->setProperty("type", "RESYNATOR_SHAPERS");
    root->setProperty("resynator", slot + 1);

    const auto* doc = processor_.getDspEngine().getExpandedModelDoc(slot);
    if (doc == nullptr) {
        root->setProperty("ok", false);
    } else {
        const auto shapers = processor_.getDspEngine().getActiveResonatorShapers(slot);
        auto* shapersObj = new juce::DynamicObject();
        shapersObj->setProperty("inharmonicityB", shapers.inharmonicityB);
        shapersObj->setProperty("parity", shapers.parity);
        shapersObj->setProperty("entropyRoughness", shapers.entropyRoughness);
        shapersObj->setProperty("spectralShiftHz", shapers.spectralShiftHz);
        shapersObj->setProperty("hfRollOffDbPerOct", shapers.hfRollOffDbPerOct);
        shapersObj->setProperty("formantShiftSt", shapers.formantShiftSt);
        shapersObj->setProperty("formantPreserve", shapers.formantPreserve);
        shapersObj->setProperty("residualMix", shapers.residualMix);
        shapersObj->setProperty("spatialSpread", shapers.spatialSpread);
        root->setProperty("ok", true);
        root->setProperty("modelName", juce::String(doc->identity.expandedName));
        const juce::String slug(doc->identity.slug);
        if (slug.isNotEmpty() && slug != "untitled") {
            root->setProperty("slug", slug);
        }
        root->setProperty("shapers", juce::var(shapersObj));
    }

    webComponent_->emitEventIfBrowserIsVisible("event", juce::var(root));
}

void AxionikEditor::sendBankCatalogSync() {
    if (webComponent_ == nullptr) return;
    auto json = processor_.getNeuronDbCatalogJson();
    AX_LOG(juce::String("[BRIDGE OUT] Sending BANK_CATALOG_SYNC (JSON len: ") + juce::String(json.length()) + ")");
    auto parsed = juce::JSON::parse(json);
    if (parsed.isObject()) {
        webComponent_->emitEventIfBrowserIsVisible("event", parsed);
    }
}

void AxionikEditor::paint(juce::Graphics& g) {
    g.fillAll(juce::Colour(0xff12141a));
    if (webComponent_ == nullptr) {
        g.setColour(juce::Colours::white);
        g.setFont(16.0f);
        g.drawText("ABDAxionikVS: WebView2 component failed to initialize.\nPlease verify Microsoft Edge WebView2 Runtime is installed.",
                   getLocalBounds().reduced(20), juce::Justification::centred, true);
    }
}

void AxionikEditor::resized() {
    if (webComponent_ != nullptr) {
        webComponent_->setBounds(getLocalBounds());
    }
}

void AxionikEditor::timerCallback() {
    if (webComponent_ == nullptr) return;

    if (!isUiReady_) {
        // No emitir eventos JS hasta que la WebUI señale que está lista.
        // Evita saturación de la cola IPC de WebView2 y el parpadeo del cursor del ratón.
        if (++timerTicks_ > 90) { // Fallback de seguridad tras ~3 segundos
            isUiReady_ = true;
            processor_.syncApvtsFromDspEngine();
            sendBankCatalogSync();
            sendResynatorShapersState(0);
            sendResynatorShapersState(1);
        } else {
            return;
        }
    }

    // 1. Notificación de telemetría (CPU, voces polifónicas y picos estéreo)
    auto telemetry = processor_.getDspEngine().getTelemetry();
    juce::DynamicObject::Ptr telemObj = new juce::DynamicObject();
    telemObj->setProperty("type", "TELEMETRY");
    telemObj->setProperty("cpuUsage", static_cast<double>(telemetry.cpuUsage));
    telemObj->setProperty("activeVoices", static_cast<int>(telemetry.activeVoices));
    telemObj->setProperty("peakL", static_cast<double>(telemetry.peakL));
    telemObj->setProperty("peakR", static_cast<double>(telemetry.peakR));
    webComponent_->emitEventIfBrowserIsVisible("event", juce::var(telemObj.get()));

    // 3. Notificación de carga de preset / modelo
    auto presetEvt = processor_.drainPendingPresetEvent();
    if (presetEvt.hasEvent) {
        (void)processor_.drainPendingUiParamChanges();
        AX_LOG(juce::String("[BRIDGE OUT] Sending PRESET_LOADED: '") + presetEvt.name +
               "' (R1: " + juce::String(presetEvt.r1Model) + ", R2: " + juce::String(presetEvt.r2Model) + ")");

        const auto& store = processor_.getDspEngine().getStore();
        juce::Array<juce::var> valuesArr;
        valuesArr.ensureStorageAllocated(kNumTotalParameters);
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            valuesArr.add(static_cast<double>(store.getRawValue(i)));
        }

        juce::DynamicObject::Ptr preObj = new juce::DynamicObject();
        preObj->setProperty("type", "PRESET_LOADED");
        preObj->setProperty("name", presetEvt.name);
        preObj->setProperty("r1Model", presetEvt.r1Model);
        preObj->setProperty("r2Model", presetEvt.r2Model);
        preObj->setProperty("values", valuesArr);
        webComponent_->emitEventIfBrowserIsVisible("event", juce::var(preObj.get()));

        sendResynatorShapersState(0);
        sendResynatorShapersState(1);
    } else {
        // 2. Notificaciones de parámetros individuales modificados por Host Automation, MIDI CC o NRPN
        auto pending = processor_.drainPendingUiParamChanges();
        for (const auto& change : pending) {
            juce::DynamicObject::Ptr paramObj = new juce::DynamicObject();
            paramObj->setProperty("type", "PARAM_UPDATE");
            paramObj->setProperty("index", static_cast<int>(change.index));
            paramObj->setProperty("value", static_cast<double>(change.value));
            webComponent_->emitEventIfBrowserIsVisible("event", juce::var(paramObj.get()));
        }
    }

    // 4. Sincronización de estado de MIDI Learn
    if (processor_.getMidiLearnManager().drainStateChangedFlag()) {
        auto parsed = juce::JSON::parse(processor_.getMidiLearnManager().toJson());
        if (parsed.isObject()) {
            webComponent_->emitEventIfBrowserIsVisible("event", parsed);
        }
    }

    // 5. Telemetría del último mensaje MIDI entrante
    abd::hw::MidiLearnManager::LastMidiActivity midiAct;
    if (processor_.getMidiLearnManager().drainLastMidiActivity(midiAct)) {
        juce::DynamicObject::Ptr midiObj = new juce::DynamicObject();
        midiObj->setProperty("type", "MIDI_ACTIVITY");
        midiObj->setProperty("sourceType", static_cast<int>(midiAct.sourceType));
        midiObj->setProperty("channel", midiAct.channel);
        midiObj->setProperty("number", midiAct.number);
        midiObj->setProperty("rawValue", midiAct.rawValue);
        midiObj->setProperty("normalizedValue", static_cast<double>(midiAct.normalizedValue));
        webComponent_->emitEventIfBrowserIsVisible("event", juce::var(midiObj.get()));
    }
}

} // namespace abd::axionik
