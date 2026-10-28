// ============================================================================
// ABDAxionikVS — PluginEditor.cpp
// Implementación del editor WebView2 con enlace al dev server y a WebUI/dist/
// ============================================================================

#include "PluginEditor.h"
#include "AppLogger.h"
#include "Generated/BuildVersion.gen.h"
#include <WebView2Bridge/WebView2ResourceProvider.h>

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
    setResizeLimits(800, 560, 2400, 1680);
    setSize(1000, 700);

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
    if (type == "PARAM_SET") {
        int index = static_cast<int>(obj->getProperty("index"));
        float value = static_cast<float>(obj->getProperty("value"));
        // Pasa a través de la capa de abstracción de parámetros de AxionikProcessor (APVTS + Host automation)
        processor_.setParameterByIndex(static_cast<uint32_t>(index), value);
    } else if (type == "NOTE_ON") {
        int note = static_cast<int>(obj->getProperty("note"));
        float vel = static_cast<float>(obj->getProperty("velocity"));
        processor_.getDspEngine().noteOn(static_cast<uint8_t>(note), vel > 0.0f ? vel : 0.8f);
    } else if (type == "NOTE_OFF") {
        int note = static_cast<int>(obj->getProperty("note"));
        processor_.getDspEngine().noteOff(static_cast<uint8_t>(note));
    } else if (type == "ALL_NOTES_OFF") {
        processor_.getDspEngine().allNotesOff();
    } else if (type == "LOAD_PRESET_SCRIPT") {
        juce::String script = obj->getProperty("script").toString();
        processor_.loadPresetFromScript(script.toStdString());
    } else if (type == "LOAD_PRESET_SLOT") {
        int slot = static_cast<int>(obj->getProperty("slot"));
        processor_.loadPresetBySlot(slot);
    } else if (type == "LOAD_MODEL_SLOT") {
        int slot = static_cast<int>(obj->getProperty("slot"));
        int resynator = static_cast<int>(obj->getProperty("resynator"));
        processor_.loadModelBySlot(resynator - 1, slot);
    } else if (type == "INIT_PRESET") {
        processor_.initPreset();
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
    } else if (type == "SET_ORACLE_CLIP_MODE") {
        bool enabled = static_cast<bool>(obj->getProperty("enabled"));
        processor_.getDspEngine().setOracleClipToZeroMode(enabled);
    } else if (type == "SCAN_BANK" || type == "REFRESH_BANK") {
        sendBankCatalogSync();
    } else if (type == "UI_READY") {
        isUiReady_ = true;
        AX_LOG("[EDITOR] WebUI reported UI_READY!");
        sendBankCatalogSync();
    }
}

void AxionikEditor::sendBankCatalogSync() {
    if (webComponent_ == nullptr) return;
    auto json = processor_.getNeuronDbCatalogJson();
    AX_LOG(juce::String("[BRIDGE OUT] Sending BANK_CATALOG_SYNC (JSON len: ") + juce::String(json.length()) + ")");
    juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                      "  window.WebBridge.notify(" + json + "); }";
    webComponent_->getWebBrowser().evaluateJavascript(js);
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
            sendBankCatalogSync();
        } else {
            return;
        }
    }

    // 1. Notificación de telemetría (CPU, voces polifónicas y picos estéreo)
    auto telemetry = processor_.getDspEngine().getTelemetry();
    juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                      "  window.WebBridge.notify({ type: 'TELEMETRY', cpuUsage: " + juce::String(telemetry.cpuUsage) +
                      ", activeVoices: " + juce::String(telemetry.activeVoices) +
                      ", peakL: " + juce::String(telemetry.peakL, 3) +
                      ", peakR: " + juce::String(telemetry.peakR, 3) + " }); ";

    // 3. Notificación de carga de preset / modelo
    auto presetEvt = processor_.drainPendingPresetEvent();
    if (presetEvt.hasEvent) {
        AX_LOG(juce::String("[BRIDGE OUT] Sending PRESET_LOADED: '") + presetEvt.name +
               "' (R1: " + juce::String(presetEvt.r1Model) + ", R2: " + juce::String(presetEvt.r2Model) + ")");

        const auto& store = processor_.getDspEngine().getStore();
        juce::String valuesJson = "[";
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            if (i > 0) valuesJson += ",";
            valuesJson += juce::String(store.getRawValue(i), 2);
        }
        valuesJson += "]";

        js += "  window.WebBridge.notify({ type: 'PRESET_LOADED', name: '" + presetEvt.name.replace("'", "\\'") +
              "', r1Model: " + juce::String(presetEvt.r1Model) +
              ", r2Model: " + juce::String(presetEvt.r2Model) +
              ", values: " + valuesJson + " }); ";
    } else {
        // 2. Notificaciones de parámetros individuales modificados por Host Automation, MIDI CC o NRPN
        auto pending = processor_.drainPendingUiParamChanges();
        for (const auto& change : pending) {
            js += "  window.WebBridge.notify({ type: 'PARAM_UPDATE', index: " + juce::String(change.index) +
                  ", value: " + juce::String(change.value) + " }); ";
        }
    }

    js += "}";
    webComponent_->getWebBrowser().evaluateJavascript(js);
}

} // namespace abd::axionik
