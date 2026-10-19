const { StopDanceAnimation } = include("sh_dance.lua") as typeof import("../shared/sh_dance");
const { Emotes } = include("sh_emotes.lua") as typeof import("../shared/sh_emotes");
interface DanceState { ID: number; Player: ZPServerPlayer; Model: string; Team: number; Until: number; Angles: GLuaAngle; }
export class DanceManager implements ZPDanceManager {
    private dancers: Record<number, DanceState | undefined> = {};
    private nextRequest: Record<number, number | undefined> = {};
    private cancelClicks: Record<number, boolean | undefined> = {};
    private Allowed(ply: ZPServerPlayer): boolean {
        const state = RoundManager.GetRoundState();
        return IsValid(ply) && ply.Alive() && (ply.Team() === TEAM_HUMANS || ply.Team() === TEAM_ZOMBIES) &&
            !ply.IsFrozen() && !(RoundManager as ZPServerRoundManager).FreezeTimeActive && ply.OnGround() && !ply.InVehicle() &&
            (state === ROUND_WAITING_PLAYERS || state === ROUND_STARTING_NEW_ROUND || state === ROUND_PLAYING);
    }
    Request(ply: ZPServerPlayer, emoteID = 1): void {
        if (!IsValid(ply)) return;
        const id = ply.EntIndex();
        if (CurTime() < (this.nextRequest[id] ?? 0)) return;
        this.nextRequest[id] = CurTime() + 0.75;
        if (this.dancers[id] || !this.Allowed(ply)) return;
        const emote = Emotes.find(entry => entry.ID === emoteID);
        if (!emote) return;
        const sequence = ply.SelectWeightedSequence(emote.Activity);
        const duration = sequence >= 0 ? ply.SequenceDuration(sequence) : 0;
        if (!(duration > 0) || !Number.isFinite(duration)) {
            SendPopupMessage(ply, { Phrase: "zombieplague.danceunavailable" });
            return;
        }
        const started = CurTime(), until = started + Math.min(duration, 30);
        const angles = ply.EyeAngles();
        this.dancers[id] = { ID: id, Player: ply, Model: ply.GetModel(), Team: ply.Team(), Until: until,
            Angles: Angle(angles.p, angles.y, angles.r) };
        ply.ZPDanceUntil = until;
        ply.SetNWString("ZPDanceModel", ply.GetModel());
        ply.SetNWInt("ZPDanceSequence", sequence);
        ply.SetNWInt("ZPDanceActivity", emote.Activity);
        ply.SetNWFloat("ZPDanceYaw", angles.y);
        ply.SetNWFloat("ZPDancePitch", angles.p);
        ply.SetNWFloat("ZPDanceStarted", started);
        ply.SetNWFloat("ZPDanceUntil", until);
        // The shared gesture slot applies this sequence without replacing the model's idle.
    }
    Stop(ply: ZPServerPlayer, cancelClick = false): void {
        this.End(ply.EntIndex(), cancelClick);
    }
    private End(id: number, cancelClick = false): void {
        const state = this.dancers[id];
        if (!state) return;
        delete this.dancers[id];
        if (cancelClick) this.cancelClicks[id] = true;
        if (IsValid(state.Player)) {
            delete state.Player.ZPDanceUntil;
            state.Player.SetNWFloat("ZPDanceUntil", 0);
            state.Player.SetNWInt("ZPDanceSequence", -1);
            state.Player.SetNWInt("ZPDanceActivity", -1);
            state.Player.SetNWString("ZPDanceModel", "");
            state.Player.SetNWFloat("ZPDanceYaw", 0);
            state.Player.SetNWFloat("ZPDancePitch", 0);
            state.Player.SetNWFloat("ZPDanceStarted", 0);
            StopDanceAnimation(state.Player);
        }
    }
    Command(ply: ZPServerPlayer, command: GLuaUserCommand): void {
        const id = ply.EntIndex(), state = this.dancers[id];
        if (state) {
            const cancel = command.KeyDown(IN_ATTACK);
            command.ClearButtons(); command.ClearMovement(); command.SetImpulse(0);
            command.SetViewAngles(state.Angles);
            if (cancel) this.Stop(ply, true);
        } else if (this.cancelClicks[id]) {
            if (!command.KeyDown(IN_ATTACK)) delete this.cancelClicks[id];
            command.RemoveKey(IN_ATTACK);
        }
    }
    Update(): void {
        for (const [, state] of pairs(this.dancers)) {
            if (state && (!this.Allowed(state.Player) || CurTime() >= state.Until ||
                state.Player.GetModel() !== state.Model || state.Player.Team() !== state.Team)) this.End(state.ID);
        }
    }
    Remove(ply: ZPServerPlayer): void {
        this.Stop(ply);
        const id = ply.EntIndex();
        delete this.nextRequest[id]; delete this.cancelClicks[id];
    }
}
const manager = new DanceManager();
for (const name of ["ZPDanceStart", "ZPDanceCancel"]) util.AddNetworkString(name);
// Empty legacy requests still mean dance. Only catalog IDs, never activities or durations, cross the network.
net.Receive("ZPDanceStart", (length, ply) => {
    if (length === 0) manager.Request(ply);
    else if (length === 8) manager.Request(ply, net.ReadUInt(8));
});
net.Receive("ZPDanceCancel", (length, ply) => { if (length === 0 && IsValid(ply)) manager.Stop(ply, true); });
hook.Add("StartCommand", "ZPDanceControls", (ply, command) => manager.Command(ply, command));
hook.Add("Think", "ZPDanceLifecycle", () => manager.Update());
hook.Add("PlayerDisconnected", "ZPDanceDisconnect", ply => manager.Remove(ply as ZPServerPlayer));
for (const event of ["PlayerDeath", "PlayerSpawn", "PlayerSilentDeath"] as const) hook.Add(event, "ZPDanceReset", (ply: ZPServerPlayer) => manager.Stop(ply));
