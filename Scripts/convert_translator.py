import sys

with open(r'C:\Users\ajaba\Downloads\neuron\NeuronVS_port\src\translator.cpp', 'r', encoding='utf-8') as f:
    text = f.read()

target_inc = '#include "neuron/translator.hpp"'
repl_inc = '''#include "Translator.h"

namespace abd::axionik {
using uint = uint32_t;
using undefined1 = uint8_t;
using undefined4 = uint32_t;
using byte = uint8_t;
'''
text = text.replace(target_inc, repl_inc)
text = text.replace('namespace neuron {', '')

old_fn = 'void translate(uint32_t* engine, const uint32_t* p) {'
new_fn = '''void translateParametersToEngine(uint32_t* engineState, const float* pFloat) {
    if (engineState == nullptr || pFloat == nullptr) return;
    const uint32_t* p = reinterpret_cast<const uint32_t*>(pFloat);
    uint32_t* e = engineState;'''

text = text.replace(old_fn, new_fn)
text = text.replace('if (engine == nullptr) return;', '')
text = text.replace('uint32_t* e = *reinterpret_cast<uint32_t**>(engine);', '')
text = text.replace('FUN_100343e4', 'translateSubObject')
text = text.replace('cVar13 = FUN_100373a0(e);', 'cVar13 = validateEngineState(e);')

with open(r'Source\DSP\Translator.cpp', 'w', encoding='utf-8') as out:
    out.write(text)
print('Success! Wrote bytes:', len(text))
