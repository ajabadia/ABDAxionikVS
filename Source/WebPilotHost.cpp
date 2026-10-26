// ============================================================================
// ABDAxionikVS — WebPilotHost.cpp
// Bancada ligera de pruebas E2E para WebView2 y selftest de arranque
// ============================================================================

#include <juce_gui_extra/juce_gui_extra.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace abd::axionik {

class WebPilotWindow : public juce::DocumentWindow {
public:
    WebPilotWindow(juce::String name, bool autoQuit)
        : DocumentWindow(name, juce::Colours::black, DocumentWindow::allButtons),
          autoQuit_(autoQuit)
    {
        setUsingNativeTitleBar(true);
        processor_ = std::make_unique<AxionikProcessor>();
        editor_ = processor_->createEditor();
        setContentOwned(editor_, true);
        setResizable(true, false);
        centreWithSize(getWidth(), getHeight());
        setVisible(true);

        if (autoQuit_) {
            juce::Timer::callAfterDelay(1500, [this]() {
                juce::JUCEApplicationBase::quit();
            });
        }
    }

    void closeButtonPressed() override {
        juce::JUCEApplicationBase::quit();
    }

private:
    std::unique_ptr<AxionikProcessor> processor_;
    juce::AudioProcessorEditor* editor_{nullptr};
    bool autoQuit_{false};
};

class WebPilotApp : public juce::JUCEApplication {
public:
    const juce::String getApplicationName() override { return "ABDAxionikVS_WebPilot"; }
    const juce::String getApplicationVersion() override { return "1.0.0"; }
    bool moreThanOneInstanceAllowed() override { return true; }

    void initialise(const juce::String& commandLine) override {
        bool autoQuit = commandLine.contains("--auto-quit");
        mainWindow_ = std::make_unique<WebPilotWindow>("ABDAxionikVS WebPilot Host", autoQuit);
    }

    void shutdown() override {
        mainWindow_ = nullptr;
    }

private:
    std::unique_ptr<WebPilotWindow> mainWindow_;
};

} // namespace abd::axionik

START_JUCE_APPLICATION(abd::axionik::WebPilotApp)
