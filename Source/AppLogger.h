// ============================================================================
// ABDAxionikVS — AppLogger.h
// Logger a fichero local junto al ejecutable (ABDAxionikVS.log)
// ============================================================================

#pragma once

#include <juce_core/juce_core.h>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>

namespace abd::axionik {

class AppLogger {
public:
    static void log(const juce::String& message, const char* file = __FILE__, int line = __LINE__) {
        static std::mutex logMutex;
        std::lock_guard<std::mutex> lock(logMutex);

        auto now = std::chrono::system_clock::now();
        auto now_time = std::chrono::system_clock::to_time_t(now);
        auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

        std::ostringstream timeStream;
        timeStream << std::put_time(std::localtime(&now_time), "[%Y-%m-%d %H:%M:%S") << "."
                   << std::setfill('0') << std::setw(3) << now_ms.count() << "] ";

        // Extraer solo el nombre base del archivo para legibilidad
        juce::String filePath(file);
        juce::String fileName = filePath.fromLastOccurrenceOf("\\", false, false);
        if (fileName.isEmpty()) fileName = filePath.fromLastOccurrenceOf("/", false, false);
        if (fileName.isEmpty()) fileName = filePath;

        std::string fullStr = timeStream.str() + message.toRawUTF8() + " [" + fileName.toRawUTF8() + ":" + std::to_string(line) + "]\n";

        // 1. Consola estándar
        std::cout << fullStr;
        std::cout.flush();

        // 2. Archivo de log al lado del ejecutable
        try {
            juce::File exeFile = juce::File::getSpecialLocation(juce::File::currentExecutableFile);
            juce::File logFile = exeFile.getParentDirectory().getChildFile("ABDAxionikVS.log");
            std::ofstream out(logFile.getFullPathName().toStdString(), std::ios::app);
            if (out.is_open()) {
                out << fullStr;
                out.flush();
            }
        } catch (...) {
            // Ignorar errores de log
        }
    }
};

#define AX_LOG(msg) ::abd::axionik::AppLogger::log(msg, __FILE__, __LINE__)

} // namespace abd::axionik
