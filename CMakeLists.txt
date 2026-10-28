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
    if(NOT DEFINED JUCE_WEBVIEW2_PACKAGE_LOCATION)
        if(DEFINED WEBVIEW2_PACKAGE_DIR AND EXISTS "${WEBVIEW2_PACKAGE_DIR}")
            set(JUCE_WEBVIEW2_PACKAGE_LOCATION "${WEBVIEW2_PACKAGE_DIR}" CACHE PATH "WebView2 package location")
        elseif(DEFINED ENV{WEBVIEW2_PACKAGE_DIR} AND EXISTS "$ENV{WEBVIEW2_PACKAGE_DIR}")
            set(JUCE_WEBVIEW2_PACKAGE_LOCATION "$ENV{WEBVIEW2_PACKAGE_DIR}" CACHE PATH "WebView2 package location")
        elseif(DEFINED ENV{WEBVIEW2_PACKAGE_LOCATION} AND EXISTS "$ENV{WEBVIEW2_PACKAGE_LOCATION}")
            set(JUCE_WEBVIEW2_PACKAGE_LOCATION "$ENV{WEBVIEW2_PACKAGE_LOCATION}" CACHE PATH "WebView2 package location")
        elseif(DEFINED ENV{USERPROFILE} AND EXISTS "$ENV{USERPROFILE}/AppData/Local/PackageManagement/NuGet/Packages")
            set(JUCE_WEBVIEW2_PACKAGE_LOCATION "$ENV{USERPROFILE}/AppData/Local/PackageManagement/NuGet/Packages" CACHE PATH "WebView2 package location")
        endif()
    endif()
    add_compile_definitions(
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
    )
endif()

if(NOT DEFINED JUCE_PATH)
    if(DEFINED ENV{JUCE_PATH} AND EXISTS "$ENV{JUCE_PATH}/CMakeLists.txt")
        set(JUCE_PATH "$ENV{JUCE_PATH}")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDEep/JUCE/CMakeLists.txt")
        set(JUCE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../ABDEep/JUCE")
    elseif(EXISTS "C:/JUCE/CMakeLists.txt")
        set(JUCE_PATH "C:/JUCE")
    endif()
endif()

if(EXISTS "${JUCE_PATH}/CMakeLists.txt")
    add_subdirectory(${JUCE_PATH} juce)
else()
    message(FATAL_ERROR "JUCE no encontrado. Defina la variable de CMake JUCE_PATH, la variable de entorno JUCE_PATH o coloque JUCE en ../ABDEep/JUCE o C:/JUCE")
endif()

# ============================================================================
# 2. Ecosistema ABDShared (ABDShared/Code)
# ============================================================================
if(NOT DEFINED ABDSHARED_CODE_DIR)
    if(DEFINED ENV{ABDSHARED_CODE_DIR} AND EXISTS "$ENV{ABDSHARED_CODE_DIR}/CMakeLists.txt")
        set(ABDSHARED_CODE_DIR "$ENV{ABDSHARED_CODE_DIR}")
        message(STATUS "ABDShared: Usando variable de entorno ABDSHARED_CODE_DIR en ${ABDSHARED_CODE_DIR}")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code/CMakeLists.txt")
        set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../ABDShared/Code")
        message(STATUS "ABDShared: Usando repositorio en ${ABDSHARED_CODE_DIR}")
    elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../ABDSharedCode/CMakeLists.txt")
        set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../ABDSharedCode")
        message(STATUS "ABDShared: Usando legacy en ${ABDSHARED_CODE_DIR}")
    endif()
endif()

# Desactivar tests internos de los módulos compartidos
set(ABDSHARED_BUILD_DSPCORE_TESTS OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_SYNTHCORE_TESTS OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_DSPEFFECTS_TESTS OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_AUTOUPDATER OFF CACHE BOOL "" FORCE)
set(ABDSHARED_BUILD_AUDIOCOMPARATOR OFF CACHE BOOL "" FORCE)

if(DEFINED ABDSHARED_CODE_DIR)
    add_subdirectory("${ABDSHARED_CODE_DIR}" "${CMAKE_BINARY_DIR}/ABDShared_build")
else()
    message(FATAL_ERROR "ABDShared no encontrado en ../ABDShared/Code ni ../ABDSharedCode. Verifique la estructura del workspace ABDSynths.")
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

target_sources(ABDAxionikVS PRIVATE ${AXIONIK_PLUGIN_SOURCES})
target_include_directories(ABDAxionikVS PUBLIC
    Source
    Source/DSP
    Source/Generated
)
target_compile_definitions(ABDAxionikVS PUBLIC
    JUCE_WEB_BROWSER=1
    JUCE_USE_WIN_WEBVIEW2=1
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
    JUCE_VST3_CAN_REPLACE_VST2=0
)
target_link_libraries(ABDAxionikVS PUBLIC
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_gui_extra
    ABDShared::DspCore
    ABDShared::SynthCore
    ABDShared::DspEffects
    ABDShared::WebView2Bridge
)

# Configurar Standalone
if(TARGET ABDAxionikVS_Standalone)
    target_compile_definitions(ABDAxionikVS_Standalone PRIVATE
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
        JUCE_VST3_CAN_REPLACE_VST2=0
    )
endif()

# Configurar VST3
if(TARGET ABDAxionikVS_VST3)
    target_compile_definitions(ABDAxionikVS_VST3 PRIVATE
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
        JUCE_VST3_CAN_REPLACE_VST2=0
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
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
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

# ============================================================================
# 6. Arnés de Verificación Offline contra Vectores Áureos (Sin GUI / CLI Puro)
# ============================================================================
add_executable(GoldenParityTest
    Tests/GoldenParityTest.cpp
    ${AXIONIK_DSP_SOURCES}
)

target_include_directories(GoldenParityTest PRIVATE
    Source
    Source/DSP
    Source/Generated
    Tests
)

target_compile_features(GoldenParityTest PRIVATE cxx_std_20)

if(MSVC)
    target_link_options(GoldenParityTest PRIVATE "/STACK:8388608")
endif()

target_link_libraries(GoldenParityTest PRIVATE
    ABDShared::DspCore
    ABDShared::SynthCore
    ABDShared::DspEffects
)

# ============================================================================
# 7. Pruebas Unitarias del Motor DSP (DspEngineFacadeTests)
# ============================================================================
add_executable(DspEngineFacadeTests
    Tests/DspEngineFacadeTests.cpp
    ${AXIONIK_DSP_SOURCES}
)

target_include_directories(DspEngineFacadeTests PRIVATE
    Source
    Source/DSP
    Source/Generated
    Tests
)

target_compile_features(DspEngineFacadeTests PRIVATE cxx_std_20)

if(MSVC)
    target_link_options(DspEngineFacadeTests PRIVATE "/STACK:8388608")
endif()

target_link_libraries(DspEngineFacadeTests PRIVATE
    ABDShared::DspCore
    ABDShared::SynthCore
    ABDShared::DspEffects
)
