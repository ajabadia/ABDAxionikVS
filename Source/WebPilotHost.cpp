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
    WebPilotWindow(juce::String name, int autoQuitMs)
        : DocumentWindow(name, juce::Colours::black, DocumentWindow::allButtons),
          autoQuitMs_(autoQuitMs)
    {
        setUsingNativeTitleBar(true);
        processor_ = std::make_unique<AxionikProcessor>();
        editor_ = processor_->createEditor();
        setContentOwned(editor_, true);
        setResizable(true, false);
        centreWithSize(getWidth(), getHeight());
        setVisible(true);

        if (autoQuitMs_ > 0) {
            juce::Timer::callAfterDelay(autoQuitMs_, [this]() {
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
    int autoQuitMs_{0};
};

class WebPilotApp : public juce::JUCEApplication {
public:
    const juce::String getApplicationName() override { return "ABDAxionikVS_WebPilot"; }
    const juce::String getApplicationVersion() override { return "1.0.0"; }
    bool moreThanOneInstanceAllowed() override { return true; }

    void initialise(const juce::String& commandLine) override {
        int autoQuitMs = 0;
        auto args = juce::StringArray::fromTokens(commandLine, " ", "\"");
        for (const auto& arg : args) {
            if (arg.startsWith("--auto-quit=")) {
                autoQuitMs = arg.fromFirstOccurrenceOf("--auto-quit=", false, false).getIntValue();
            } else if (arg == "--auto-quit") {
                if (autoQuitMs <= 0) autoQuitMs = 1500;
            } else if (arg.startsWith("--timeout=")) {
                autoQuitMs = arg.fromFirstOccurrenceOf("--timeout=", false, false).getIntValue();
            }
        }
        if (autoQuitMs < 0) autoQuitMs = 0;
        mainWindow_ = std::make_unique<WebPilotWindow>("ABDAxionikVS WebPilot Host", autoQuitMs);
    }

    void shutdown() override {
        mainWindow_ = nullptr;
    }

private:
    std::unique_ptr<WebPilotWindow> mainWindow_;
};

} // namespace abd::axionik

START_JUCE_APPLICATION(abd::axionik::WebPilotApp)
