cmake_minimum_required(VERSION 3.22)

if(APPLE AND NOT DEFINED CMAKE_OSX_ARCHITECTURES)
    set(CMAKE_OSX_ARCHITECTURES "x86_64;arm64" CACHE STRING "Build Universal Binary for macOS" FORCE)
endif()

project(ABDAxionikVS VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/MP4)
endif()

# ============================================================================
# 1. Localización de JUCE y WebView2
# ============================================================================
if(WIN32)
    set(JUCE_USE_WIN_WEBVIEW2 ON CACHE BOOL "Use WebView2 on Windows" FORCE)
    set(JUCE_WEBVIEW2_PACKAGE_LOCATION "$ENV{USERPROFILE}/AppData/Local/PackageManagement/NuGet/Packages" CACHE PATH "WebView2 package location" FORCE)
endif()

if(NOT DEFINED JUCE_PATH)
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDEep/JUCE/CMakeLists.txt")
        set(JUCE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../ABDEep/JUCE")
    elseif(EXISTS "C:/JUCE/CMakeLists.txt")
        set(JUCE_PATH "C:/JUCE")
    elseif(DEFINED ENV{JUCE_PATH})
        set(JUCE_PATH "$ENV{JUCE_PATH}")
    endif()
endif()

if(EXISTS "${JUCE_PATH}/CMakeLists.txt")
    add_subdirectory(${JUCE_PATH} juce)
else()
    message(FATAL_ERROR "JUCE no encontrado. Defina JUCE_PATH o coloque JUCE en ../ABDEep/JUCE")
endif()

# ============================================================================
# 2. Ecosistema ABDShared (ABDShared/Code)
# ============================================================================
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code/CMakeLists.txt")
    set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code")
    message(STATUS "ABDShared: Usando repositorio en ${ABDSHARED_CODE_DIR}")
elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDSharedCode/CMakeLists.txt")
    set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../ABDSharedCode")
    message(STATUS "ABDShared: Usando legacy en ${ABDSHARED_CODE_DIR}")
endif()

# Desactivar tests internos de los módulos compartidos
set(ABDSHARED_BUILD_DSPCORE_TESTS OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_SYNTHCORE_TESTS OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_DSPEFFECTS_TESTS OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_AUTOUPDATER OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_AUDIOCOMPARATOR OFF CACHE BOOL "" FORCE)

if(DEFINED ABDSHARED_CODE_DIR)
    add_subdirectory("${ABDSHARED_CODE_DIR}" "${CMAKE_BINARY_DIR}/ABDShared_build")
endif()

# ============================================================================
# 3. Lista Única Anti-Drift de Fuentes DSP
# ============================================================================
include("${CMAKE_CURRENT_SOURCE_DIR}/DspSources.cmake")

set(AXIONIK_PLUGIN_SOURCES
    ${AXIONIK_DSP_SOURCES}
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
)

# ============================================================================
# 4. Target del Plugin Nativo (JUCE 9 Standalone + VST3)
# ============================================================================
juce_add_plugin(ABDAxionikVS
    COMPANY_NAME "ABDSynths"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    PLUGIN_MANUFACTURER_CODE "ABDS"
    PLUGIN_CODE "AxVS"
    FORMATS Standalone VST3
    PRODUCT_NAME "ABDAxionikVS"
    NEEDS_WEBVIEW2 TRUE
)

# Configurar Standalone
if(TARGET ABDAxionikVS_Standalone)
    target_sources(ABDAxionikVS_Standalone PRIVATE ${AXIONIK_PLUGIN_SOURCES})
    target_include_directories(ABDAxionikVS_Standalone PRIVATE
        Source
        Source/DSP
        Source/Generated
    )
    target_compile_definitions(ABDAxionikVS_Standalone PRIVATE
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_VST3_CAN_REPLACE_VST2=0
    )
    target_link_libraries(ABDAxionikVS_Standalone PRIVATE
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_gui_extra
        ABDShared::DspCore
        ABDShared::SynthCore
        ABDShared::DspEffects
        ABDShared::WebView2Bridge
    )
endif()

# Configurar VST3
if(TARGET ABDAxionikVS_VST3)
    target_sources(ABDAxionikVS_VST3 PRIVATE ${AXIONIK_PLUGIN_SOURCES})
    target_include_directories(ABDAxionikVS_VST3 PRIVATE
        Source
        Source/DSP
        Source/Generated
    )
    target_compile_definitions(ABDAxionikVS_VST3 PRIVATE
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_VST3_CAN_REPLACE_VST2=0
    )
    target_link_libraries(ABDAxionikVS_VST3 PRIVATE
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_gui_extra
        ABDShared::DspCore
        ABDShared::SynthCore
        ABDShared::DspEffects
        ABDShared::WebView2Bridge
    )
endif()

# ============================================================================
# 5. Bancada Ligera WebPilot Host (E2E & Selftest)
# ============================================================================
juce_add_gui_app(ABDAxionikVS_WebPilot
    PRODUCT_NAME "ABDAxionikVS WebPilot Host"
    VERSION "1.0.0"
    NEEDS_WEBVIEW2 TRUE
)

target_sources(ABDAxionikVS_WebPilot PRIVATE
    Source/WebPilotHost.cpp
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    ${AXIONIK_DSP_SOURCES}
)

target_include_directories(ABDAxionikVS_WebPilot PRIVATE
    Source
    Source/DSP
    Source/Generated
)

target_compile_definitions(ABDAxionikVS_WebPilot PRIVATE
    JUCE_WEB_BROWSER=1
    JUCE_USE_WIN_WEBVIEW2=1
)

target_link_libraries(ABDAxionikVS_WebPilot PRIVATE
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_gui_extra
    ABDShared::DspCore
    ABDShared::SynthCore
    ABDShared::DspEffects
    ABDShared::WebView2Bridge
)
