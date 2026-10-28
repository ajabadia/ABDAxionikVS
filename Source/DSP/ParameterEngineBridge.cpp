// ============================================================================
// ABDAxionikVS — ParameterEngineBridge.cpp
// ============================================================================
#include "ParameterEngineBridge.h"

namespace abd::axionik {

const int32_t ParameterEngineBridge::kModDestToSlot[kNumModDests] = {
    4, // 0: R1Volume
    11, // 1: R1Semi
    28, // 2: R1L1Scape1Value
    29, // 3: R1L1Scape2Value
    19, // 4: R1L1Sphere1Value
    20, // 5: R1L1Sphere2Value
    46, // 6: R1L2Scape1Value
    47, // 7: R1L2Scape2Value
    37, // 8: R1L2Sphere1Value
    38, // 9: R1L2Sphere2Value
    64, // 10: R1L3Scape1Value
    65, // 11: R1L3Scape2Value
    55, // 12: R1L3Sphere1Value
    56, // 13: R1L3Sphere2Value
    74, // 14: R2Volume
    81, // 15: R2Semi
    98, // 16: R2L1Scape1Value
    99, // 17: R2L1Scape2Value
    89, // 18: R2L1Sphere1Value
    90, // 19: R2L1Sphere2Value
    116, // 20: R2L2Scape1Value
    117, // 21: R2L2Scape2Value
    107, // 22: R2L2Sphere1Value
    108, // 23: R2L2Sphere2Value
    134, // 24: R2L3Scape1Value
    135, // 25: R2L3Scape2Value
    125, // 26: R2L3Sphere1Value
    126, // 27: R2L3Sphere2Value
    143, // 28: R1ResEnvA
    144, // 29: R1ResEnvD
    145, // 30: R1ResEnvS
    146, // 31: R1ResEnvR
    161, // 32: R1AmpEnvA
    162, // 33: R1AmpEnvD
    163, // 34: R1AmpEnvS
    164, // 35: R1AmpEnvR
    166, // 36: R1FreeEnvA
    167, // 37: R1FreeEnvD
    168, // 38: R1FreeEnvS
    169, // 39: R1FreeEnvR
    173, // 40: R2ResEnvA
    174, // 41: R2ResEnvD
    175, // 42: R2ResEnvS
    176, // 43: R2ResEnvR
    191, // 44: R2AmpEnvA
    192, // 45: R2AmpEnvD
    193, // 46: R2AmpEnvS
    194, // 47: R2AmpEnvR
    196, // 48: R2FreeEnvA
    197, // 49: R2FreeEnvD
    198, // 50: R2FreeEnvS
    199, // 51: R2FreeEnvR
    237, // 52: FilterEnvA
    238, // 53: FilterEnvD
    239, // 54: FilterEnvS
    240, // 55: FilterEnvR
    221, // 56: BlenderAmount
    227, // 57: SlicerDepth
    228, // 58: SlicerRate
    216, // 59: LFODepth
    217, // 60: LFORate
    231, // 61: FilterFreq
    232, // 62: FilterReso
};

const ParameterEngineBridge::Range ParameterEngineBridge::kModDestRanges[kNumModDests] = {
    { 0.0f, 1.0f }, // 0: R1Volume
    { -24.0f, 24.0f }, // 1: R1Semi
    { 0.0f, 1.0f }, // 2: R1L1Scape1Value
    { 0.0f, 1.0f }, // 3: R1L1Scape2Value
    { 0.0f, 1.0f }, // 4: R1L1Sphere1Value
    { 0.0f, 1.0f }, // 5: R1L1Sphere2Value
    { 0.0f, 1.0f }, // 6: R1L2Scape1Value
    { 0.0f, 1.0f }, // 7: R1L2Scape2Value
    { 0.0f, 1.0f }, // 8: R1L2Sphere1Value
    { 0.0f, 1.0f }, // 9: R1L2Sphere2Value
    { 0.0f, 1.0f }, // 10: R1L3Scape1Value
    { 0.0f, 1.0f }, // 11: R1L3Scape2Value
    { 0.0f, 1.0f }, // 12: R1L3Sphere1Value
    { 0.0f, 1.0f }, // 13: R1L3Sphere2Value
    { 0.0f, 1.0f }, // 14: R2Volume
    { -24.0f, 24.0f }, // 15: R2Semi
    { 0.0f, 1.0f }, // 16: R2L1Scape1Value
    { 0.0f, 1.0f }, // 17: R2L1Scape2Value
    { 0.0f, 1.0f }, // 18: R2L1Sphere1Value
    { 0.0f, 1.0f }, // 19: R2L1Sphere2Value
    { 0.0f, 1.0f }, // 20: R2L2Scape1Value
    { 0.0f, 1.0f }, // 21: R2L2Scape2Value
    { 0.0f, 1.0f }, // 22: R2L2Sphere1Value
    { 0.0f, 1.0f }, // 23: R2L2Sphere2Value
    { 0.0f, 1.0f }, // 24: R2L3Scape1Value
    { 0.0f, 1.0f }, // 25: R2L3Scape2Value
    { 0.0f, 1.0f }, // 26: R2L3Sphere1Value
    { 0.0f, 1.0f }, // 27: R2L3Sphere2Value
    { 0.0f, 1.0f }, // 28: R1ResEnvA
    { 0.0f, 1.0f }, // 29: R1ResEnvD
    { 0.0f, 1.0f }, // 30: R1ResEnvS
    { 0.0f, 1.0f }, // 31: R1ResEnvR
    { 0.0f, 1.0f }, // 32: R1AmpEnvA
    { 0.0f, 1.0f }, // 33: R1AmpEnvD
    { 0.0f, 1.0f }, // 34: R1AmpEnvS
    { 0.0f, 1.0f }, // 35: R1AmpEnvR
    { 0.0f, 1.0f }, // 36: R1FreeEnvA
    { 0.0f, 1.0f }, // 37: R1FreeEnvD
    { 0.0f, 1.0f }, // 38: R1FreeEnvS
    { 0.0f, 1.0f }, // 39: R1FreeEnvR
    { 0.0f, 1.0f }, // 40: R2ResEnvA
    { 0.0f, 1.0f }, // 41: R2ResEnvD
    { 0.0f, 1.0f }, // 42: R2ResEnvS
    { 0.0f, 1.0f }, // 43: R2ResEnvR
    { 0.0f, 1.0f }, // 44: R2AmpEnvA
    { 0.0f, 1.0f }, // 45: R2AmpEnvD
    { 0.0f, 1.0f }, // 46: R2AmpEnvS
    { 0.0f, 1.0f }, // 47: R2AmpEnvR
    { 0.0f, 1.0f }, // 48: R2FreeEnvA
    { 0.0f, 1.0f }, // 49: R2FreeEnvD
    { 0.0f, 1.0f }, // 50: R2FreeEnvS
    { 0.0f, 1.0f }, // 51: R2FreeEnvR
    { 0.0f, 1.0f }, // 52: FilterEnvA
    { 0.0f, 1.0f }, // 53: FilterEnvD
    { 0.0f, 1.0f }, // 54: FilterEnvS
    { 0.0f, 1.0f }, // 55: FilterEnvR
    { 0.0f, 1.0f }, // 56: BlenderAmount
    { 0.0f, 1.0f }, // 57: SlicerDepth
    { 0.0f, 1.0f }, // 58: SlicerRate
    { 0.0f, 1.0f }, // 59: LFODepth
    { 0.0f, 1.0f }, // 60: LFORate
    { 0.0f, 1.0f }, // 61: FilterFreq
    { 0.0f, 1.0f }, // 62: FilterReso
};

void ParameterEngineBridge::initModulationRouting() {
    observerMap_.fill(ObserverContext{});
    if (22 < kNumTotalParameters) {
        observerMap_[22] = ObserverContext{ 0, -1, -1, 0.00f, 1.00f };
    }
    if (102 < kNumTotalParameters) {
        observerMap_[102] = ObserverContext{ 0, -1, -1, 0.00f, 1.00f };
    }
    if (102 < kNumTotalParameters) {
        observerMap_[102] = ObserverContext{ 0, -1, -1, 400.00f, 480.00f };
    }
    if (3 < kNumTotalParameters) {
        observerMap_[3] = ObserverContext{ 0, 0, -1, -1.00f, 1.00f };
    }
    if (4 < kNumTotalParameters) {
        observerMap_[4] = ObserverContext{ 0, 1, -1, -1.00f, 1.00f };
    }
    if (412 < kNumTotalParameters) {
        observerMap_[412] = ObserverContext{ 0, 2, -1, 0.00f, 12.00f };
    }
    if (23 < kNumTotalParameters) {
        observerMap_[23] = ObserverContext{ 0, 3, -1, 0.00f, 1.00f };
    }
    if (28 < kNumTotalParameters) {
        observerMap_[28] = ObserverContext{ 0, 5, -1, -1.00f, 1.00f };
    }
    if (29 < kNumTotalParameters) {
        observerMap_[29] = ObserverContext{ 0, 6, -1, -1.00f, 1.00f };
    }
    if (30 < kNumTotalParameters) {
        observerMap_[30] = ObserverContext{ 0, 7, -1, -1.00f, 1.00f };
    }
    if (31 < kNumTotalParameters) {
        observerMap_[31] = ObserverContext{ 0, 8, -1, -1.00f, 1.00f };
    }
    if (32 < kNumTotalParameters) {
        observerMap_[32] = ObserverContext{ 0, 9, -1, -1.00f, 1.00f };
    }
    if (33 < kNumTotalParameters) {
        observerMap_[33] = ObserverContext{ 0, 10, -1, 0.00f, 3.00f };
    }
    if (35 < kNumTotalParameters) {
        observerMap_[35] = ObserverContext{ 0, 12, -1, -99.00f, 99.00f };
    }
    if (36 < kNumTotalParameters) {
        observerMap_[36] = ObserverContext{ 0, 13, -1, -1.00f, 1.00f };
    }
    if (37 < kNumTotalParameters) {
        observerMap_[37] = ObserverContext{ 0, 14, -1, -1.00f, 1.00f };
    }
    if (38 < kNumTotalParameters) {
        observerMap_[38] = ObserverContext{ 0, 15, -1, -1.00f, 1.00f };
    }
    if (39 < kNumTotalParameters) {
        observerMap_[39] = ObserverContext{ 0, 16, -1, -1.00f, 1.00f };
    }
    if (40 < kNumTotalParameters) {
        observerMap_[40] = ObserverContext{ 0, 17, -1, 0.00f, 1.00f };
    }
    if (41 < kNumTotalParameters) {
        observerMap_[41] = ObserverContext{ 0, 18, -1, 1.00f, 127.00f };
    }
    if (45 < kNumTotalParameters) {
        observerMap_[45] = ObserverContext{ 0, 21, -1, -1.00f, 1.00f };
    }
    if (46 < kNumTotalParameters) {
        observerMap_[46] = ObserverContext{ 0, 22, -1, -1.00f, 1.00f };
    }
    if (47 < kNumTotalParameters) {
        observerMap_[47] = ObserverContext{ 0, 23, -1, -1.00f, 1.00f };
    }
    if (48 < kNumTotalParameters) {
        observerMap_[48] = ObserverContext{ 0, 24, -1, -1.00f, 1.00f };
    }
    if (49 < kNumTotalParameters) {
        observerMap_[49] = ObserverContext{ 0, 25, -1, -1.00f, 1.00f };
    }
    if (50 < kNumTotalParameters) {
        observerMap_[50] = ObserverContext{ 0, 26, -1, -1.00f, 1.00f };
    }
    if (44 < kNumTotalParameters) {
        observerMap_[44] = ObserverContext{ 0, 27, -1, 0.00f, 2.00f };
    }
    if (55 < kNumTotalParameters) {
        observerMap_[55] = ObserverContext{ 0, 30, -1, -1.00f, 1.00f };
    }
    if (56 < kNumTotalParameters) {
        observerMap_[56] = ObserverContext{ 0, 31, -1, -1.00f, 1.00f };
    }
    if (57 < kNumTotalParameters) {
        observerMap_[57] = ObserverContext{ 0, 32, -1, -1.00f, 1.00f };
    }
    if (58 < kNumTotalParameters) {
        observerMap_[58] = ObserverContext{ 0, 33, -1, -1.00f, 1.00f };
    }
    if (59 < kNumTotalParameters) {
        observerMap_[59] = ObserverContext{ 0, 34, -1, -1.00f, 1.00f };
    }
    if (60 < kNumTotalParameters) {
        observerMap_[60] = ObserverContext{ 0, 35, -1, -1.00f, 1.00f };
    }
    if (54 < kNumTotalParameters) {
        observerMap_[54] = ObserverContext{ 0, 36, -1, 0.00f, 2.00f };
    }
    if (65 < kNumTotalParameters) {
        observerMap_[65] = ObserverContext{ 0, 39, -1, -1.00f, 1.00f };
    }
    if (66 < kNumTotalParameters) {
        observerMap_[66] = ObserverContext{ 0, 40, -1, -1.00f, 1.00f };
    }
    if (67 < kNumTotalParameters) {
        observerMap_[67] = ObserverContext{ 0, 41, -1, -1.00f, 1.00f };
    }
    if (68 < kNumTotalParameters) {
        observerMap_[68] = ObserverContext{ 0, 42, -1, -1.00f, 1.00f };
    }
    if (69 < kNumTotalParameters) {
        observerMap_[69] = ObserverContext{ 0, 43, -1, -1.00f, 1.00f };
    }
    if (70 < kNumTotalParameters) {
        observerMap_[70] = ObserverContext{ 0, 44, -1, -1.00f, 1.00f };
    }
    if (64 < kNumTotalParameters) {
        observerMap_[64] = ObserverContext{ 0, 45, -1, 0.00f, 2.00f };
    }
    if (75 < kNumTotalParameters) {
        observerMap_[75] = ObserverContext{ 0, 48, -1, -1.00f, 1.00f };
    }
    if (76 < kNumTotalParameters) {
        observerMap_[76] = ObserverContext{ 0, 49, -1, -1.00f, 1.00f };
    }
    if (77 < kNumTotalParameters) {
        observerMap_[77] = ObserverContext{ 0, 50, -1, -1.00f, 1.00f };
    }
    if (78 < kNumTotalParameters) {
        observerMap_[78] = ObserverContext{ 0, 51, -1, -1.00f, 1.00f };
    }
    if (79 < kNumTotalParameters) {
        observerMap_[79] = ObserverContext{ 0, 52, -1, -1.00f, 1.00f };
    }
    if (80 < kNumTotalParameters) {
        observerMap_[80] = ObserverContext{ 0, 53, -1, -1.00f, 1.00f };
    }
    if (74 < kNumTotalParameters) {
        observerMap_[74] = ObserverContext{ 0, 54, -1, 0.00f, 2.00f };
    }
    if (85 < kNumTotalParameters) {
        observerMap_[85] = ObserverContext{ 0, 57, -1, -1.00f, 1.00f };
    }
    if (86 < kNumTotalParameters) {
        observerMap_[86] = ObserverContext{ 0, 58, -1, -1.00f, 1.00f };
    }
    if (87 < kNumTotalParameters) {
        observerMap_[87] = ObserverContext{ 0, 59, -1, -1.00f, 1.00f };
    }
    if (88 < kNumTotalParameters) {
        observerMap_[88] = ObserverContext{ 0, 60, -1, -1.00f, 1.00f };
    }
    if (89 < kNumTotalParameters) {
        observerMap_[89] = ObserverContext{ 0, 61, -1, -1.00f, 1.00f };
    }
    if (90 < kNumTotalParameters) {
        observerMap_[90] = ObserverContext{ 0, 62, -1, -1.00f, 1.00f };
    }
    if (84 < kNumTotalParameters) {
        observerMap_[84] = ObserverContext{ 0, 63, -1, 0.00f, 2.00f };
    }
    if (95 < kNumTotalParameters) {
        observerMap_[95] = ObserverContext{ 0, 66, -1, -1.00f, 1.00f };
    }
    if (96 < kNumTotalParameters) {
        observerMap_[96] = ObserverContext{ 0, 67, -1, -1.00f, 1.00f };
    }
    if (97 < kNumTotalParameters) {
        observerMap_[97] = ObserverContext{ 0, 68, -1, -1.00f, 1.00f };
    }
    if (98 < kNumTotalParameters) {
        observerMap_[98] = ObserverContext{ 0, 69, -1, -1.00f, 1.00f };
    }
    if (99 < kNumTotalParameters) {
        observerMap_[99] = ObserverContext{ 0, 70, -1, -1.00f, 1.00f };
    }
    if (100 < kNumTotalParameters) {
        observerMap_[100] = ObserverContext{ 0, 71, -1, -1.00f, 1.00f };
    }
    if (94 < kNumTotalParameters) {
        observerMap_[94] = ObserverContext{ 0, 72, -1, 0.00f, 2.00f };
    }
    if (103 < kNumTotalParameters) {
        observerMap_[103] = ObserverContext{ 0, 73, -1, 0.00f, 1.00f };
    }
    if (108 < kNumTotalParameters) {
        observerMap_[108] = ObserverContext{ 0, 75, -1, -1.00f, 1.00f };
    }
    if (109 < kNumTotalParameters) {
        observerMap_[109] = ObserverContext{ 0, 76, -1, -1.00f, 1.00f };
    }
    if (110 < kNumTotalParameters) {
        observerMap_[110] = ObserverContext{ 0, 77, -1, -1.00f, 1.00f };
    }
    if (111 < kNumTotalParameters) {
        observerMap_[111] = ObserverContext{ 0, 78, -1, -1.00f, 1.00f };
    }
    if (112 < kNumTotalParameters) {
        observerMap_[112] = ObserverContext{ 0, 79, -1, -1.00f, 1.00f };
    }
    if (113 < kNumTotalParameters) {
        observerMap_[113] = ObserverContext{ 0, 80, -1, 0.00f, 3.00f };
    }
    if (115 < kNumTotalParameters) {
        observerMap_[115] = ObserverContext{ 0, 82, -1, -99.00f, 99.00f };
    }
    if (116 < kNumTotalParameters) {
        observerMap_[116] = ObserverContext{ 0, 83, -1, -1.00f, 1.00f };
    }
    if (117 < kNumTotalParameters) {
        observerMap_[117] = ObserverContext{ 0, 84, -1, -1.00f, 1.00f };
    }
    if (118 < kNumTotalParameters) {
        observerMap_[118] = ObserverContext{ 0, 85, -1, -1.00f, 1.00f };
    }
    if (119 < kNumTotalParameters) {
        observerMap_[119] = ObserverContext{ 0, 86, -1, -1.00f, 1.00f };
    }
    if (120 < kNumTotalParameters) {
        observerMap_[120] = ObserverContext{ 0, 87, -1, 0.00f, 1.00f };
    }
    if (121 < kNumTotalParameters) {
        observerMap_[121] = ObserverContext{ 0, 88, -1, 1.00f, 127.00f };
    }
    if (125 < kNumTotalParameters) {
        observerMap_[125] = ObserverContext{ 0, 91, -1, -1.00f, 1.00f };
    }
    if (126 < kNumTotalParameters) {
        observerMap_[126] = ObserverContext{ 0, 92, -1, -1.00f, 1.00f };
    }
    if (127 < kNumTotalParameters) {
        observerMap_[127] = ObserverContext{ 0, 93, -1, -1.00f, 1.00f };
    }
    if (128 < kNumTotalParameters) {
        observerMap_[128] = ObserverContext{ 0, 94, -1, -1.00f, 1.00f };
    }
    if (129 < kNumTotalParameters) {
        observerMap_[129] = ObserverContext{ 0, 95, -1, -1.00f, 1.00f };
    }
    if (130 < kNumTotalParameters) {
        observerMap_[130] = ObserverContext{ 0, 96, -1, -1.00f, 1.00f };
    }
    if (124 < kNumTotalParameters) {
        observerMap_[124] = ObserverContext{ 0, 97, -1, 0.00f, 2.00f };
    }
    if (135 < kNumTotalParameters) {
        observerMap_[135] = ObserverContext{ 0, 100, -1, -1.00f, 1.00f };
    }
    if (136 < kNumTotalParameters) {
        observerMap_[136] = ObserverContext{ 0, 101, -1, -1.00f, 1.00f };
    }
    if (137 < kNumTotalParameters) {
        observerMap_[137] = ObserverContext{ 0, 102, -1, -1.00f, 1.00f };
    }
    if (138 < kNumTotalParameters) {
        observerMap_[138] = ObserverContext{ 0, 103, -1, -1.00f, 1.00f };
    }
    if (139 < kNumTotalParameters) {
        observerMap_[139] = ObserverContext{ 0, 104, -1, -1.00f, 1.00f };
    }
    if (140 < kNumTotalParameters) {
        observerMap_[140] = ObserverContext{ 0, 105, -1, -1.00f, 1.00f };
    }
    if (134 < kNumTotalParameters) {
        observerMap_[134] = ObserverContext{ 0, 106, -1, 0.00f, 2.00f };
    }
    if (145 < kNumTotalParameters) {
        observerMap_[145] = ObserverContext{ 0, 109, -1, -1.00f, 1.00f };
    }
    if (146 < kNumTotalParameters) {
        observerMap_[146] = ObserverContext{ 0, 110, -1, -1.00f, 1.00f };
    }
    if (147 < kNumTotalParameters) {
        observerMap_[147] = ObserverContext{ 0, 111, -1, -1.00f, 1.00f };
    }
    if (148 < kNumTotalParameters) {
        observerMap_[148] = ObserverContext{ 0, 112, -1, -1.00f, 1.00f };
    }
    if (149 < kNumTotalParameters) {
        observerMap_[149] = ObserverContext{ 0, 113, -1, -1.00f, 1.00f };
    }
    if (150 < kNumTotalParameters) {
        observerMap_[150] = ObserverContext{ 0, 114, -1, -1.00f, 1.00f };
    }
    if (144 < kNumTotalParameters) {
        observerMap_[144] = ObserverContext{ 0, 115, -1, 0.00f, 2.00f };
    }
    if (155 < kNumTotalParameters) {
        observerMap_[155] = ObserverContext{ 0, 118, -1, -1.00f, 1.00f };
    }
    if (156 < kNumTotalParameters) {
        observerMap_[156] = ObserverContext{ 0, 119, -1, -1.00f, 1.00f };
    }
    if (157 < kNumTotalParameters) {
        observerMap_[157] = ObserverContext{ 0, 120, -1, -1.00f, 1.00f };
    }
    if (158 < kNumTotalParameters) {
        observerMap_[158] = ObserverContext{ 0, 121, -1, -1.00f, 1.00f };
    }
    if (159 < kNumTotalParameters) {
        observerMap_[159] = ObserverContext{ 0, 122, -1, -1.00f, 1.00f };
    }
    if (160 < kNumTotalParameters) {
        observerMap_[160] = ObserverContext{ 0, 123, -1, -1.00f, 1.00f };
    }
    if (154 < kNumTotalParameters) {
        observerMap_[154] = ObserverContext{ 0, 124, -1, 0.00f, 2.00f };
    }
    if (165 < kNumTotalParameters) {
        observerMap_[165] = ObserverContext{ 0, 127, -1, -1.00f, 1.00f };
    }
    if (166 < kNumTotalParameters) {
        observerMap_[166] = ObserverContext{ 0, 128, -1, -1.00f, 1.00f };
    }
    if (167 < kNumTotalParameters) {
        observerMap_[167] = ObserverContext{ 0, 129, -1, -1.00f, 1.00f };
    }
    if (168 < kNumTotalParameters) {
        observerMap_[168] = ObserverContext{ 0, 130, -1, -1.00f, 1.00f };
    }
    if (169 < kNumTotalParameters) {
        observerMap_[169] = ObserverContext{ 0, 131, -1, -1.00f, 1.00f };
    }
    if (170 < kNumTotalParameters) {
        observerMap_[170] = ObserverContext{ 0, 132, -1, -1.00f, 1.00f };
    }
    if (164 < kNumTotalParameters) {
        observerMap_[164] = ObserverContext{ 0, 133, -1, 0.00f, 2.00f };
    }
    if (175 < kNumTotalParameters) {
        observerMap_[175] = ObserverContext{ 0, 136, -1, -1.00f, 1.00f };
    }
    if (176 < kNumTotalParameters) {
        observerMap_[176] = ObserverContext{ 0, 137, -1, -1.00f, 1.00f };
    }
    if (177 < kNumTotalParameters) {
        observerMap_[177] = ObserverContext{ 0, 138, -1, -1.00f, 1.00f };
    }
    if (178 < kNumTotalParameters) {
        observerMap_[178] = ObserverContext{ 0, 139, -1, -1.00f, 1.00f };
    }
    if (179 < kNumTotalParameters) {
        observerMap_[179] = ObserverContext{ 0, 140, -1, -1.00f, 1.00f };
    }
    if (180 < kNumTotalParameters) {
        observerMap_[180] = ObserverContext{ 0, 141, -1, -1.00f, 1.00f };
    }
    if (174 < kNumTotalParameters) {
        observerMap_[174] = ObserverContext{ 0, 142, -1, 0.00f, 2.00f };
    }
    if (186 < kNumTotalParameters) {
        observerMap_[186] = ObserverContext{ 0, 147, -1, 0.00f, 1.00f };
    }
    if (187 < kNumTotalParameters) {
        observerMap_[187] = ObserverContext{ 0, 148, -1, -1.00f, 1.00f };
    }
    if (188 < kNumTotalParameters) {
        observerMap_[188] = ObserverContext{ 0, 149, -1, -1.00f, 1.00f };
    }
    if (189 < kNumTotalParameters) {
        observerMap_[189] = ObserverContext{ 0, 150, -1, -1.00f, 1.00f };
    }
    if (190 < kNumTotalParameters) {
        observerMap_[190] = ObserverContext{ 0, 151, -1, -1.00f, 1.00f };
    }
    if (191 < kNumTotalParameters) {
        observerMap_[191] = ObserverContext{ 0, 152, -1, -1.00f, 1.00f };
    }
    if (192 < kNumTotalParameters) {
        observerMap_[192] = ObserverContext{ 0, 153, -1, -1.00f, 1.00f };
    }
    if (193 < kNumTotalParameters) {
        observerMap_[193] = ObserverContext{ 0, 154, -1, -1.00f, 1.00f };
    }
    if (194 < kNumTotalParameters) {
        observerMap_[194] = ObserverContext{ 0, 155, -1, -1.00f, 1.00f };
    }
    if (195 < kNumTotalParameters) {
        observerMap_[195] = ObserverContext{ 0, 156, -1, -1.00f, 1.00f };
    }
    if (196 < kNumTotalParameters) {
        observerMap_[196] = ObserverContext{ 0, 157, -1, -1.00f, 1.00f };
    }
    if (197 < kNumTotalParameters) {
        observerMap_[197] = ObserverContext{ 0, 158, -1, -1.00f, 1.00f };
    }
    if (198 < kNumTotalParameters) {
        observerMap_[198] = ObserverContext{ 0, 159, -1, -1.00f, 1.00f };
    }
    if (199 < kNumTotalParameters) {
        observerMap_[199] = ObserverContext{ 0, 160, -1, -1.00f, 1.00f };
    }
    if (204 < kNumTotalParameters) {
        observerMap_[204] = ObserverContext{ 0, 165, -1, 0.00f, 1.00f };
    }
    if (209 < kNumTotalParameters) {
        observerMap_[209] = ObserverContext{ 0, 170, -1, 0.00f, 1.00f };
    }
    if (210 < kNumTotalParameters) {
        observerMap_[210] = ObserverContext{ 0, 171, -1, 0.00f, 1.00f };
    }
    if (211 < kNumTotalParameters) {
        observerMap_[211] = ObserverContext{ 0, 172, -1, -1.00f, 1.00f };
    }
    if (216 < kNumTotalParameters) {
        observerMap_[216] = ObserverContext{ 0, 177, -1, 0.00f, 1.00f };
    }
    if (217 < kNumTotalParameters) {
        observerMap_[217] = ObserverContext{ 0, 178, -1, -1.00f, 1.00f };
    }
    if (218 < kNumTotalParameters) {
        observerMap_[218] = ObserverContext{ 0, 179, -1, -1.00f, 1.00f };
    }
    if (219 < kNumTotalParameters) {
        observerMap_[219] = ObserverContext{ 0, 180, -1, -1.00f, 1.00f };
    }
    if (220 < kNumTotalParameters) {
        observerMap_[220] = ObserverContext{ 0, 181, -1, -1.00f, 1.00f };
    }
    if (221 < kNumTotalParameters) {
        observerMap_[221] = ObserverContext{ 0, 182, -1, -1.00f, 1.00f };
    }
    if (222 < kNumTotalParameters) {
        observerMap_[222] = ObserverContext{ 0, 183, -1, -1.00f, 1.00f };
    }
    if (223 < kNumTotalParameters) {
        observerMap_[223] = ObserverContext{ 0, 184, -1, -1.00f, 1.00f };
    }
    if (224 < kNumTotalParameters) {
        observerMap_[224] = ObserverContext{ 0, 185, -1, -1.00f, 1.00f };
    }
    if (225 < kNumTotalParameters) {
        observerMap_[225] = ObserverContext{ 0, 186, -1, -1.00f, 1.00f };
    }
    if (226 < kNumTotalParameters) {
        observerMap_[226] = ObserverContext{ 0, 187, -1, -1.00f, 1.00f };
    }
    if (227 < kNumTotalParameters) {
        observerMap_[227] = ObserverContext{ 0, 188, -1, -1.00f, 1.00f };
    }
    if (228 < kNumTotalParameters) {
        observerMap_[228] = ObserverContext{ 0, 189, -1, -1.00f, 1.00f };
    }
    if (229 < kNumTotalParameters) {
        observerMap_[229] = ObserverContext{ 0, 190, -1, -1.00f, 1.00f };
    }
    if (234 < kNumTotalParameters) {
        observerMap_[234] = ObserverContext{ 0, 195, -1, 0.00f, 1.00f };
    }
    if (239 < kNumTotalParameters) {
        observerMap_[239] = ObserverContext{ 0, 200, -1, 0.00f, 1.00f };
    }
    if (240 < kNumTotalParameters) {
        observerMap_[240] = ObserverContext{ 0, 201, -1, 0.00f, 1.00f };
    }
    if (241 < kNumTotalParameters) {
        observerMap_[241] = ObserverContext{ 0, 202, -1, -1.00f, 1.00f };
    }
    if (242 < kNumTotalParameters) {
        observerMap_[242] = ObserverContext{ 0, 203, -1, -1.00f, 1.00f };
    }
    if (243 < kNumTotalParameters) {
        observerMap_[243] = ObserverContext{ 0, 204, -1, -1.00f, 1.00f };
    }
    if (244 < kNumTotalParameters) {
        observerMap_[244] = ObserverContext{ 0, 205, -1, -1.00f, 1.00f };
    }
    if (245 < kNumTotalParameters) {
        observerMap_[245] = ObserverContext{ 0, 206, -1, -1.00f, 1.00f };
    }
    if (246 < kNumTotalParameters) {
        observerMap_[246] = ObserverContext{ 0, 207, -1, 0.00f, 1.00f };
    }
    if (247 < kNumTotalParameters) {
        observerMap_[247] = ObserverContext{ 0, 208, -1, 0.00f, 1.00f };
    }
    if (248 < kNumTotalParameters) {
        observerMap_[248] = ObserverContext{ 0, 209, -1, 0.00f, 1.00f };
    }
    if (249 < kNumTotalParameters) {
        observerMap_[249] = ObserverContext{ 0, 210, -1, 0.00f, 1.00f };
    }
    if (250 < kNumTotalParameters) {
        observerMap_[250] = ObserverContext{ 0, 211, -1, 0.00f, 1.00f };
    }
    if (251 < kNumTotalParameters) {
        observerMap_[251] = ObserverContext{ 0, 212, -1, 0.00f, 1.00f };
    }
    if (252 < kNumTotalParameters) {
        observerMap_[252] = ObserverContext{ 0, 213, -1, -1.00f, 1.00f };
    }
    if (254 < kNumTotalParameters) {
        observerMap_[254] = ObserverContext{ 0, 214, -1, 0.00f, 1.00f };
    }
    if (256 < kNumTotalParameters) {
        observerMap_[256] = ObserverContext{ 0, 215, -1, 0.00f, 1.00f };
    }
    if (259 < kNumTotalParameters) {
        observerMap_[259] = ObserverContext{ 0, 218, -1, -1.00f, 1.00f };
    }
    if (260 < kNumTotalParameters) {
        observerMap_[260] = ObserverContext{ 0, 219, -1, 0.00f, 11.00f };
    }
    if (261 < kNumTotalParameters) {
        observerMap_[261] = ObserverContext{ 0, 220, -1, 0.00f, 9.00f };
    }
    if (263 < kNumTotalParameters) {
        observerMap_[263] = ObserverContext{ 0, 222, -1, -1.00f, 1.00f };
    }
    if (264 < kNumTotalParameters) {
        observerMap_[264] = ObserverContext{ 0, 223, -1, -1.00f, 1.00f };
    }
    if (265 < kNumTotalParameters) {
        observerMap_[265] = ObserverContext{ 0, 224, -1, -1.00f, 1.00f };
    }
    if (266 < kNumTotalParameters) {
        observerMap_[266] = ObserverContext{ 0, 225, -1, 0.00f, 1.00f };
    }
    if (267 < kNumTotalParameters) {
        observerMap_[267] = ObserverContext{ 0, 226, -1, 0.00f, 2.00f };
    }
    if (270 < kNumTotalParameters) {
        observerMap_[270] = ObserverContext{ 0, 229, -1, 0.00f, 11.00f };
    }
    if (273 < kNumTotalParameters) {
        observerMap_[273] = ObserverContext{ 0, 230, -1, 0.00f, 4.00f };
    }
    if (276 < kNumTotalParameters) {
        observerMap_[276] = ObserverContext{ 0, 233, -1, -1.00f, 1.00f };
    }
    if (277 < kNumTotalParameters) {
        observerMap_[277] = ObserverContext{ 0, 234, -1, -1.00f, 1.00f };
    }
    if (278 < kNumTotalParameters) {
        observerMap_[278] = ObserverContext{ 0, 235, -1, -1.00f, 1.00f };
    }
    if (279 < kNumTotalParameters) {
        observerMap_[279] = ObserverContext{ 0, 236, -1, 0.00f, 2.00f };
    }
    if (359 < kNumTotalParameters) {
        observerMap_[359] = ObserverContext{ 0, 241, -1, 0.00f, 1.00f };
    }
    if (360 < kNumTotalParameters) {
        observerMap_[360] = ObserverContext{ 0, 242, -1, -1.00f, 1.00f };
    }
    if (361 < kNumTotalParameters) {
        observerMap_[361] = ObserverContext{ 0, 243, -1, -1.00f, 1.00f };
    }
    if (271 < kNumTotalParameters) {
        observerMap_[271] = ObserverContext{ 0, 244, -1, 0.00f, 1.00f };
    }
    if (281 < kNumTotalParameters) {
        observerMap_[281] = ObserverContext{ 0, 245, -1, 0.00f, 1.00f };
    }
    if (282 < kNumTotalParameters) {
        observerMap_[282] = ObserverContext{ 0, 246, -1, 0.00f, 4.00f };
    }
    if (283 < kNumTotalParameters) {
        observerMap_[283] = ObserverContext{ 0, 247, -1, 0.00f, 2.00f };
    }
    if (285 < kNumTotalParameters) {
        observerMap_[285] = ObserverContext{ 0, 248, -1, 0.00f, 1.00f };
    }
    if (286 < kNumTotalParameters) {
        observerMap_[286] = ObserverContext{ 0, 249, -1, 0.00f, 1.00f };
    }
    if (287 < kNumTotalParameters) {
        observerMap_[287] = ObserverContext{ 0, 250, -1, -1.00f, 1.00f };
    }
    if (288 < kNumTotalParameters) {
        observerMap_[288] = ObserverContext{ 0, 251, -1, 0.00f, 127.00f };
    }
    if (289 < kNumTotalParameters) {
        observerMap_[289] = ObserverContext{ 0, 252, -1, 0.01f, 1.00f };
    }
    if (290 < kNumTotalParameters) {
        observerMap_[290] = ObserverContext{ 0, 253, -1, 0.00f, 1.00f };
    }
    if (291 < kNumTotalParameters) {
        observerMap_[291] = ObserverContext{ 0, 254, -1, -1.00f, 1.00f };
    }
    if (292 < kNumTotalParameters) {
        observerMap_[292] = ObserverContext{ 0, 255, -1, 0.00f, 127.00f };
    }
    if (293 < kNumTotalParameters) {
        observerMap_[293] = ObserverContext{ 0, 256, -1, 0.01f, 1.00f };
    }
    if (294 < kNumTotalParameters) {
        observerMap_[294] = ObserverContext{ 0, 257, -1, 0.00f, 1.00f };
    }
    if (295 < kNumTotalParameters) {
        observerMap_[295] = ObserverContext{ 0, 258, -1, -1.00f, 1.00f };
    }
    if (296 < kNumTotalParameters) {
        observerMap_[296] = ObserverContext{ 0, 259, -1, 0.00f, 127.00f };
    }
    if (297 < kNumTotalParameters) {
        observerMap_[297] = ObserverContext{ 0, 260, -1, 0.01f, 1.00f };
    }
    if (298 < kNumTotalParameters) {
        observerMap_[298] = ObserverContext{ 0, 261, -1, 0.00f, 1.00f };
    }
    if (299 < kNumTotalParameters) {
        observerMap_[299] = ObserverContext{ 0, 262, -1, -1.00f, 1.00f };
    }
    if (300 < kNumTotalParameters) {
        observerMap_[300] = ObserverContext{ 0, 263, -1, 0.00f, 127.00f };
    }
    if (301 < kNumTotalParameters) {
        observerMap_[301] = ObserverContext{ 0, 264, -1, 0.01f, 1.00f };
    }
    if (302 < kNumTotalParameters) {
        observerMap_[302] = ObserverContext{ 0, 265, -1, 0.00f, 1.00f };
    }
    if (303 < kNumTotalParameters) {
        observerMap_[303] = ObserverContext{ 0, 266, -1, -1.00f, 0.00f };
    }
    if (304 < kNumTotalParameters) {
        observerMap_[304] = ObserverContext{ 0, 267, -1, 0.00f, 1.00f };
    }
    if (305 < kNumTotalParameters) {
        observerMap_[305] = ObserverContext{ 0, 268, -1, 0.00f, 1.00f };
    }
    if (306 < kNumTotalParameters) {
        observerMap_[306] = ObserverContext{ 0, 269, -1, 0.00f, 1.00f };
    }
    if (307 < kNumTotalParameters) {
        observerMap_[307] = ObserverContext{ 0, 270, -1, 0.00f, 1.00f };
    }
    if (308 < kNumTotalParameters) {
        observerMap_[308] = ObserverContext{ 0, 271, -1, 0.00f, 5.00f };
    }
    if (309 < kNumTotalParameters) {
        observerMap_[309] = ObserverContext{ 0, 272, -1, 0.00f, 1.00f };
    }
    if (310 < kNumTotalParameters) {
        observerMap_[310] = ObserverContext{ 0, 273, -1, 0.00f, 1.00f };
    }
    if (311 < kNumTotalParameters) {
        observerMap_[311] = ObserverContext{ 0, 274, -1, 0.00f, 1.00f };
    }
    if (312 < kNumTotalParameters) {
        observerMap_[312] = ObserverContext{ 0, 275, -1, 0.00f, 1.00f };
    }
    if (313 < kNumTotalParameters) {
        observerMap_[313] = ObserverContext{ 0, 276, -1, 0.00f, 11.00f };
    }
    if (314 < kNumTotalParameters) {
        observerMap_[314] = ObserverContext{ 0, 277, -1, 0.00f, 1.00f };
    }
    if (315 < kNumTotalParameters) {
        observerMap_[315] = ObserverContext{ 0, 278, -1, 0.00f, 1.00f };
    }
    if (316 < kNumTotalParameters) {
        observerMap_[316] = ObserverContext{ 0, 279, -1, 0.00f, 1.00f };
    }
    if (317 < kNumTotalParameters) {
        observerMap_[317] = ObserverContext{ 0, 280, -1, -1.00f, 1.00f };
    }
    if (318 < kNumTotalParameters) {
        observerMap_[318] = ObserverContext{ 0, 281, -1, 0.00f, 1.00f };
    }
    if (319 < kNumTotalParameters) {
        observerMap_[319] = ObserverContext{ 0, 282, -1, 0.00f, 1.00f };
    }
    if (320 < kNumTotalParameters) {
        observerMap_[320] = ObserverContext{ 0, 283, -1, 0.00f, 1.00f };
    }
    if (321 < kNumTotalParameters) {
        observerMap_[321] = ObserverContext{ 0, 284, -1, 0.00f, 1.00f };
    }
    if (322 < kNumTotalParameters) {
        observerMap_[322] = ObserverContext{ 0, 285, -1, 0.00f, 1.00f };
    }
    if (323 < kNumTotalParameters) {
        observerMap_[323] = ObserverContext{ 0, 286, -1, 0.00f, 1.00f };
    }
    if (324 < kNumTotalParameters) {
        observerMap_[324] = ObserverContext{ 0, 287, -1, 0.00f, 1.00f };
    }
    if (325 < kNumTotalParameters) {
        observerMap_[325] = ObserverContext{ 0, 288, -1, 0.00f, 1.00f };
    }
    if (326 < kNumTotalParameters) {
        observerMap_[326] = ObserverContext{ 0, 289, -1, 0.00f, 1.00f };
    }
    if (327 < kNumTotalParameters) {
        observerMap_[327] = ObserverContext{ 0, 290, -1, 0.00f, 1.00f };
    }
    if (328 < kNumTotalParameters) {
        observerMap_[328] = ObserverContext{ 0, 291, -1, 0.00f, 4.00f };
    }
    if (329 < kNumTotalParameters) {
        observerMap_[329] = ObserverContext{ 0, 292, -1, 0.00f, 2.00f };
    }
    if (331 < kNumTotalParameters) {
        observerMap_[331] = ObserverContext{ 0, 293, -1, -1.00f, 1.00f };
    }
    if (332 < kNumTotalParameters) {
        observerMap_[332] = ObserverContext{ 0, 294, -1, -1.00f, 1.00f };
    }
    if (333 < kNumTotalParameters) {
        observerMap_[333] = ObserverContext{ 0, 295, -1, 0.00f, 1.00f };
    }
    if (334 < kNumTotalParameters) {
        observerMap_[334] = ObserverContext{ 0, 296, -1, 0.00f, 1.00f };
    }
    if (335 < kNumTotalParameters) {
        observerMap_[335] = ObserverContext{ 0, 297, -1, -1.00f, 1.00f };
    }
    if (336 < kNumTotalParameters) {
        observerMap_[336] = ObserverContext{ 0, 298, -1, 0.00f, 1.00f };
    }
    if (337 < kNumTotalParameters) {
        observerMap_[337] = ObserverContext{ 0, 299, -1, 0.00f, 1.00f };
    }
    if (338 < kNumTotalParameters) {
        observerMap_[338] = ObserverContext{ 0, 300, -1, 0.00f, 1.00f };
    }
    if (339 < kNumTotalParameters) {
        observerMap_[339] = ObserverContext{ 0, 301, -1, 0.00f, 11.00f };
    }
    if (340 < kNumTotalParameters) {
        observerMap_[340] = ObserverContext{ 0, 302, -1, -1.00f, 1.00f };
    }
    if (341 < kNumTotalParameters) {
        observerMap_[341] = ObserverContext{ 0, 303, -1, -1.00f, 1.00f };
    }
    if (342 < kNumTotalParameters) {
        observerMap_[342] = ObserverContext{ 0, 304, -1, 0.00f, 1.00f };
    }
    if (343 < kNumTotalParameters) {
        observerMap_[343] = ObserverContext{ 0, 305, -1, 0.00f, 1.00f };
    }
    if (344 < kNumTotalParameters) {
        observerMap_[344] = ObserverContext{ 0, 306, -1, 0.00f, 1.00f };
    }
    if (345 < kNumTotalParameters) {
        observerMap_[345] = ObserverContext{ 0, 307, -1, 0.00f, 11.00f };
    }
    if (346 < kNumTotalParameters) {
        observerMap_[346] = ObserverContext{ 0, 308, -1, -1.00f, 1.00f };
    }
    if (347 < kNumTotalParameters) {
        observerMap_[347] = ObserverContext{ 0, 309, -1, -1.00f, 1.00f };
    }
    if (348 < kNumTotalParameters) {
        observerMap_[348] = ObserverContext{ 0, 310, -1, 0.00f, 1.00f };
    }
    if (349 < kNumTotalParameters) {
        observerMap_[349] = ObserverContext{ 0, 311, -1, 0.00f, 1.00f };
    }
    if (350 < kNumTotalParameters) {
        observerMap_[350] = ObserverContext{ 0, 312, -1, 0.00f, 1.00f };
    }
    if (351 < kNumTotalParameters) {
        observerMap_[351] = ObserverContext{ 0, 313, -1, 0.00f, 11.00f };
    }
    if (352 < kNumTotalParameters) {
        observerMap_[352] = ObserverContext{ 0, 314, -1, -1.00f, 1.00f };
    }
    if (353 < kNumTotalParameters) {
        observerMap_[353] = ObserverContext{ 0, 315, -1, -1.00f, 1.00f };
    }
    if (354 < kNumTotalParameters) {
        observerMap_[354] = ObserverContext{ 0, 316, -1, 0.00f, 1.00f };
    }
    if (430 < kNumTotalParameters) {
        observerMap_[430] = ObserverContext{ 0, 380, -1, 0.00f, 1.00f };
    }
    if (431 < kNumTotalParameters) {
        observerMap_[431] = ObserverContext{ 0, 381, -1, 0.00f, 1.00f };
    }
    if (433 < kNumTotalParameters) {
        observerMap_[433] = ObserverContext{ 0, 382, -1, 0.00f, 1.00f };
    }
    if (434 < kNumTotalParameters) {
        observerMap_[434] = ObserverContext{ 0, 383, -1, 0.00f, 1.00f };
    }
    if (435 < kNumTotalParameters) {
        observerMap_[435] = ObserverContext{ 0, 384, -1, -1.00f, 1.00f };
    }
    if (436 < kNumTotalParameters) {
        observerMap_[436] = ObserverContext{ 0, 385, -1, 0.00f, 1.00f };
    }
    if (437 < kNumTotalParameters) {
        observerMap_[437] = ObserverContext{ 0, 386, -1, 0.00f, 1.00f };
    }
    if (439 < kNumTotalParameters) {
        observerMap_[439] = ObserverContext{ 0, 387, -1, 0.00f, 4.00f };
    }
    if (440 < kNumTotalParameters) {
        observerMap_[440] = ObserverContext{ 0, 388, -1, 0.00f, 1.00f };
    }
    if (441 < kNumTotalParameters) {
        observerMap_[441] = ObserverContext{ 0, 389, -1, 0.00f, 1.00f };
    }
    if (442 < kNumTotalParameters) {
        observerMap_[442] = ObserverContext{ 0, 390, -1, 0.00f, 1.00f };
    }
    if (443 < kNumTotalParameters) {
        observerMap_[443] = ObserverContext{ 0, 391, -1, 0.00f, 1.00f };
    }
    if (444 < kNumTotalParameters) {
        observerMap_[444] = ObserverContext{ 0, 392, -1, 0.00f, 1.00f };
    }
    if (27 < kNumTotalParameters) {
        observerMap_[27] = ObserverContext{ 0, 4, 0, 0.00f, 1.00f };
    }
    if (34 < kNumTotalParameters) {
        observerMap_[34] = ObserverContext{ 0, 11, 1, -24.00f, 24.00f };
    }
    if (52 < kNumTotalParameters) {
        observerMap_[52] = ObserverContext{ 0, 28, 2, 0.00f, 1.00f };
    }
    if (53 < kNumTotalParameters) {
        observerMap_[53] = ObserverContext{ 0, 29, 3, 0.00f, 1.00f };
    }
    if (42 < kNumTotalParameters) {
        observerMap_[42] = ObserverContext{ 0, 19, 4, 0.00f, 1.00f };
    }
    if (43 < kNumTotalParameters) {
        observerMap_[43] = ObserverContext{ 0, 20, 5, 0.00f, 1.00f };
    }
    if (72 < kNumTotalParameters) {
        observerMap_[72] = ObserverContext{ 0, 46, 6, 0.00f, 1.00f };
    }
    if (73 < kNumTotalParameters) {
        observerMap_[73] = ObserverContext{ 0, 47, 7, 0.00f, 1.00f };
    }
    if (62 < kNumTotalParameters) {
        observerMap_[62] = ObserverContext{ 0, 37, 8, 0.00f, 1.00f };
    }
    if (63 < kNumTotalParameters) {
        observerMap_[63] = ObserverContext{ 0, 38, 9, 0.00f, 1.00f };
    }
    if (92 < kNumTotalParameters) {
        observerMap_[92] = ObserverContext{ 0, 64, 10, 0.00f, 1.00f };
    }
    if (93 < kNumTotalParameters) {
        observerMap_[93] = ObserverContext{ 0, 65, 11, 0.00f, 1.00f };
    }
    if (82 < kNumTotalParameters) {
        observerMap_[82] = ObserverContext{ 0, 55, 12, 0.00f, 1.00f };
    }
    if (83 < kNumTotalParameters) {
        observerMap_[83] = ObserverContext{ 0, 56, 13, 0.00f, 1.00f };
    }
    if (107 < kNumTotalParameters) {
        observerMap_[107] = ObserverContext{ 0, 74, 14, 0.00f, 1.00f };
    }
    if (114 < kNumTotalParameters) {
        observerMap_[114] = ObserverContext{ 0, 81, 15, -24.00f, 24.00f };
    }
    if (132 < kNumTotalParameters) {
        observerMap_[132] = ObserverContext{ 0, 98, 16, 0.00f, 1.00f };
    }
    if (133 < kNumTotalParameters) {
        observerMap_[133] = ObserverContext{ 0, 99, 17, 0.00f, 1.00f };
    }
    if (122 < kNumTotalParameters) {
        observerMap_[122] = ObserverContext{ 0, 89, 18, 0.00f, 1.00f };
    }
    if (123 < kNumTotalParameters) {
        observerMap_[123] = ObserverContext{ 0, 90, 19, 0.00f, 1.00f };
    }
    if (152 < kNumTotalParameters) {
        observerMap_[152] = ObserverContext{ 0, 116, 20, 0.00f, 1.00f };
    }
    if (153 < kNumTotalParameters) {
        observerMap_[153] = ObserverContext{ 0, 117, 21, 0.00f, 1.00f };
    }
    if (142 < kNumTotalParameters) {
        observerMap_[142] = ObserverContext{ 0, 107, 22, 0.00f, 1.00f };
    }
    if (143 < kNumTotalParameters) {
        observerMap_[143] = ObserverContext{ 0, 108, 23, 0.00f, 1.00f };
    }
    if (172 < kNumTotalParameters) {
        observerMap_[172] = ObserverContext{ 0, 134, 24, 0.00f, 1.00f };
    }
    if (173 < kNumTotalParameters) {
        observerMap_[173] = ObserverContext{ 0, 135, 25, 0.00f, 1.00f };
    }
    if (162 < kNumTotalParameters) {
        observerMap_[162] = ObserverContext{ 0, 125, 26, 0.00f, 1.00f };
    }
    if (163 < kNumTotalParameters) {
        observerMap_[163] = ObserverContext{ 0, 126, 27, 0.00f, 1.00f };
    }
    if (182 < kNumTotalParameters) {
        observerMap_[182] = ObserverContext{ 0, 143, 28, 0.00f, 1.00f };
    }
    if (183 < kNumTotalParameters) {
        observerMap_[183] = ObserverContext{ 0, 144, 29, 0.00f, 1.00f };
    }
    if (184 < kNumTotalParameters) {
        observerMap_[184] = ObserverContext{ 0, 145, 30, 0.00f, 1.00f };
    }
    if (185 < kNumTotalParameters) {
        observerMap_[185] = ObserverContext{ 0, 146, 31, 0.00f, 1.00f };
    }
    if (200 < kNumTotalParameters) {
        observerMap_[200] = ObserverContext{ 0, 161, 32, 0.00f, 1.00f };
    }
    if (201 < kNumTotalParameters) {
        observerMap_[201] = ObserverContext{ 0, 162, 33, 0.00f, 1.00f };
    }
    if (202 < kNumTotalParameters) {
        observerMap_[202] = ObserverContext{ 0, 163, 34, 0.00f, 1.00f };
    }
    if (203 < kNumTotalParameters) {
        observerMap_[203] = ObserverContext{ 0, 164, 35, 0.00f, 1.00f };
    }
    if (205 < kNumTotalParameters) {
        observerMap_[205] = ObserverContext{ 0, 166, 36, 0.00f, 1.00f };
    }
    if (206 < kNumTotalParameters) {
        observerMap_[206] = ObserverContext{ 0, 167, 37, 0.00f, 1.00f };
    }
    if (207 < kNumTotalParameters) {
        observerMap_[207] = ObserverContext{ 0, 168, 38, 0.00f, 1.00f };
    }
    if (208 < kNumTotalParameters) {
        observerMap_[208] = ObserverContext{ 0, 169, 39, 0.00f, 1.00f };
    }
    if (212 < kNumTotalParameters) {
        observerMap_[212] = ObserverContext{ 0, 173, 40, 0.00f, 1.00f };
    }
    if (213 < kNumTotalParameters) {
        observerMap_[213] = ObserverContext{ 0, 174, 41, 0.00f, 1.00f };
    }
    if (214 < kNumTotalParameters) {
        observerMap_[214] = ObserverContext{ 0, 175, 42, 0.00f, 1.00f };
    }
    if (215 < kNumTotalParameters) {
        observerMap_[215] = ObserverContext{ 0, 176, 43, 0.00f, 1.00f };
    }
    if (230 < kNumTotalParameters) {
        observerMap_[230] = ObserverContext{ 0, 191, 44, 0.00f, 1.00f };
    }
    if (231 < kNumTotalParameters) {
        observerMap_[231] = ObserverContext{ 0, 192, 45, 0.00f, 1.00f };
    }
    if (232 < kNumTotalParameters) {
        observerMap_[232] = ObserverContext{ 0, 193, 46, 0.00f, 1.00f };
    }
    if (233 < kNumTotalParameters) {
        observerMap_[233] = ObserverContext{ 0, 194, 47, 0.00f, 1.00f };
    }
    if (235 < kNumTotalParameters) {
        observerMap_[235] = ObserverContext{ 0, 196, 48, 0.00f, 1.00f };
    }
    if (236 < kNumTotalParameters) {
        observerMap_[236] = ObserverContext{ 0, 197, 49, 0.00f, 1.00f };
    }
    if (237 < kNumTotalParameters) {
        observerMap_[237] = ObserverContext{ 0, 198, 50, 0.00f, 1.00f };
    }
    if (238 < kNumTotalParameters) {
        observerMap_[238] = ObserverContext{ 0, 199, 51, 0.00f, 1.00f };
    }
    if (355 < kNumTotalParameters) {
        observerMap_[355] = ObserverContext{ 0, 237, 52, 0.00f, 1.00f };
    }
    if (356 < kNumTotalParameters) {
        observerMap_[356] = ObserverContext{ 0, 238, 53, 0.00f, 1.00f };
    }
    if (357 < kNumTotalParameters) {
        observerMap_[357] = ObserverContext{ 0, 239, 54, 0.00f, 1.00f };
    }
    if (358 < kNumTotalParameters) {
        observerMap_[358] = ObserverContext{ 0, 240, 55, 0.00f, 1.00f };
    }
    if (262 < kNumTotalParameters) {
        observerMap_[262] = ObserverContext{ 0, 221, 56, 0.00f, 1.00f };
    }
    if (268 < kNumTotalParameters) {
        observerMap_[268] = ObserverContext{ 0, 227, 57, 0.00f, 1.00f };
    }
    if (269 < kNumTotalParameters) {
        observerMap_[269] = ObserverContext{ 0, 228, 58, 0.00f, 1.00f };
    }
    if (257 < kNumTotalParameters) {
        observerMap_[257] = ObserverContext{ 0, 216, 59, 0.00f, 1.00f };
    }
    if (258 < kNumTotalParameters) {
        observerMap_[258] = ObserverContext{ 0, 217, 60, 0.00f, 1.00f };
    }
    if (274 < kNumTotalParameters) {
        observerMap_[274] = ObserverContext{ 0, 231, 61, 0.00f, 1.00f };
    }
    if (275 < kNumTotalParameters) {
        observerMap_[275] = ObserverContext{ 0, 232, 62, 0.00f, 1.00f };
    }
}

void ParameterEngineBridge::bindStoreObservers() {
    for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
        store_.addObserver(i, [this](uint32_t paramId, float rawVal) {
            handleParamChange(paramId, rawVal);
        });
    }
}

} // namespace abd::axionik