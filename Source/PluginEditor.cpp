// ============================================================================
// ABDAxionikVS — PluginEditor.cpp
// Implementación del editor WebView2 con enlace al dev server y a WebUI/dist/
// ============================================================================

#include "PluginEditor.h"
#include <WebView2Bridge/WebView2ResourceProvider.h>

namespace abd::axionik {

static std::optional<juce::WebBrowserComponent::Resource> axionikResourceProvider(const juce::String& url) {
    juce::File thisFile(__FILE__);
    juce::File projectDir = thisFile.getParentDirectory().getParentDirectory();
    juce::File webUiDir = projectDir.getChildFile("WebUI");

    juce::String decodedPath = abd::webview2::normalizeResourcePath(url);

    // 1. Bundle de Vite (WebUI/dist): prioridad máxima si existe
    juce::File distDir = webUiDir.getChildFile("dist");
    if (distDir.isDirectory()) {
        juce::File distFile = distDir.getChildFile(decodedPath.replace("/", "\\"));
        if (distFile.existsAsFile()) {
            juce::MemoryBlock mb;
            distFile.loadFileAsData(mb);
            std::vector<std::byte> data(mb.getSize());
            std::memcpy(data.data(), mb.getData(), mb.getSize());
            return juce::WebBrowserComponent::Resource{
                std::move(data),
                abd::webview2::getMimeTypeForFilename(distFile.getFileName()).toStdString()
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
        return juce::WebBrowserComponent::Resource{
            std::move(data),
            abd::webview2::getMimeTypeForFilename(rawFile.getFileName()).toStdString()
        };
    }

    return std::nullopt;
}

AxionikEditor::AxionikEditor(AxionikProcessor& p)
    : AudioProcessorEditor(&p), processor_(p)
{
    auto options = juce::WebBrowserComponent::Options{}
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled(true)
        .withWinWebView2Options(juce::WebBrowserComponent::Options::WinWebView2()
            .withUserDataFolder(juce::File::getSpecialLocation(juce::File::tempDirectory)
                .getChildFile("ABDAxionikVS_WebView2")))
        .withResourceProvider(axionikResourceProvider);

    auto initialUrl = juce::WebBrowserComponent::getResourceProviderRoot();

    webComponent_ = std::make_unique<abd::webview2::JuceWebView2Component>(options, "dark", initialUrl);
    addAndMakeVisible(*webComponent_);

    setResizable(true, true);
    setResizeLimits(800, 560, 2400, 1680);
    setSize(1000, 700);

    // Arrancar timer de telemetría a 30 Hz
    startTimerHz(30);
}

AxionikEditor::~AxionikEditor() {
    stopTimer();
}

void AxionikEditor::paint(juce::Graphics& g) {
    g.fillAll(juce::Colours::black);
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
