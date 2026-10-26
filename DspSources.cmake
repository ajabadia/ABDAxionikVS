# ============================================================================
# ABDAxionikVS — Lista compartida de fuentes DSP (anti-drift, single-source)
#
# Consumida por DOS builds:
#   - CMakeLists.txt raiz (plugin nativo JUCE 9 Standalone + VST3)
#   - wasm/CMakeLists.txt (build WebAssembly AudioWorklet)
#
# Regla estricta: Source/DSP/ NUNCA incluye cabeceras de JUCE.
# Las mismas fuentes compilan bit a bit identico en nativo y en WASM.
# ============================================================================

set(AXIONIK_DSP_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/DspEngineFacade.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/Translator.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/TranslatorHooks.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/ParameterEngineBridge.cpp"
)
