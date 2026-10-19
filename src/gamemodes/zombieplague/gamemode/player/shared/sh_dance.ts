export function GetDanceState(this: void, ply: ZPPlayer): ZPDanceAnimationState | undefined {
    if (!IsValid(ply) || !ply.Alive()) return undefined;
    const until = ply.GetNWFloat("ZPDanceUntil", 0), sequence = ply.GetNWInt("ZPDanceSequence", -1);
    const yaw = ply.GetNWFloat("ZPDanceYaw", Number.NaN), pitch = ply.GetNWFloat("ZPDancePitch", Number.NaN);
    const started = ply.GetNWFloat("ZPDanceStarted", Number.NaN);
    if (until <= CurTime() || sequence < 0 || !Number.isFinite(yaw) || !Number.isFinite(pitch) ||
        !Number.isFinite(started) || ply.GetNWString("ZPDanceModel", "") !== ply.GetModel()) return undefined;
    const duration = ply.SequenceDuration(sequence);
    if (!(duration > 0) || !Number.isFinite(duration)) return undefined;
    return { Until: until, Started: started, Duration: duration, Sequence: sequence, Yaw: yaw, Pitch: pitch };
}
export function StopDanceAnimation(this: void, ply: ZPPlayer): void {
    if (ply.ZPDanceAnimationUntil === undefined) return;
    delete ply.ZPDanceAnimationUntil;
    ply.AnimResetGestureSlot(GESTURE_SLOT_CUSTOM);
}
// Native emotes are spline/weighted gestures, not main sequences. Their transparent
// frames must blend over the model's normal idle (especially the zombie skeletons).
hook.Add("CalcMainActivity", "ZPDanceAnimation", ply => {
    const state = GetDanceState(ply);
    if (state) {
        if (ply.ZPDanceAnimationUntil !== state.Until) {
            const cycle = Math.max(0, Math.min(0.999, (CurTime() - state.Started) / state.Duration));
            ply.AnimResetGestureSlot(GESTURE_SLOT_CUSTOM);
            ply.AddVCDSequenceToGestureSlot(GESTURE_SLOT_CUSTOM, state.Sequence, cycle, true);
            ply.AnimSetGestureWeight(GESTURE_SLOT_CUSTOM, 1);
            ply.ZPDanceAnimationUntil = state.Until;
        }
    } else StopDanceAnimation(ply);
    // Always leave the base activity and main sequence to the gamemode/weapon.
    return undefined;
});
hook.Add("UpdateAnimation", "ZPDancePlayback", ply => {
    if (!GetDanceState(ply)) return;
    ply.SetPlaybackRate(1);
    // Keep aim/movement blending from bending or turning a full-body emote.
    for (const parameter of ["aim_pitch", "aim_yaw", "head_pitch", "head_yaw", "body_yaw", "move_x", "move_y"])
        ply.SetPoseParameter(parameter, 0);
    // Bone-cache invalidation belongs to the client's PrePlayerDraw hook.
    return true;
});
