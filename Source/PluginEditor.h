// ============================================================================
// ABDAxionikVS — PluginEditor.h
// Editor nativo JUCE 9 basado en WebView2 sirviendo WebUI/dist/
// ============================================================================

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include <WebView2Bridge/JuceWebView2Component.h>
#include "PluginProcessor.h"

namespace abd::axionik {

class AxionikEditor : public juce::AudioProcessorEditor,
                      private juce::Timer {
public:
    explicit AxionikEditor(AxionikProcessor&);
    ~AxionikEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;

    AxionikProcessor& processor_;
    std::unique_ptr<abd::webview2::JuceWebView2Component> webComponent_;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AxionikEditor)
};

} // namespace abd::axionik
