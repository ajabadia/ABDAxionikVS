// ============================================================================
// ABDAxionikVS — SndDatStore.h
// Contenedor de configuración de los 445 parámetros del sintetizador.
// Replica fiel del componente 'snddat' (445 registros × 40 bytes)
// Creado originalmente por FUN_10013de0 a partir de .rdata 0x10049F14
// ============================================================================

#pragma once

#include <cstdint>
#include <array>
#include <string_view>
#include <functional>
#include <vector>
#include "Generated/ParameterRegistry.gen.h"
#include "Generated/Conversion.gen.h"

namespace abd::axionik {

/// Estructura de registro de configuración (40 bytes en binario original)
struct ParamRecord {
    uint32_t id{0};
    float rawValue{0.0f};          // Valor en unidad de preset (+0x1C en binario)
    float normalizedValue{0.0f};   // Valor 0.0 .. 1.0 (para VST / GUI)
    float minValue{0.0f};
    float maxValue{1.0f};
    float defaultValue{0.0f};
};

class SndDatStore {
public:
    using ObserverCallback = std::function<void(uint32_t paramId, float rawValue)>;

    SndDatStore() {
        resetToDefaults();
    }

    /// Reinicia todos los parámetros a sus valores por defecto canónicos
    void resetToDefaults() {
        for (size_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            records_[i].id = desc.index;
            records_[i].minValue = desc.min;
            records_[i].maxValue = desc.max;
            records_[i].defaultValue = desc.defaultValue;
            records_[i].rawValue = desc.defaultValue;
            records_[i].normalizedValue = rawToNormalized(desc.index, desc.defaultValue);
        }
    }

    /// Establece un parámetro por su valor crudo (raw)
    void setRawValue(uint32_t index, float raw, bool notify = true) {
        if (index >= kNumTotalParameters) return;
        auto& rec = records_[index];
        rec.rawValue = std::clamp(raw, rec.minValue, rec.maxValue);
        rec.normalizedValue = rawToNormalized(index, rec.rawValue);

        if (notify) {
            notifyObservers(index, rec.rawValue);
        }
    }

    /// Establece un parámetro por su valor normalizado (0.0 .. 1.0)
    void setNormalizedValue(uint32_t index, float norm, bool notify = true) {
        if (index >= kNumTotalParameters) return;
        float raw = normalizedToRaw(index, norm);
        setRawValue(index, raw, notify);
    }

    /// Lectura de valor crudo
    [[nodiscard]] float getRawValue(uint32_t index) const {
        if (index >= kNumTotalParameters) return 0.0f;
        return records_[index].rawValue;
    }

    /// Lectura de valor normalizado
    [[nodiscard]] float getNormalizedValue(uint32_t index) const {
        if (index >= kNumTotalParameters) return 0.0f;
        return records_[index].normalizedValue;
    }

    /// Registro de observadores (hasta 16 por registro en el original)
    void addObserver(uint32_t index, ObserverCallback cb) {
        if (index >= kNumTotalParameters || !cb) return;
        observers_[index].push_back(std::move(cb));
    }

    /// Notifica a los observadores registrados para un parámetro
    void notifyObservers(uint32_t index, float raw) {
        if (index >= kNumTotalParameters) return;
        for (const auto& cb : observers_[index]) {
            cb(index, raw);
        }
    }

    /// Notifica a todos los observadores (útil tras cargar un preset o InitSound)
    void notifyAll() {
        for (size_t i = 0; i < kNumTotalParameters; ++i) {
            notifyObservers(static_cast<uint32_t>(i), records_[i].rawValue);
        }
    }

private:
    std::array<ParamRecord, kNumTotalParameters> records_;
    std::array<std::vector<ObserverCallback>, kNumTotalParameters> observers_;
};

} // namespace abd::axionik
