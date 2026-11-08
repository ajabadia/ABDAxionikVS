// ============================================================================
// ParameterGestureTests — gestos de automatización del procesador
//
// Comprueba, sobre el AxionikProcessor real (no sobre un mock), que un arrastre
// llega al host como UN gesto por parámetro:
//
//   begin → N cambios de valor → end   ⇒  1 begin y 1 end
//
// y que las defensas del procesador aguantan los casos que un `pointerup`
// perdido o un doble `pointerdown` producen en la WebUI:
//
//   * begin duplicado  ⇒ no se reenvía (JUCE asserta en beginChangeGesture
//     sin su end, así que este es el caso que rompía la sesión en Debug);
//   * end sin begin    ⇒ no se reenvía;
//   * end duplicado    ⇒ no se reenvía;
//   * parámetros distintos ⇒ gestos independientes (un stick 2D abre uno por eje).
//
// Los gestos se cuentan con un juce::AudioProcessorParameter::Listener, que es
// exactamente el canal por el que JUCE avisa al host (VST3Wrapper incluido):
// así el test no depende de la implementación interna del parámetro.
//
// Uso: ParameterGestureTests            (exit 0 = todo correcto)
// ============================================================================

#include <cstdio>
#include <string>
#include <vector>

#include <juce_audio_processors/juce_audio_processors.h>

#include "PluginProcessor.h"

namespace {

using abd::axionik::AxionikProcessor;
using abd::axionik::kNumTotalParameters;
using abd::axionik::kParameterDescriptors;

int failures = 0;

void check(bool condition, const std::string& what) {
    if (condition) {
        std::printf("  [OK]   %s\n", what.c_str());
    } else {
        std::printf("  [FAIL] %s\n", what.c_str());
        ++failures;
    }
}

juce::String idForIndex(uint32_t index) {
    const auto& desc = kParameterDescriptors[index];
    return juce::String(desc.key.data(), desc.key.size());
}

// Cuenta los gestos que salen del parámetro en dirección al host.
struct GestureCounter final : juce::AudioProcessorParameter::Listener {
    int begins = 0;
    int ends = 0;
    int valueChanges = 0;
    int unbalanced() const noexcept { return begins - ends; }

    void parameterValueChanged(int, float) override { ++valueChanges; }
    void parameterGestureChanged(int, bool gestureIsStarting) override {
        if (gestureIsStarting) {
            ++begins;
        } else {
            ++ends;
        }
    }
};

// Un arrastre completo: begin, una ráfaga de valores y end.
void simulateDrag(AxionikProcessor& proc, GestureCounter& counter, uint32_t index) {
    proc.beginParameterGestureByIndex(index);
    for (int step = 1; step <= 8; ++step) {
        proc.setParameterNormalizedByIndex(index, static_cast<float>(step) / 9.0f);
    }
    proc.endParameterGestureByIndex(index);
}

} // namespace

int main() {
    const juce::ScopedJuceInitialiser_GUI juceInit;

    AxionikProcessor proc;
    auto& apvts = proc.getAPVTS();

    // Dos parámetros que existen en el APVTS (se buscan, no se asume el índice).
    std::vector<uint32_t> targets;
    for (uint32_t i = 0; i < kNumTotalParameters && targets.size() < 2; ++i) {
        if (apvts.getParameter(idForIndex(i)) != nullptr) targets.push_back(i);
    }

    if (targets.size() < 2) {
        std::printf("[FAIL] no se encontraron dos parametros en el APVTS\n");
        return 1;
    }

    auto* paramA = apvts.getParameter(idForIndex(targets[0]));
    auto* paramB = apvts.getParameter(idForIndex(targets[1]));

    GestureCounter counterA;
    GestureCounter counterB;
    paramA->addListener(&counterA);
    paramB->addListener(&counterB);

    std::printf("Parametro A: %s (indice %u)\n", idForIndex(targets[0]).toRawUTF8(), targets[0]);
    std::printf("Parametro B: %s (indice %u)\n\n", idForIndex(targets[1]).toRawUTF8(), targets[1]);

    std::printf("[1] Un arrastre = un gesto\n");
    simulateDrag(proc, counterA, targets[0]);
    check(counterA.begins == 1, "el arrastre abre un unico begin");
    check(counterA.ends == 1, "el arrastre cierra un unico end");
    check(counterA.unbalanced() == 0, "el gesto queda cerrado (begin == end)");
    check(counterA.valueChanges == 8, "los 8 cambios de valor llegan dentro del gesto");

    std::printf("\n[2] Begin duplicado (doble pointerdown)\n");
    const int beginsBefore = counterA.begins;
    const int endsBefore = counterA.ends;
    proc.beginParameterGestureByIndex(targets[0]);
    proc.beginParameterGestureByIndex(targets[0]);
    check(counterA.begins == beginsBefore + 1, "el segundo begin del mismo arrastre no se reenvia");
    check(counterA.ends == endsBefore, "el begin duplicado no cierra el gesto");

    std::printf("\n[3] End duplicado\n");
    proc.endParameterGestureByIndex(targets[0]);
    proc.endParameterGestureByIndex(targets[0]);
    check(counterA.ends == endsBefore + 1, "el end extra no se reenvia");
    check(counterA.unbalanced() == 0, "la pareja sigue balanceada");

    std::printf("\n[4] End sin begin (arrastre cuyo begin se perdio)\n");
    const int beginsNow = counterA.begins;
    const int endsNow = counterA.ends;
    proc.endParameterGestureByIndex(targets[0]);
    check(counterA.ends == endsNow, "el end sin begin no se reenvia");
    check(counterA.begins == beginsNow, "no aparece un begin fantasma");

    std::printf("\n[5] Dos parametros (stick 2D): un gesto por eje\n");
    proc.beginParameterGestureByIndex(targets[0]);
    proc.beginParameterGestureByIndex(targets[1]);
    check(counterA.begins == beginsNow + 1, "el eje X abre su propio gesto");
    check(counterB.begins == 1, "el eje Y abre su propio gesto");
    check(counterA.unbalanced() == 1 && counterB.unbalanced() == 1, "ambos quedan abiertos a la vez");

    proc.endParameterGestureByIndex(targets[0]);
    proc.endParameterGestureByIndex(targets[1]);
    check(counterA.unbalanced() == 0 && counterB.unbalanced() == 0, "ambos se cierran al soltar");

    std::printf("\n[6] Repeticion: otro arrastre vuelve a abrir y cerrar\n");
    const int aBegins = counterA.begins;
    const int aEnds = counterA.ends;
    simulateDrag(proc, counterA, targets[0]);
    check(counterA.begins == aBegins + 1 && counterA.ends == aEnds + 1,
          "cada arrastre nuevo produce exactamente un gesto");

    std::printf("\n[7] Arrastres solapados sobre el mismo parametro\n");
    const int bBegins = counterA.begins;
    const int bEnds = counterA.ends;
    proc.beginParameterGestureByIndex(targets[0]);   // arrastre 1 empieza
    proc.beginParameterGestureByIndex(targets[0]);   // arrastre 2 se solapa
    proc.endParameterGestureByIndex(targets[0]);     // suelta uno
    proc.endParameterGestureByIndex(targets[0]);     // suelta el otro (ya cerrado)
    check(counterA.begins == bBegins + 1 && counterA.ends == bEnds + 1,
          "el solape no multiplica los gestos");

    paramA->removeListener(&counterA);
    paramB->removeListener(&counterB);

    std::printf("\n%s\n", failures == 0 ? "TODAS LAS COMPROBACIONES OK" : "HAY FALLOS");
    std::printf("Parametro A: %d begin / %d end | Parametro B: %d begin / %d end\n",
                counterA.begins, counterA.ends, counterB.begins, counterB.ends);
    return failures == 0 ? 0 : 1;
}
