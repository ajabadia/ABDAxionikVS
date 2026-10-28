// ============================================================================
// ABDAxionikVS — AxionikParamIndices.h
// Índices centralizados de parámetros (Single Source of Truth local)
// Al estilo ABDJUNiO601. Cobertura completa 445/445 frente al enum ParamID
// de ParameterRegistry.gen.h; verificada por Scripts/registry_generator.js --check.
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>

namespace abd::axionik {
namespace ParamIdx {

// ============================================================================
// Sound Header
// ============================================================================
inline constexpr uint32_t SoundVersionMajor = 0;
inline constexpr uint32_t SoundVersionMinor = 1;
inline constexpr uint32_t SoundVersionBuild  = 2;
inline constexpr uint32_t SoundPan          = 3;
inline constexpr uint32_t SoundPanKeyTrack  = 4;
inline constexpr uint32_t SoundNumVoices    = 5;

// Sound Name (6..21)
inline constexpr uint32_t SoundNameC00 = 6;
inline constexpr uint32_t SoundNameC01 = 7;
inline constexpr uint32_t SoundNameC02 = 8;
inline constexpr uint32_t SoundNameC03 = 9;
inline constexpr uint32_t SoundNameC04 = 10;
inline constexpr uint32_t SoundNameC05 = 11;
inline constexpr uint32_t SoundNameC06 = 12;
inline constexpr uint32_t SoundNameC07 = 13;
inline constexpr uint32_t SoundNameC08 = 14;
inline constexpr uint32_t SoundNameC09 = 15;
inline constexpr uint32_t SoundNameC10 = 16;
inline constexpr uint32_t SoundNameC11 = 17;
inline constexpr uint32_t SoundNameC12 = 18;
inline constexpr uint32_t SoundNameC13 = 19;
inline constexpr uint32_t SoundNameC14 = 20;
inline constexpr uint32_t SoundNameC15 = 21;

// ============================================================================
// Resynator 1 (R1)
// ============================================================================
inline constexpr uint32_t R1ModellIndex        = 22;
inline constexpr uint32_t R1Switch             = 23;
inline constexpr uint32_t R1Type               = 24;
inline constexpr uint32_t R1ParamLevel         = 25;
inline constexpr uint32_t R1SelectStickPar     = 26;
inline constexpr uint32_t R1Volume             = 27;
inline constexpr uint32_t R1AmpLfoDepth        = 28;
inline constexpr uint32_t R1AmpKeyTrack        = 29;
inline constexpr uint32_t R1VolumeVelocityDepth= 30;
inline constexpr uint32_t R1ModelSizeKeyTrack  = 31;
inline constexpr uint32_t R1ModelSizeOffset    = 32;
inline constexpr uint32_t R1Octave             = 33;
inline constexpr uint32_t R1Semi               = 34;
inline constexpr uint32_t R1Cents              = 35;
inline constexpr uint32_t R1PitchLfoDepth      = 36;
inline constexpr uint32_t R1PitchKeyTrack      = 37;
inline constexpr uint32_t R1FreeADSR1PitchDepth= 38;
inline constexpr uint32_t R1FreeADSR2PitchDepth= 39;
inline constexpr uint32_t R1Free4L4TPitchDepth = 40;
inline constexpr uint32_t R1ModelVelocitySwitch= 41;

// R1 Layer 1
inline constexpr uint32_t R1L1Sphere1Value      = 42;
inline constexpr uint32_t R1L1Sphere2Value      = 43;
inline constexpr uint32_t R1L1ContourSphere     = 44;
inline constexpr uint32_t R1L1Sphere1KeyTrack   = 45;
inline constexpr uint32_t R1L1Sphere2KeyTrack   = 46;
inline constexpr uint32_t R1L1Sphere1LfoDepth   = 47;
inline constexpr uint32_t R1L1Sphere2LfoDepth   = 48;
inline constexpr uint32_t R1L1Sphere1VelocityDepth= 49;
inline constexpr uint32_t R1L1Sphere2VelocityDepth= 50;
inline constexpr uint32_t R1L1SphereStickPlayback= 51;
inline constexpr uint32_t R1L1Scape1Value       = 52;
inline constexpr uint32_t R1L1Scape2Value       = 53;
inline constexpr uint32_t R1L1ContourScape      = 54;
inline constexpr uint32_t R1L1Scape1KeyTrack    = 55;
inline constexpr uint32_t R1L1Scape2KeyTrack    = 56;
inline constexpr uint32_t R1L1Scape1LfoDepth    = 57;
inline constexpr uint32_t R1L1Scape2LfoDepth    = 58;
inline constexpr uint32_t R1L1Scape1VelocityDepth= 59;
inline constexpr uint32_t R1L1Scape2VelocityDepth= 60;
inline constexpr uint32_t R1L1ScapeStickPlayback= 61;

// R1 Layer 2
inline constexpr uint32_t R1L2Sphere1Value      = 62;
inline constexpr uint32_t R1L2Sphere2Value      = 63;
inline constexpr uint32_t R1L2ContourSphere     = 64;
inline constexpr uint32_t R1L2Sphere1KeyTrack   = 65;
inline constexpr uint32_t R1L2Sphere2KeyTrack   = 66;
inline constexpr uint32_t R1L2Sphere1LfoDepth   = 67;
inline constexpr uint32_t R1L2Sphere2LfoDepth   = 68;
inline constexpr uint32_t R1L2Sphere1VelocityDepth= 69;
inline constexpr uint32_t R1L2Sphere2VelocityDepth= 70;
inline constexpr uint32_t R1L2SphereStickPlayback= 71;
inline constexpr uint32_t R1L2Scape1Value       = 72;
inline constexpr uint32_t R1L2Scape2Value       = 73;
inline constexpr uint32_t R1L2ContourScape      = 74;
inline constexpr uint32_t R1L2Scape1KeyTrack    = 75;
inline constexpr uint32_t R1L2Scape2KeyTrack    = 76;
inline constexpr uint32_t R1L2Scape1LfoDepth    = 77;
inline constexpr uint32_t R1L2Scape2LfoDepth    = 78;
inline constexpr uint32_t R1L2Scape1VelocityDepth= 79;
inline constexpr uint32_t R1L2Scape2VelocityDepth= 80;
inline constexpr uint32_t R1L2ScapeStickPlayback= 81;

// R1 Layer 3
inline constexpr uint32_t R1L3Sphere1Value      = 82;
inline constexpr uint32_t R1L3Sphere2Value      = 83;
inline constexpr uint32_t R1L3ContourSphere     = 84;
inline constexpr uint32_t R1L3Sphere1KeyTrack   = 85;
inline constexpr uint32_t R1L3Sphere2KeyTrack   = 86;
inline constexpr uint32_t R1L3Sphere1LfoDepth   = 87;
inline constexpr uint32_t R1L3Sphere2LfoDepth   = 88;
inline constexpr uint32_t R1L3Sphere1VelocityDepth= 89;
inline constexpr uint32_t R1L3Sphere2VelocityDepth= 90;
inline constexpr uint32_t R1L3SphereStickPlayback= 91;
inline constexpr uint32_t R1L3Scape1Value       = 92;
inline constexpr uint32_t R1L3Scape2Value       = 93;
inline constexpr uint32_t R1L3ContourScape      = 94;
inline constexpr uint32_t R1L3Scape1KeyTrack    = 95;
inline constexpr uint32_t R1L3Scape2KeyTrack    = 96;
inline constexpr uint32_t R1L3Scape1LfoDepth    = 97;
inline constexpr uint32_t R1L3Scape2LfoDepth    = 98;
inline constexpr uint32_t R1L3Scape1VelocityDepth= 99;
inline constexpr uint32_t R1L3Scape2VelocityDepth= 100;
inline constexpr uint32_t R1L3ScapeStickPlayback= 101;

// ============================================================================
// Resynator 2 (R2)
// ============================================================================
inline constexpr uint32_t R2ModellIndex        = 102;
inline constexpr uint32_t R2Switch             = 103;
inline constexpr uint32_t R2Type               = 104;
inline constexpr uint32_t R2ParamLevel         = 105;
inline constexpr uint32_t R2SelectStickPar     = 106;
inline constexpr uint32_t R2Volume             = 107;
inline constexpr uint32_t R2AmpLfoDepth        = 108;
inline constexpr uint32_t R2AmpKeyTrack        = 109;
inline constexpr uint32_t R2VolumeVelocityDepth= 110;
inline constexpr uint32_t R2ModelSizeKeyTrack  = 111;
inline constexpr uint32_t R2ModelSizeOffset    = 112;
inline constexpr uint32_t R2Octave             = 113;
inline constexpr uint32_t R2Semi               = 114;
inline constexpr uint32_t R2Cents              = 115;
inline constexpr uint32_t R2PitchLfoDepth      = 116;
inline constexpr uint32_t R2PitchKeyTrack      = 117;
inline constexpr uint32_t R2FreeADSR1PitchDepth= 118;
inline constexpr uint32_t R2FreeADSR2PitchDepth= 119;
inline constexpr uint32_t R2Free4L4TPitchDepth = 120;
inline constexpr uint32_t R2ModelVelocitySwitch= 121;

// R2 Layer 1
inline constexpr uint32_t R2L1Sphere1Value      = 122;
inline constexpr uint32_t R2L1Sphere2Value      = 123;
inline constexpr uint32_t R2L1ContourSphere     = 124;
inline constexpr uint32_t R2L1Sphere1KeyTrack   = 125;
inline constexpr uint32_t R2L1Sphere2KeyTrack   = 126;
inline constexpr uint32_t R2L1Sphere1LfoDepth   = 127;
inline constexpr uint32_t R2L1Sphere2LfoDepth   = 128;
inline constexpr uint32_t R2L1Sphere1VelocityDepth= 129;
inline constexpr uint32_t R2L1Sphere2VelocityDepth= 130;
inline constexpr uint32_t R2L1SphereStickPlayback= 131;
inline constexpr uint32_t R2L1Scape1Value       = 132;
inline constexpr uint32_t R2L1Scape2Value       = 133;
inline constexpr uint32_t R2L1ContourScape      = 134;
inline constexpr uint32_t R2L1Scape1KeyTrack    = 135;
inline constexpr uint32_t R2L1Scape2KeyTrack    = 136;
inline constexpr uint32_t R2L1Scape1LfoDepth    = 137;
inline constexpr uint32_t R2L1Scape2LfoDepth    = 138;
inline constexpr uint32_t R2L1Scape1VelocityDepth= 139;
inline constexpr uint32_t R2L1Scape2VelocityDepth= 140;
inline constexpr uint32_t R2L1ScapeStickPlayback= 141;

// R2 Layer 2
inline constexpr uint32_t R2L2Sphere1Value      = 142;
inline constexpr uint32_t R2L2Sphere2Value      = 143;
inline constexpr uint32_t R2L2ContourSphere     = 144;
inline constexpr uint32_t R2L2Sphere1KeyTrack   = 145;
inline constexpr uint32_t R2L2Sphere2KeyTrack   = 146;
inline constexpr uint32_t R2L2Sphere1LfoDepth   = 147;
inline constexpr uint32_t R2L2Sphere2LfoDepth   = 148;
inline constexpr uint32_t R2L2Sphere1VelocityDepth= 149;
inline constexpr uint32_t R2L2Sphere2VelocityDepth= 150;
inline constexpr uint32_t R2L2SphereStickPlayback= 151;
inline constexpr uint32_t R2L2Scape1Value       = 152;
inline constexpr uint32_t R2L2Scape2Value       = 153;
inline constexpr uint32_t R2L2ContourScape      = 154;
inline constexpr uint32_t R2L2Scape1KeyTrack    = 155;
inline constexpr uint32_t R2L2Scape2KeyTrack    = 156;
inline constexpr uint32_t R2L2Scape1LfoDepth    = 157;
inline constexpr uint32_t R2L2Scape2LfoDepth    = 158;
inline constexpr uint32_t R2L2Scape1VelocityDepth= 159;
inline constexpr uint32_t R2L2Scape2VelocityDepth= 160;
inline constexpr uint32_t R2L2ScapeStickPlayback= 161;

// R2 Layer 3
inline constexpr uint32_t R2L3Sphere1Value      = 162;
inline constexpr uint32_t R2L3Sphere2Value      = 163;
inline constexpr uint32_t R2L3ContourSphere     = 164;
inline constexpr uint32_t R2L3Sphere1KeyTrack   = 165;
inline constexpr uint32_t R2L3Sphere2KeyTrack   = 166;
inline constexpr uint32_t R2L3Sphere1LfoDepth   = 167;
inline constexpr uint32_t R2L3Sphere2LfoDepth   = 168;
inline constexpr uint32_t R2L3Sphere1VelocityDepth= 169;
inline constexpr uint32_t R2L3Sphere2VelocityDepth= 170;
inline constexpr uint32_t R2L3SphereStickPlayback= 171;
inline constexpr uint32_t R2L3Scape1Value       = 172;
inline constexpr uint32_t R2L3Scape2Value       = 173;
inline constexpr uint32_t R2L3ContourScape      = 174;
inline constexpr uint32_t R2L3Scape1KeyTrack    = 175;
inline constexpr uint32_t R2L3Scape2KeyTrack    = 176;
inline constexpr uint32_t R2L3Scape1LfoDepth    = 177;
inline constexpr uint32_t R2L3Scape2LfoDepth    = 178;
inline constexpr uint32_t R2L3Scape1VelocityDepth= 179;
inline constexpr uint32_t R2L3Scape2VelocityDepth= 180;
inline constexpr uint32_t R2L3ScapeStickPlayback= 181;

// ============================================================================
// Envelopes
// ============================================================================
inline constexpr uint32_t R1ResEnvA = 182;
inline constexpr uint32_t R1ResEnvD = 183;
inline constexpr uint32_t R1ResEnvS = 184;
inline constexpr uint32_t R1ResEnvR = 185;
inline constexpr uint32_t R1ResEnvMode = 186;

// R1: ParaEnv/Layer EnvDepth & VelocityDepth (187..199)
inline constexpr uint32_t R1ParaEnvVelocityDepth = 187;
inline constexpr uint32_t R1L1Scape1EnvDepth = 188;
inline constexpr uint32_t R1L1Scape2EnvDepth = 189;
inline constexpr uint32_t R1L1Sphere1EnvDepth = 190;
inline constexpr uint32_t R1L1Sphere2EnvDepth = 191;
inline constexpr uint32_t R1L2Scape1EnvDepth = 192;
inline constexpr uint32_t R1L2Scape2EnvDepth = 193;
inline constexpr uint32_t R1L2Sphere1EnvDepth = 194;
inline constexpr uint32_t R1L2Sphere2EnvDepth = 195;
inline constexpr uint32_t R1L3Scape1EnvDepth = 196;
inline constexpr uint32_t R1L3Scape2EnvDepth = 197;
inline constexpr uint32_t R1L3Sphere1EnvDepth = 198;
inline constexpr uint32_t R1L3Sphere2EnvDepth = 199;
inline constexpr uint32_t R1AmpEnvA = 200;
inline constexpr uint32_t R1AmpEnvD = 201;
inline constexpr uint32_t R1AmpEnvS = 202;
inline constexpr uint32_t R1AmpEnvR = 203;
inline constexpr uint32_t R1AmpEnvMode = 204;

// R1 Free Env & VelocityDepth (205..211)
inline constexpr uint32_t R1FreeEnvA = 205;
inline constexpr uint32_t R1FreeEnvD = 206;
inline constexpr uint32_t R1FreeEnvS = 207;
inline constexpr uint32_t R1FreeEnvR = 208;
inline constexpr uint32_t R1FreeEnvMode = 209;
inline constexpr uint32_t R1FreeEnvDepth = 210;
inline constexpr uint32_t FreeADSR1VelocityDepth = 211;
inline constexpr uint32_t R2ResEnvA = 212;
inline constexpr uint32_t R2ResEnvD = 213;
inline constexpr uint32_t R2ResEnvS = 214;
inline constexpr uint32_t R2ResEnvR = 215;
inline constexpr uint32_t R2ResEnvMode = 216;

// R2: ParaEnv/Layer EnvDepth & VelocityDepth (217..229)
inline constexpr uint32_t R2ParaEnvVelocityDepth = 217;
inline constexpr uint32_t R2L1Scape1EnvDepth = 218;
inline constexpr uint32_t R2L1Scape2EnvDepth = 219;
inline constexpr uint32_t R2L1Sphere1EnvDepth = 220;
inline constexpr uint32_t R2L1Sphere2EnvDepth = 221;
inline constexpr uint32_t R2L2Scape1EnvDepth = 222;
inline constexpr uint32_t R2L2Scape2EnvDepth = 223;
inline constexpr uint32_t R2L2Sphere1EnvDepth = 224;
inline constexpr uint32_t R2L2Sphere2EnvDepth = 225;
inline constexpr uint32_t R2L3Scape1EnvDepth = 226;
inline constexpr uint32_t R2L3Scape2EnvDepth = 227;
inline constexpr uint32_t R2L3Sphere1EnvDepth = 228;
inline constexpr uint32_t R2L3Sphere2EnvDepth = 229;
inline constexpr uint32_t R2AmpEnvA = 230;
inline constexpr uint32_t R2AmpEnvD = 231;
inline constexpr uint32_t R2AmpEnvS = 232;
inline constexpr uint32_t R2AmpEnvR = 233;
inline constexpr uint32_t R2AmpEnvMode = 234;

// R2 Free Env (235..241) + Free Env 4L4T / Shaper (242..255)
inline constexpr uint32_t R2FreeEnvA = 235;
inline constexpr uint32_t R2FreeEnvD = 236;
inline constexpr uint32_t R2FreeEnvS = 237;
inline constexpr uint32_t R2FreeEnvR = 238;
inline constexpr uint32_t R2FreeEnvMode = 239;
inline constexpr uint32_t R2FreeEnvDepth = 240;
inline constexpr uint32_t FreeADSR2VelocityDepth = 241;
inline constexpr uint32_t FreeEnvLevel1 = 242;
inline constexpr uint32_t FreeEnvLevel2 = 243;
inline constexpr uint32_t FreeEnvLevel3 = 244;
inline constexpr uint32_t FreeEnvLevel4 = 245;
inline constexpr uint32_t FreeEnvTime1 = 246;
inline constexpr uint32_t FreeEnvTime2 = 247;
inline constexpr uint32_t FreeEnvTime3 = 248;
inline constexpr uint32_t FreeEnvTime4 = 249;
inline constexpr uint32_t TLFreeEnvMode = 250;
inline constexpr uint32_t TLFreeEnvDepth = 251;
inline constexpr uint32_t Free4Level4TimeVelocityDepth = 252;
inline constexpr uint32_t Shaper12Status = 253;
inline constexpr uint32_t FreeEnvType = 254;
inline constexpr uint32_t ShaperResySelect = 255;
// ============================================================================
// Global LFO / Blender / Slicer
// ============================================================================
inline constexpr uint32_t LFOSwitch   = 256;
inline constexpr uint32_t LFODepth    = 257;
inline constexpr uint32_t LFORate     = 258;
inline constexpr uint32_t LFODelay    = 259;
inline constexpr uint32_t LFOWaveForm = 260;

inline constexpr uint32_t BlenderType   = 261;
inline constexpr uint32_t BlenderAmount = 262;
inline constexpr uint32_t BlenderLfoDepth = 263;

// Blender Free ADSR / 4L4T depths (264..266)
inline constexpr uint32_t BlenderFreeADSR1Depth = 264;
inline constexpr uint32_t BlenderFreeADSR2Depth = 265;
inline constexpr uint32_t BlenderFree4L4TDepth = 266;
inline constexpr uint32_t SlicerSwitchType = 267;
inline constexpr uint32_t SlicerDepth      = 268;
inline constexpr uint32_t SlicerRate       = 269;
inline constexpr uint32_t SlicerWaveForm   = 270;

// ============================================================================
// Silver Rack / Filter / FX
// ============================================================================
inline constexpr uint32_t SilverSwitch   = 271;
inline constexpr uint32_t SilverParamLevel = 272;
inline constexpr uint32_t FilterType      = 273;
inline constexpr uint32_t FilterFreq      = 274;
inline constexpr uint32_t FilterReso      = 275;
inline constexpr uint32_t FilterLfoDepth  = 276;
inline constexpr uint32_t FilterKeyTrack  = 277;
inline constexpr uint32_t FilterCutoffVelocityDepth = 278;

// Silver L1 Contour / StickPlayback (279..280)
inline constexpr uint32_t SilverL1Contour = 279;
inline constexpr uint32_t SilverL1StickPlayback = 280;
inline constexpr uint32_t FreqFXSwitch = 281;
inline constexpr uint32_t CurFreqFX    = 282;

// Silver L2 Contour / StickPlayback (283..284)
inline constexpr uint32_t SilverL2Contour = 283;
inline constexpr uint32_t SilverL2StickPlayback = 284;
// FreqFX: EQ 4-Band & Compressor (285..305)
inline constexpr uint32_t EQ_Switch          = 285;
inline constexpr uint32_t EQ_LowShelfSwitch  = 286;
inline constexpr uint32_t EQ_LowShelfGain    = 287;
inline constexpr uint32_t EQ_LowShelfFreq    = 288;
inline constexpr uint32_t EQ_LowShelfSlope   = 289;
inline constexpr uint32_t EQ_Band1Switch     = 290;
inline constexpr uint32_t EQ_Band1Gain       = 291;
inline constexpr uint32_t EQ_Band1Freq       = 292;
inline constexpr uint32_t EQ_Band1Q          = 293;
inline constexpr uint32_t EQ_Band2Switch     = 294;
inline constexpr uint32_t EQ_Band2Gain       = 295;
inline constexpr uint32_t EQ_Band2Freq       = 296;
inline constexpr uint32_t EQ_Band2Q          = 297;
inline constexpr uint32_t EQ_HighShelfSwitch = 298;
inline constexpr uint32_t EQ_HighShelfGain   = 299;
inline constexpr uint32_t EQ_HighShelfFreq   = 300;
inline constexpr uint32_t EQ_HighShelfSlope  = 301;
inline constexpr uint32_t CR_Switch          = 302;
inline constexpr uint32_t CR_Threshold       = 303;
inline constexpr uint32_t CR_OutGain         = 304;
inline constexpr uint32_t CR_Responsiveness  = 305;

// FreqFX: Distortion (306..309)
inline constexpr uint32_t DS_InGain          = 306;
inline constexpr uint32_t DS_PreFilter       = 307;
inline constexpr uint32_t DS_ClipCurveType   = 308;
inline constexpr uint32_t DS_OutGain         = 309;

// FreqFX: Ring Modulator (310..317)
inline constexpr uint32_t RM_Mix             = 310;
inline constexpr uint32_t RM_Speed           = 311;
inline constexpr uint32_t RM_Depth           = 312;
inline constexpr uint32_t RM_WaveForm        = 313;
inline constexpr uint32_t RM_ModFreq         = 314;
inline constexpr uint32_t RM_XoverDelay      = 315;
inline constexpr uint32_t RM_XoverTime       = 316;
inline constexpr uint32_t RM_XoverDelayFeedback = 317;

// FreqFX: Spectral Warp (318..323)
inline constexpr uint32_t SW_Mix             = 318;
inline constexpr uint32_t SW_Frequency       = 319;
inline constexpr uint32_t SW_Tilt            = 320;
inline constexpr uint32_t SW_Damping         = 321;
inline constexpr uint32_t SW_Speed           = 322;
inline constexpr uint32_t SW_Depth           = 323;

// FreqFX: Decimator (324..326)
inline constexpr uint32_t DC_Mix             = 324;
inline constexpr uint32_t DC_SHFactor        = 325;
inline constexpr uint32_t DC_PreFilterCutoff = 326;

inline constexpr uint32_t TimeFXSwitch = 327;
inline constexpr uint32_t CurTimeFX    = 328;

// Silver L3 Contour / StickPlayback (329..330)
inline constexpr uint32_t SilverL3Contour = 329;
inline constexpr uint32_t SilverL3StickPlayback = 330;
// TimeFX: Stereo Spread (331..332)
inline constexpr uint32_t SS_ChanDelay       = 331;
inline constexpr uint32_t SS_Feedback        = 332;

// TimeFX: L/R Delay (333..335)
inline constexpr uint32_t LRD_Mix            = 333;
inline constexpr uint32_t LRD_Time           = 334;
inline constexpr uint32_t LRD_Feedback       = 335;

// TimeFX: Flanger (336..341)
inline constexpr uint32_t FL_Mix             = 336;
inline constexpr uint32_t FL_Depth           = 337;
inline constexpr uint32_t FL_Speed           = 338;
inline constexpr uint32_t FL_WaveForm        = 339;
inline constexpr uint32_t FL_Feedback        = 340;
inline constexpr uint32_t FL_StereoPhase     = 341;

// TimeFX: Phaser (342..347)
inline constexpr uint32_t PH_Mix             = 342;
inline constexpr uint32_t PH_Depth           = 343;
inline constexpr uint32_t PH_Speed           = 344;
inline constexpr uint32_t PH_WaveForm        = 345;
inline constexpr uint32_t PH_Feedback        = 346;
inline constexpr uint32_t PH_StereoPhase     = 347;

// TimeFX: Chorus (348..354)
inline constexpr uint32_t CH_Mix             = 348;
inline constexpr uint32_t CH_Depth           = 349;
inline constexpr uint32_t CH_Speed           = 350;
inline constexpr uint32_t CH_WaveForm        = 351;
inline constexpr uint32_t CH_Feedback        = 352;
inline constexpr uint32_t CH_StereoPhase     = 353;
inline constexpr uint32_t CH_PreDelay        = 354;

// Filter Env
inline constexpr uint32_t FilterEnvA = 355;
inline constexpr uint32_t FilterEnvD = 356;
inline constexpr uint32_t FilterEnvS = 357;
inline constexpr uint32_t FilterEnvR = 358;
inline constexpr uint32_t FilterEnvMode = 359;
inline constexpr uint32_t FilterEnvDepth = 360;

// FilterEnv velocity + Shaper3 + asignaciones Aftertouch/Controller/FootSwitch (361..411)
inline constexpr uint32_t FilterEnvVelocityDepth = 361;
inline constexpr uint32_t Shaper3Status = 362;
inline constexpr uint32_t AftertouchDest1 = 363;
inline constexpr uint32_t AftertouchDest2 = 364;
inline constexpr uint32_t AftertouchDest3 = 365;
inline constexpr uint32_t AftertouchDest4 = 366;
inline constexpr uint32_t AftertouchDestDepth1 = 367;
inline constexpr uint32_t AftertouchDestDepth2 = 368;
inline constexpr uint32_t AftertouchDestDepth3 = 369;
inline constexpr uint32_t AftertouchDestDepth4 = 370;
inline constexpr uint32_t Controller1UpDest1 = 371;
inline constexpr uint32_t Controller1UpDest2 = 372;
inline constexpr uint32_t Controller1UpDest3 = 373;
inline constexpr uint32_t Controller1UpDest4 = 374;
inline constexpr uint32_t Controller1UpDestDepth1 = 375;
inline constexpr uint32_t Controller1UpDestDepth2 = 376;
inline constexpr uint32_t Controller1UpDestDepth3 = 377;
inline constexpr uint32_t Controller1UpDestDepth4 = 378;
inline constexpr uint32_t Controller1DnDest1 = 379;
inline constexpr uint32_t Controller1DnDest2 = 380;
inline constexpr uint32_t Controller1DnDest3 = 381;
inline constexpr uint32_t Controller1DnDest4 = 382;
inline constexpr uint32_t Controller1DnDestDepth1 = 383;
inline constexpr uint32_t Controller1DnDestDepth2 = 384;
inline constexpr uint32_t Controller1DnDestDepth3 = 385;
inline constexpr uint32_t Controller1DnDestDepth4 = 386;
inline constexpr uint32_t Controller2Dest1 = 387;
inline constexpr uint32_t Controller2Dest2 = 388;
inline constexpr uint32_t Controller2Dest3 = 389;
inline constexpr uint32_t Controller2Dest4 = 390;
inline constexpr uint32_t Controller2DestDepth1 = 391;
inline constexpr uint32_t Controller2DestDepth2 = 392;
inline constexpr uint32_t Controller2DestDepth3 = 393;
inline constexpr uint32_t Controller2DestDepth4 = 394;
inline constexpr uint32_t Controller3Dest1 = 395;
inline constexpr uint32_t Controller3Dest2 = 396;
inline constexpr uint32_t Controller3Dest3 = 397;
inline constexpr uint32_t Controller3Dest4 = 398;
inline constexpr uint32_t Controller3DestDepth1 = 399;
inline constexpr uint32_t Controller3DestDepth2 = 400;
inline constexpr uint32_t Controller3DestDepth3 = 401;
inline constexpr uint32_t Controller3DestDepth4 = 402;
inline constexpr uint32_t Controller4Dest1 = 403;
inline constexpr uint32_t Controller4Dest2 = 404;
inline constexpr uint32_t Controller4Dest3 = 405;
inline constexpr uint32_t Controller4Dest4 = 406;
inline constexpr uint32_t Controller4DestDepth1 = 407;
inline constexpr uint32_t Controller4DestDepth2 = 408;
inline constexpr uint32_t Controller4DestDepth3 = 409;
inline constexpr uint32_t Controller4DestDepth4 = 410;
inline constexpr uint32_t FootSwitchDest = 411;
// Modulation basics
inline constexpr uint32_t PitchBendRange = 412;

// Dest/Depth de modulación MIDI, Knobs y SlicerSwitchBackup (413..429)
inline constexpr uint32_t AftertouchDest = 413;
inline constexpr uint32_t AftertouchDepth = 414;
inline constexpr uint32_t ModulationDest = 415;
inline constexpr uint32_t ModulationDepth = 416;
inline constexpr uint32_t BreathDest = 417;
inline constexpr uint32_t BreathDepth = 418;
inline constexpr uint32_t CC03Dest = 419;
inline constexpr uint32_t CC03Depth = 420;
inline constexpr uint32_t FootDest = 421;
inline constexpr uint32_t FootDepth = 422;
inline constexpr uint32_t ExpressionDest = 423;
inline constexpr uint32_t ExpressionDepth = 424;
inline constexpr uint32_t Knob1R1Select = 425;
inline constexpr uint32_t Knob2R1Select = 426;
inline constexpr uint32_t Knob3R1Select = 427;
inline constexpr uint32_t Knob4R1Select = 428;
inline constexpr uint32_t SlicerSwitchBackup = 429;
// ============================================================================
// Master FX
// ============================================================================
inline constexpr uint32_t SoundMFXSwitch       = 430;
inline constexpr uint32_t SoundMFXDelaySwitch  = 431;
inline constexpr uint32_t SoundMFXDelayMix     = 432;
inline constexpr uint32_t SoundMFXDelayLTime   = 433;
inline constexpr uint32_t SoundMFXDelayRTime   = 434;
inline constexpr uint32_t SoundMFXDelayFeedback= 435;
inline constexpr uint32_t SoundMFXDelayFdbkDamp= 436;
inline constexpr uint32_t SoundMFXReverbSwitch = 437;
inline constexpr uint32_t SoundMFXReverbMix    = 438;
inline constexpr uint32_t SoundMFXReverbRoom   = 439;
inline constexpr uint32_t SoundMFXRevDecayTime = 440;
inline constexpr uint32_t SoundMFXRevDiffusion = 441;
inline constexpr uint32_t SoundMFXRevHFDamp    = 442;
inline constexpr uint32_t SoundMFXRevDetune    = 443;
inline constexpr uint32_t SoundMFXRevSpeed     = 444;

} // namespace ParamIdx

// ============================================================================
// SlotIdx — índice canónico de cada parámetro dentro del bloque p[] de
// ejecución (340 slots + extensión MFX). Fuente canónica:
// DOCS/reverse_engineering/dsp/params_observers_map.csv (columna slot_in_p).
// Verificado por Scripts/registry_generator.js --check.
// El nombre de cada constante es la clave snddat del parámetro que llena el slot.
// ============================================================================
namespace SlotIdx {

inline constexpr size_t SoundPan                     = 0;
inline constexpr size_t SoundPanKeyTrack             = 1;
inline constexpr size_t PitchBendRange               = 2;
inline constexpr size_t R1Switch                     = 3;
inline constexpr size_t R1Volume                     = 4;
inline constexpr size_t R1AmpLfoDepth                = 5;
inline constexpr size_t R1AmpKeyTrack                = 6;
inline constexpr size_t R1VolumeVelocityDepth        = 7;
inline constexpr size_t R1ModelSizeKeyTrack          = 8;
inline constexpr size_t R1ModelSizeOffset            = 9;
inline constexpr size_t R1Octave                     = 10;
inline constexpr size_t R1Semi                       = 11;
inline constexpr size_t R1Cents                      = 12;
inline constexpr size_t R1PitchLfoDepth              = 13;
inline constexpr size_t R1PitchKeyTrack              = 14;
inline constexpr size_t R1FreeADSR1PitchDepth        = 15;
inline constexpr size_t R1FreeADSR2PitchDepth        = 16;
inline constexpr size_t R1Free4L4TPitchDepth         = 17;
inline constexpr size_t R1ModelVelocitySwitch        = 18;
inline constexpr size_t R1L1Sphere1Value             = 19;
inline constexpr size_t R1L1Sphere2Value             = 20;
inline constexpr size_t R1L1Sphere1KeyTrack          = 21;
inline constexpr size_t R1L1Sphere2KeyTrack          = 22;
inline constexpr size_t R1L1Sphere1LfoDepth          = 23;
inline constexpr size_t R1L1Sphere2LfoDepth          = 24;
inline constexpr size_t R1L1Sphere1VelocityDepth     = 25;
inline constexpr size_t R1L1Sphere2VelocityDepth     = 26;
inline constexpr size_t R1L1ContourSphere            = 27;
inline constexpr size_t R1L1Scape1Value              = 28;
inline constexpr size_t R1L1Scape2Value              = 29;
inline constexpr size_t R1L1Scape1KeyTrack           = 30;
inline constexpr size_t R1L1Scape2KeyTrack           = 31;
inline constexpr size_t R1L1Scape1LfoDepth           = 32;
inline constexpr size_t R1L1Scape2LfoDepth           = 33;
inline constexpr size_t R1L1Scape1VelocityDepth      = 34;
inline constexpr size_t R1L1Scape2VelocityDepth      = 35;
inline constexpr size_t R1L1ContourScape             = 36;
inline constexpr size_t R1L2Sphere1Value             = 37;
inline constexpr size_t R1L2Sphere2Value             = 38;
inline constexpr size_t R1L2Sphere1KeyTrack          = 39;
inline constexpr size_t R1L2Sphere2KeyTrack          = 40;
inline constexpr size_t R1L2Sphere1LfoDepth          = 41;
inline constexpr size_t R1L2Sphere2LfoDepth          = 42;
inline constexpr size_t R1L2Sphere1VelocityDepth     = 43;
inline constexpr size_t R1L2Sphere2VelocityDepth     = 44;
inline constexpr size_t R1L2ContourSphere            = 45;
inline constexpr size_t R1L2Scape1Value              = 46;
inline constexpr size_t R1L2Scape2Value              = 47;
inline constexpr size_t R1L2Scape1KeyTrack           = 48;
inline constexpr size_t R1L2Scape2KeyTrack           = 49;
inline constexpr size_t R1L2Scape1LfoDepth           = 50;
inline constexpr size_t R1L2Scape2LfoDepth           = 51;
inline constexpr size_t R1L2Scape1VelocityDepth      = 52;
inline constexpr size_t R1L2Scape2VelocityDepth      = 53;
inline constexpr size_t R1L2ContourScape             = 54;
inline constexpr size_t R1L3Sphere1Value             = 55;
inline constexpr size_t R1L3Sphere2Value             = 56;
inline constexpr size_t R1L3Sphere1KeyTrack          = 57;
inline constexpr size_t R1L3Sphere2KeyTrack          = 58;
inline constexpr size_t R1L3Sphere1LfoDepth          = 59;
inline constexpr size_t R1L3Sphere2LfoDepth          = 60;
inline constexpr size_t R1L3Sphere1VelocityDepth     = 61;
inline constexpr size_t R1L3Sphere2VelocityDepth     = 62;
inline constexpr size_t R1L3ContourSphere            = 63;
inline constexpr size_t R1L3Scape1Value              = 64;
inline constexpr size_t R1L3Scape2Value              = 65;
inline constexpr size_t R1L3Scape1KeyTrack           = 66;
inline constexpr size_t R1L3Scape2KeyTrack           = 67;
inline constexpr size_t R1L3Scape1LfoDepth           = 68;
inline constexpr size_t R1L3Scape2LfoDepth           = 69;
inline constexpr size_t R1L3Scape1VelocityDepth      = 70;
inline constexpr size_t R1L3Scape2VelocityDepth      = 71;
inline constexpr size_t R1L3ContourScape             = 72;
inline constexpr size_t R2Switch                     = 73;
inline constexpr size_t R2Volume                     = 74;
inline constexpr size_t R2AmpLfoDepth                = 75;
inline constexpr size_t R2AmpKeyTrack                = 76;
inline constexpr size_t R2VolumeVelocityDepth        = 77;
inline constexpr size_t R2ModelSizeKeyTrack          = 78;
inline constexpr size_t R2ModelSizeOffset            = 79;
inline constexpr size_t R2Octave                     = 80;
inline constexpr size_t R2Semi                       = 81;
inline constexpr size_t R2Cents                      = 82;
inline constexpr size_t R2PitchLfoDepth              = 83;
inline constexpr size_t R2PitchKeyTrack              = 84;
inline constexpr size_t R2FreeADSR1PitchDepth        = 85;
inline constexpr size_t R2FreeADSR2PitchDepth        = 86;
inline constexpr size_t R2Free4L4TPitchDepth         = 87;
inline constexpr size_t R2ModelVelocitySwitch        = 88;
inline constexpr size_t R2L1Sphere1Value             = 89;
inline constexpr size_t R2L1Sphere2Value             = 90;
inline constexpr size_t R2L1Sphere1KeyTrack          = 91;
inline constexpr size_t R2L1Sphere2KeyTrack          = 92;
inline constexpr size_t R2L1Sphere1LfoDepth          = 93;
inline constexpr size_t R2L1Sphere2LfoDepth          = 94;
inline constexpr size_t R2L1Sphere1VelocityDepth     = 95;
inline constexpr size_t R2L1Sphere2VelocityDepth     = 96;
inline constexpr size_t R2L1ContourSphere            = 97;
inline constexpr size_t R2L1Scape1Value              = 98;
inline constexpr size_t R2L1Scape2Value              = 99;
inline constexpr size_t R2L1Scape1KeyTrack           = 100;
inline constexpr size_t R2L1Scape2KeyTrack           = 101;
inline constexpr size_t R2L1Scape1LfoDepth           = 102;
inline constexpr size_t R2L1Scape2LfoDepth           = 103;
inline constexpr size_t R2L1Scape1VelocityDepth      = 104;
inline constexpr size_t R2L1Scape2VelocityDepth      = 105;
inline constexpr size_t R2L1ContourScape             = 106;
inline constexpr size_t R2L2Sphere1Value             = 107;
inline constexpr size_t R2L2Sphere2Value             = 108;
inline constexpr size_t R2L2Sphere1KeyTrack          = 109;
inline constexpr size_t R2L2Sphere2KeyTrack          = 110;
inline constexpr size_t R2L2Sphere1LfoDepth          = 111;
inline constexpr size_t R2L2Sphere2LfoDepth          = 112;
inline constexpr size_t R2L2Sphere1VelocityDepth     = 113;
inline constexpr size_t R2L2Sphere2VelocityDepth     = 114;
inline constexpr size_t R2L2ContourSphere            = 115;
inline constexpr size_t R2L2Scape1Value              = 116;
inline constexpr size_t R2L2Scape2Value              = 117;
inline constexpr size_t R2L2Scape1KeyTrack           = 118;
inline constexpr size_t R2L2Scape2KeyTrack           = 119;
inline constexpr size_t R2L2Scape1LfoDepth           = 120;
inline constexpr size_t R2L2Scape2LfoDepth           = 121;
inline constexpr size_t R2L2Scape1VelocityDepth      = 122;
inline constexpr size_t R2L2Scape2VelocityDepth      = 123;
inline constexpr size_t R2L2ContourScape             = 124;
inline constexpr size_t R2L3Sphere1Value             = 125;
inline constexpr size_t R2L3Sphere2Value             = 126;
inline constexpr size_t R2L3Sphere1KeyTrack          = 127;
inline constexpr size_t R2L3Sphere2KeyTrack          = 128;
inline constexpr size_t R2L3Sphere1LfoDepth          = 129;
inline constexpr size_t R2L3Sphere2LfoDepth          = 130;
inline constexpr size_t R2L3Sphere1VelocityDepth     = 131;
inline constexpr size_t R2L3Sphere2VelocityDepth     = 132;
inline constexpr size_t R2L3ContourSphere            = 133;
inline constexpr size_t R2L3Scape1Value              = 134;
inline constexpr size_t R2L3Scape2Value              = 135;
inline constexpr size_t R2L3Scape1KeyTrack           = 136;
inline constexpr size_t R2L3Scape2KeyTrack           = 137;
inline constexpr size_t R2L3Scape1LfoDepth           = 138;
inline constexpr size_t R2L3Scape2LfoDepth           = 139;
inline constexpr size_t R2L3Scape1VelocityDepth      = 140;
inline constexpr size_t R2L3Scape2VelocityDepth      = 141;
inline constexpr size_t R2L3ContourScape             = 142;
inline constexpr size_t R1ResEnvA                    = 143;
inline constexpr size_t R1ResEnvD                    = 144;
inline constexpr size_t R1ResEnvS                    = 145;
inline constexpr size_t R1ResEnvR                    = 146;
inline constexpr size_t R1ResEnvMode                 = 147;
inline constexpr size_t R1ParaEnvVelocityDepth       = 148;
inline constexpr size_t R1L1Scape1EnvDepth           = 149;
inline constexpr size_t R1L1Scape2EnvDepth           = 150;
inline constexpr size_t R1L1Sphere1EnvDepth          = 151;
inline constexpr size_t R1L1Sphere2EnvDepth          = 152;
inline constexpr size_t R1L2Scape1EnvDepth           = 153;
inline constexpr size_t R1L2Scape2EnvDepth           = 154;
inline constexpr size_t R1L2Sphere1EnvDepth          = 155;
inline constexpr size_t R1L2Sphere2EnvDepth          = 156;
inline constexpr size_t R1L3Scape1EnvDepth           = 157;
inline constexpr size_t R1L3Scape2EnvDepth           = 158;
inline constexpr size_t R1L3Sphere1EnvDepth          = 159;
inline constexpr size_t R1L3Sphere2EnvDepth          = 160;
inline constexpr size_t R1AmpEnvA                    = 161;
inline constexpr size_t R1AmpEnvD                    = 162;
inline constexpr size_t R1AmpEnvS                    = 163;
inline constexpr size_t R1AmpEnvR                    = 164;
inline constexpr size_t R1AmpEnvMode                 = 165;
inline constexpr size_t R1FreeEnvA                   = 166;
inline constexpr size_t R1FreeEnvD                   = 167;
inline constexpr size_t R1FreeEnvS                   = 168;
inline constexpr size_t R1FreeEnvR                   = 169;
inline constexpr size_t R1FreeEnvMode                = 170;
inline constexpr size_t R1FreeEnvDepth               = 171;
inline constexpr size_t FreeADSR1VelocityDepth       = 172;
inline constexpr size_t R2ResEnvA                    = 173;
inline constexpr size_t R2ResEnvD                    = 174;
inline constexpr size_t R2ResEnvS                    = 175;
inline constexpr size_t R2ResEnvR                    = 176;
inline constexpr size_t R2ResEnvMode                 = 177;
inline constexpr size_t R2ParaEnvVelocityDepth       = 178;
inline constexpr size_t R2L1Scape1EnvDepth           = 179;
inline constexpr size_t R2L1Scape2EnvDepth           = 180;
inline constexpr size_t R2L1Sphere1EnvDepth          = 181;
inline constexpr size_t R2L1Sphere2EnvDepth          = 182;
inline constexpr size_t R2L2Scape1EnvDepth           = 183;
inline constexpr size_t R2L2Scape2EnvDepth           = 184;
inline constexpr size_t R2L2Sphere1EnvDepth          = 185;
inline constexpr size_t R2L2Sphere2EnvDepth          = 186;
inline constexpr size_t R2L3Scape1EnvDepth           = 187;
inline constexpr size_t R2L3Scape2EnvDepth           = 188;
inline constexpr size_t R2L3Sphere1EnvDepth          = 189;
inline constexpr size_t R2L3Sphere2EnvDepth          = 190;
inline constexpr size_t R2AmpEnvA                    = 191;
inline constexpr size_t R2AmpEnvD                    = 192;
inline constexpr size_t R2AmpEnvS                    = 193;
inline constexpr size_t R2AmpEnvR                    = 194;
inline constexpr size_t R2AmpEnvMode                 = 195;
inline constexpr size_t R2FreeEnvA                   = 196;
inline constexpr size_t R2FreeEnvD                   = 197;
inline constexpr size_t R2FreeEnvS                   = 198;
inline constexpr size_t R2FreeEnvR                   = 199;
inline constexpr size_t R2FreeEnvMode                = 200;
inline constexpr size_t R2FreeEnvDepth               = 201;
inline constexpr size_t FreeADSR2VelocityDepth       = 202;
inline constexpr size_t FreeEnvLevel1                = 203;
inline constexpr size_t FreeEnvLevel2                = 204;
inline constexpr size_t FreeEnvLevel3                = 205;
inline constexpr size_t FreeEnvLevel4                = 206;
inline constexpr size_t FreeEnvTime1                 = 207;
inline constexpr size_t FreeEnvTime2                 = 208;
inline constexpr size_t FreeEnvTime3                 = 209;
inline constexpr size_t FreeEnvTime4                 = 210;
inline constexpr size_t TLFreeEnvMode                = 211;
inline constexpr size_t TLFreeEnvDepth               = 212;
inline constexpr size_t Free4Level4TimeVelocityDepth = 213;
inline constexpr size_t FreeEnvType                  = 214;
inline constexpr size_t LFOSwitch                    = 215;
inline constexpr size_t LFODepth                     = 216;
inline constexpr size_t LFORate                      = 217;
inline constexpr size_t LFODelay                     = 218;
inline constexpr size_t LFOWaveForm                  = 219;
inline constexpr size_t BlenderType                  = 220;
inline constexpr size_t BlenderAmount                = 221;
inline constexpr size_t BlenderLfoDepth              = 222;
inline constexpr size_t BlenderFreeADSR1Depth        = 223;
inline constexpr size_t BlenderFreeADSR2Depth        = 224;
inline constexpr size_t BlenderFree4L4TDepth         = 225;
inline constexpr size_t SlicerSwitchType             = 226;
inline constexpr size_t SlicerDepth                  = 227;
inline constexpr size_t SlicerRate                   = 228;
inline constexpr size_t SlicerWaveForm               = 229;
inline constexpr size_t FilterType                   = 230;
inline constexpr size_t FilterFreq                   = 231;
inline constexpr size_t FilterReso                   = 232;
inline constexpr size_t FilterLfoDepth               = 233;
inline constexpr size_t FilterKeyTrack               = 234;
inline constexpr size_t FilterCutoffVelocityDepth    = 235;
inline constexpr size_t SilverL1Contour              = 236;
inline constexpr size_t FilterEnvA                   = 237;
inline constexpr size_t FilterEnvD                   = 238;
inline constexpr size_t FilterEnvS                   = 239;
inline constexpr size_t FilterEnvR                   = 240;
inline constexpr size_t FilterEnvMode                = 241;
inline constexpr size_t FilterEnvDepth               = 242;
inline constexpr size_t FilterEnvVelocityDepth       = 243;
inline constexpr size_t SilverSwitch                 = 244;
inline constexpr size_t FreqFXSwitch                 = 245;
inline constexpr size_t CurFreqFX                    = 246;
inline constexpr size_t SilverL2Contour              = 247;
inline constexpr size_t EQ_Switch                    = 248;
inline constexpr size_t EQ_LowShelfSwitch            = 249;
inline constexpr size_t EQ_LowShelfGain              = 250;
inline constexpr size_t EQ_LowShelfFreq              = 251;
inline constexpr size_t EQ_LowShelfSlope             = 252;
inline constexpr size_t EQ_Band1Switch               = 253;
inline constexpr size_t EQ_Band1Gain                 = 254;
inline constexpr size_t EQ_Band1Freq                 = 255;
inline constexpr size_t EQ_Band1Q                    = 256;
inline constexpr size_t EQ_Band2Switch               = 257;
inline constexpr size_t EQ_Band2Gain                 = 258;
inline constexpr size_t EQ_Band2Freq                 = 259;
inline constexpr size_t EQ_Band2Q                    = 260;
inline constexpr size_t EQ_HighShelfSwitch           = 261;
inline constexpr size_t EQ_HighShelfGain             = 262;
inline constexpr size_t EQ_HighShelfFreq             = 263;
inline constexpr size_t EQ_HighShelfSlope            = 264;
inline constexpr size_t CR_Switch                    = 265;
inline constexpr size_t CR_Threshold                 = 266;
inline constexpr size_t CR_OutGain                   = 267;
inline constexpr size_t CR_Responsiveness            = 268;
inline constexpr size_t DS_InGain                    = 269;
inline constexpr size_t DS_PreFilter                 = 270;
inline constexpr size_t DS_ClipCurveType             = 271;
inline constexpr size_t DS_OutGain                   = 272;
inline constexpr size_t RM_Mix                       = 273;
inline constexpr size_t RM_Speed                     = 274;
inline constexpr size_t RM_Depth                     = 275;
inline constexpr size_t RM_WaveForm                  = 276;
inline constexpr size_t RM_ModFreq                   = 277;
inline constexpr size_t RM_XoverDelay                = 278;
inline constexpr size_t RM_XoverTime                 = 279;
inline constexpr size_t RM_XoverDelayFeedback        = 280;
inline constexpr size_t SW_Mix                       = 281;
inline constexpr size_t SW_Frequency                 = 282;
inline constexpr size_t SW_Tilt                      = 283;
inline constexpr size_t SW_Damping                   = 284;
inline constexpr size_t SW_Speed                     = 285;
inline constexpr size_t SW_Depth                     = 286;
inline constexpr size_t DC_Mix                       = 287;
inline constexpr size_t DC_SHFactor                  = 288;
inline constexpr size_t DC_PreFilterCutoff           = 289;
inline constexpr size_t TimeFXSwitch                 = 290;
inline constexpr size_t CurTimeFX                    = 291;
inline constexpr size_t SilverL3Contour              = 292;
inline constexpr size_t SS_ChanDelay                 = 293;
inline constexpr size_t SS_Feedback                  = 294;
inline constexpr size_t LRD_Mix                      = 295;
inline constexpr size_t LRD_Time                     = 296;
inline constexpr size_t LRD_Feedback                 = 297;
inline constexpr size_t FL_Mix                       = 298;
inline constexpr size_t FL_Depth                     = 299;
inline constexpr size_t FL_Speed                     = 300;
inline constexpr size_t FL_WaveForm                  = 301;
inline constexpr size_t FL_Feedback                  = 302;
inline constexpr size_t FL_StereoPhase               = 303;
inline constexpr size_t PH_Mix                       = 304;
inline constexpr size_t PH_Depth                     = 305;
inline constexpr size_t PH_Speed                     = 306;
inline constexpr size_t PH_WaveForm                  = 307;
inline constexpr size_t PH_Feedback                  = 308;
inline constexpr size_t PH_StereoPhase               = 309;
inline constexpr size_t CH_Mix                       = 310;
inline constexpr size_t CH_Depth                     = 311;
inline constexpr size_t CH_Speed                     = 312;
inline constexpr size_t CH_WaveForm                  = 313;
inline constexpr size_t CH_Feedback                  = 314;
inline constexpr size_t CH_StereoPhase               = 315;
inline constexpr size_t CH_PreDelay                  = 316;

} // namespace SlotIdx
} // namespace abd::axionik
