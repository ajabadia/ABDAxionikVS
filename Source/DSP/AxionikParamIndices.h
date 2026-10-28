// ============================================================================
// ABDAxionikVS — AxionikParamIndices.h
// Índices centralizados de parámetros (Single Source of Truth local)
// Al estilo ABDJUNiO601. Los valores coinciden con ParameterRegistry.gen.h
// Los que aún queden hardcodeados se irán migrando progresivamente a este archivo.
// ============================================================================

#pragma once

#include <cstdint>

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

inline constexpr uint32_t R1AmpEnvA = 200;
inline constexpr uint32_t R1AmpEnvD = 201;
inline constexpr uint32_t R1AmpEnvS = 202;
inline constexpr uint32_t R1AmpEnvR = 203;
inline constexpr uint32_t R1AmpEnvMode = 204;

inline constexpr uint32_t R2ResEnvA = 212;
inline constexpr uint32_t R2ResEnvD = 213;
inline constexpr uint32_t R2ResEnvS = 214;
inline constexpr uint32_t R2ResEnvR = 215;
inline constexpr uint32_t R2ResEnvMode = 216;

inline constexpr uint32_t R2AmpEnvA = 230;
inline constexpr uint32_t R2AmpEnvD = 231;
inline constexpr uint32_t R2AmpEnvS = 232;
inline constexpr uint32_t R2AmpEnvR = 233;
inline constexpr uint32_t R2AmpEnvMode = 234;

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

inline constexpr uint32_t FreqFXSwitch = 281;
inline constexpr uint32_t CurFreqFX    = 282;

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

// Modulation basics
inline constexpr uint32_t PitchBendRange = 412;

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
} // namespace abd::axionik
