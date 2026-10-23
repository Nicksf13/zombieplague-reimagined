export {};
const { ready, restricted, targets } = include("sv_spectator_rules.lua") as typeof import("./sv_spectator_rules");
interface Viewer { Player: ZPServerPlayer; Team: number; NextRequest: number; }

class SpectatorOverview implements ZPSpectatorOverviewServer {
    private viewers: Record<string, Viewer | undefined> = {};
    private toggles: Record<string, { Player: ZPServerPlayer; At: number } | undefined> = {};

    private Eligible(ply: ZPServerPlayer): boolean {
        return IsValid(ply) && !ply.Alive() &&
            [TEAM_SPECTATOR, TEAM_HUMANS, TEAM_ZOMBIES].includes(ply.Team()) && ZPRadar.OverviewReady(ply);
    }
    private Send(ply: ZPServerPlayer, active: boolean): void {
        if (!IsValid(ply)) return;
        const contacts: ZPSpectatorContact[] = [];
        if (active) for (const target of targets(ply)) {
            if (contacts.length >= 128) break;
            const position = target.GetPos(), yaw = target.EyeAngles().y;
            const role = target.IsNemesis() === true ? "nemesis" : target.IsSurvivor() === true ? "survivor" : undefined;
            contacts.push({ ID: target.EntIndex(), Name: target.Name().substring(0, 128), Team: target.Team(),
                Position: { x: position.x, y: position.y, z: position.z }, Yaw: ((yaw % 360) + 360) % 360,
                ...(role === undefined ? {} : { Role: role }) });
        }
        const snapshot: ZPSpectatorSnapshot = { Version: 1, Team: ply.Team(), Restricted: restricted(ply), Active: active, Contacts: contacts };
        net.Start("ZPSpectatorOverviewState"); net.WriteTable(snapshot); net.Send(ply);
    }
    Open(ply: ZPServerPlayer): boolean {
        if (!this.Eligible(ply) || !ready(ply)) return false;
        const previous = this.viewers[ply.EntIndex()];
        if (previous?.Player === ply) return true;
        this.viewers[ply.EntIndex()] = { Player: ply, Team: ply.Team(), NextRequest: 0 };
        // Keep the engine in a supported observer mode; overview is a presentation mode.
        ply.Spectate(OBS_MODE_ROAMING);
        this.Send(ply, true);
        return true;
    }
    private Close(ply: ZPServerPlayer): void {
        const viewer = this.viewers[ply.EntIndex()];
        if (viewer?.Player !== ply) return;
        delete this.viewers[ply.EntIndex()];
        this.Send(ply, false);
    }
    private Finish(ply: ZPServerPlayer, target?: ZPServerPlayer): void {
        this.Close(ply);
        if (!IsValid(ply) || ply.Alive()) return;
        const candidates = targets(ply);
        if (candidates.length === 0) { ply.Spectate(OBS_MODE_ROAMING); return; }
        const index = target === undefined ? 0 : candidates.indexOf(target);
        if (index < 0) return;
        ply.SpectateID = index;
        ply.MoveSpectateID(0, candidates);
        ply.Spectate(4); // OBS_MODE_IN_EYE: the next native mode after the overview.
    }
    Input(ply: ZPServerPlayer): boolean {
        const viewer = this.viewers[ply.EntIndex()];
        if (viewer?.Player !== ply) return false;
        if (!this.Eligible(ply) || viewer.Team !== ply.Team()) { this.Close(ply); return false; }
        if (ply.KeyPressed(IN_JUMP)) this.Finish(ply);
        return true;
    }
    Request(ply: ZPServerPlayer, id: number): void {
        const viewer = this.viewers[ply.EntIndex()];
        if (viewer?.Player !== ply || CurTime() < viewer.NextRequest) return;
        viewer.NextRequest = CurTime() + 0.2;
        if (!this.Eligible(ply) || viewer.Team !== ply.Team()) { this.Close(ply); return; }
        // A marker click never grants permission to observe an arbitrary entity.
        const target = id === 0 ? undefined : targets(ply).find(candidate => candidate.EntIndex() === id);
        if (id !== 0 && !target) return;
        this.Finish(ply, target);
    }
    Toggle(ply: ZPServerPlayer, args: string[]): void {
        if (!IsValid(ply) || !ply.IsPlayer() || args.length !== 0) return;
        const previous = this.toggles[ply.EntIndex()];
        if (previous?.Player === ply && CurTime() < previous.At) return;
        this.toggles[ply.EntIndex()] = { Player: ply, At: CurTime() + 0.3 };
        if (this.viewers[ply.EntIndex()]?.Player === ply) this.Finish(ply);
        else if (!this.Open(ply)) SendPopupMessage(ply, { Phrase: "zombieplague.overviewunavailable" });
    }
    Reset(ply: ZPServerPlayer): void { this.Close(ply); this.Tick(); }
    Tick(): void {
        for (const [id, viewer] of pairs(this.viewers)) {
            if (!viewer) continue;
            const ply = viewer.Player;
            if (!IsValid(ply)) { delete this.viewers[id]; continue; }
            if (!this.Eligible(ply) || viewer.Team !== ply.Team()) this.Close(ply);
            else this.Send(ply, true);
        }
    }
    ResetAll(): void {
        for (const [, viewer] of pairs(this.viewers)) if (viewer) this.Close(viewer.Player);
    }
}

const overview = new SpectatorOverview();
_G.ZPSpectatorOverview = overview;
for (const name of ["ZPSpectatorOverviewState", "ZPSpectatorOverviewFollow"]) util.AddNetworkString(name);
net.Receive("ZPSpectatorOverviewFollow", (length, ply) => {
    if (length === 16 && IsValid(ply) && ply.IsPlayer()) overview.Request(ply, net.ReadUInt(16));
});
Commands.AddCommand(["overview", "zp_overview"], "zombieplague.overviewtitle", (ply, args) => overview.Toggle(ply, args));
concommand.Add("zp_overview", (ply, _command, args) => overview.Toggle(ply, args));
hook.Add("PlayerSpawn", "ZPSpectatorOverview", ply => overview.Reset(ply));
hook.Add("PlayerDeath", "ZPSpectatorOverview", ply => overview.Reset(ply));
hook.Add("OnPlayerChangedTeam", "ZPSpectatorOverview", ply => overview.Reset(ply));
hook.Add("PlayerDisconnected", "ZPSpectatorOverview", ply => overview.Reset(ply));
hook.Add("ZPEndRound", "ZPSpectatorOverview", () => overview.ResetAll());
cvars.AddChangeCallback("zp_spectate_team_only", () => overview.Tick(), "ZPSpectatorOverview");
timer.Create("ZPSpectatorOverview", 0.2, 0, () => overview.Tick());
