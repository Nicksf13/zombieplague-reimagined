declare const ACT_GMOD_TAUNT_DANCE: number;
declare const GESTURE_SLOT_CUSTOM: number;
declare const ACT_GMOD_TAUNT_ROBOT: number, ACT_GMOD_TAUNT_MUSCLE: number, ACT_GMOD_TAUNT_CHEER: number;
declare const ACT_GMOD_TAUNT_LAUGH: number, ACT_GMOD_TAUNT_SALUTE: number, ACT_GMOD_TAUNT_PERSISTENCE: number;
declare const ACT_GMOD_GESTURE_WAVE: number, ACT_GMOD_GESTURE_TAUNT_ZOMBIE: number;
declare const ACT_GMOD_GESTURE_AGREE: number, ACT_GMOD_GESTURE_DISAGREE: number;
declare const ACT_GMOD_GESTURE_BECON: number, ACT_GMOD_GESTURE_BOW: number;
declare const ACT_SIGNAL_FORWARD: number, ACT_SIGNAL_GROUP: number, ACT_SIGNAL_HALT: number;
interface ZPEmoteDefinition { readonly ID: number; readonly Name: string; readonly Activity: number; }
interface ZPDanceAnimationState {
    readonly Until: number; readonly Started: number; readonly Duration: number;
    readonly Sequence: number; readonly Yaw: number; readonly Pitch: number;
}
interface ZPPlayer {
    ZPDanceAnimationUntil?: number;
    AddVCDSequenceToGestureSlot(this: ZPPlayer, slot: number, sequence: number, cycle: number, autoKill: boolean): void;
    AnimResetGestureSlot(this: ZPPlayer, slot: number): void;
    AnimSetGestureWeight(this: ZPPlayer, slot: number, weight: number): void;
    GetModel(this: ZPPlayer): string;
    SelectWeightedSequence(this: ZPPlayer, activity: number): number;
    SequenceDuration(this: ZPPlayer, sequence: number): number;
    SetPlaybackRate(this: ZPPlayer, rate: number): void;
    SetPoseParameter(this: ZPPlayer, name: string, value: number): number;
    GetNWFloat(this: ZPPlayer, key: string, fallback?: number): number;
    GetNWInt(this: ZPPlayer, key: string, fallback?: number): number;
    GetNWString(this: ZPPlayer, key: string, fallback?: string): string;
}
interface GLuaAngle { p: number; y: number; r: number; }
/** @noSelf */
declare namespace hook {
    function Add(name: "CalcMainActivity", id: string,
        callback: (this: void, ply: ZPPlayer, velocity: GLuaVector) => LuaMultiReturn<[number, number]> | undefined): void;
    function Add(name: "UpdateAnimation", id: string,
        callback: (this: void, ply: ZPPlayer, velocity: GLuaVector, maxSequenceGroundSpeed: number) => boolean | undefined): void;
}
