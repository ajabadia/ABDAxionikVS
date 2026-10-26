import csv

with open(r'docs\reverse_engineering\dsp\params_observers_map.csv', 'r') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

mod_dests = {}
for r in rows:
    m = int(r['mod_dest_idx'])
    if m >= 0:
        mod_dests[m] = {
            'slot': int(r['slot_in_p']),
            'snddat_index': int(r['snddat_index']),
            'key': r['snddat_key'],
            'min': float(r['min_val']),
            'max': float(r['max_val'])
        }

lines = []
lines.append('// ============================================================================')
lines.append('// ABDAxionikVS — ParameterEngineBridge.cpp')
lines.append('// ============================================================================')
lines.append('#include "ParameterEngineBridge.h"')
lines.append('')
lines.append('namespace abd::axionik {')
lines.append('')

# kModDestToSlot
lines.append('const int32_t ParameterEngineBridge::kModDestToSlot[kNumModDests] = {')
for m in range(63):
    slot = mod_dests[m]['slot'] if m in mod_dests else -1
    lines.append(f'    {slot}, // {m}: {mod_dests[m]["key"]}')
lines.append('};')
lines.append('')

# kModDestRanges
lines.append('const ParameterEngineBridge::Range ParameterEngineBridge::kModDestRanges[kNumModDests] = {')
for m in range(63):
    min_v = mod_dests[m]['min'] if m in mod_dests else 0.0
    max_v = mod_dests[m]['max'] if m in mod_dests else 1.0
    lines.append(f'    {{ {min_v:.1f}f, {max_v:.1f}f }}, // {m}: {mod_dests[m]["key"]}')
lines.append('};')
lines.append('')

# initModulationRouting
lines.append('void ParameterEngineBridge::initModulationRouting() {')
lines.append('    observerMap_.fill(ObserverContext{});')
for r in rows:
    snd_idx = int(r['snddat_index'])
    if snd_idx < 0: continue
    slot = int(r['slot_in_p'])
    mod_idx = int(r['mod_dest_idx'])
    min_v = float(r['min_val']) if r['min_val'] else 0.0
    max_v = float(r['max_val']) if r['max_val'] else 1.0
    lines.append(f'    if ({snd_idx} < kNumTotalParameters) {{')
    lines.append(f'        observerMap_[{snd_idx}] = ObserverContext{{ 0, {slot}, {mod_idx}, {min_v:.2f}f, {max_v:.2f}f }};')
    lines.append('    }')
lines.append('}')
lines.append('')

# bindStoreObservers
lines.append('void ParameterEngineBridge::bindStoreObservers() {')
lines.append('    for (uint32_t i = 0; i < kNumTotalParameters; ++i) {')
lines.append('        store_.addObserver(i, [this](uint32_t paramId, float rawVal) {')
lines.append('            handleParamChange(paramId, rawVal);')
lines.append('        });')
lines.append('    }')
lines.append('}')
lines.append('')
lines.append('} // namespace abd::axionik')

with open(r'Source\DSP\ParameterEngineBridge.cpp', 'w', encoding='utf-8') as out:
    out.write('\n'.join(lines))

print('Generated ParameterEngineBridge.cpp successfully.')
