// ============================================================================
// ABDAxionikVS — PluginEditor.cpp
// Implementación del editor WebView2 con enlace al dev server y a WebUI/dist/
// ============================================================================

#include "PluginEditor.h"
#include "AppLogger.h"
#include "Generated/BuildVersion.gen.h"
#include <WebView2Bridge/WebView2ResourceProvider.h>

namespace abd::axionik {

namespace {

juce::File getAndPrepareWebView2UserDataFolder() {
    juce::File tempFolder = juce::File::getSpecialLocation(juce::File::tempDirectory)
                                .getChildFile("ABD_AxionikVS_WebView2");
    tempFolder.createDirectory();
    return tempFolder;
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

    webComponent_ = std::make_unique<abd::webview2::JuceWebView2Component>(options, "dark", initialUrl);
    addAndMakeVisible(*webComponent_);

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
    if (type == "PARAM_SET") {
        int index = static_cast<int>(obj->getProperty("index"));
        float value = static_cast<float>(obj->getProperty("value"));
        processor_.getDspEngine().setParam(static_cast<uint32_t>(index), value);
    } else if (type == "NOTE_ON") {
        int note = static_cast<int>(obj->getProperty("note"));
        float vel = static_cast<float>(obj->getProperty("velocity"));
        processor_.getDspEngine().noteOn(static_cast<uint8_t>(note), vel > 0.0f ? vel : 0.8f);
    } else if (type == "NOTE_OFF") {
        int note = static_cast<int>(obj->getProperty("note"));
        processor_.getDspEngine().noteOff(static_cast<uint8_t>(note));
    }
}

void AxionikEditor::paint(juce::Graphics& g) {
    g.fillAll(juce::Colour(0xff12141a));
}

void AxionikEditor::resized() {
    if (webComponent_ != nullptr) {
        webComponent_->setBounds(getLocalBounds());
    }
}

void AxionikEditor::timerCallback() {
    if (webComponent_ == nullptr) return;

    auto telemetry = processor_.getDspEngine().getTelemetry();
    juce::String js = "if (window.WebBridge && typeof window.WebBridge.notify === 'function') { "
                      "  window.WebBridge.notify({ type: 'TELEMETRY', cpuUsage: " + juce::String(telemetry.cpuUsage) +
                      ", activeVoices: " + juce::String(telemetry.activeVoices) + " }); }";
    webComponent_->getWebBrowser().evaluateJavascript(js);
}

} // namespace abd::axionik
