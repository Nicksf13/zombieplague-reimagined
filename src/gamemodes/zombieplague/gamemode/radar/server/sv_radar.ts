export {};
const { setting } = include("sv_radar_config.lua") as typeof import("./sv_radar_config");
const { loadOverview } = include("sv_radar_overview.lua") as typeof import("./sv_radar_overview");
interface Viewer {
    Player: ZPServerPlayer; Team: number; Purchased: boolean; Ready: boolean;
    ScanUntil: number; NextPulse: number; LastSend: number; Dirty: boolean;
    Contacts: Record<string, ZPRadarContact | undefined>;
    NextReady: number; NextAllies: number;
}

function specialPlayerRole(this: void, target: ZPServerPlayer): ZPRadarSpecialRole | undefined {
    return target.IsNemesis() === true ? "nemesis" : target.IsSurvivor() === true ? "survivor" : undefined;
}

class RadarService implements ZPRadarServer {
    private readonly overview = loadOverview();
    private viewers: Record<number, Viewer | undefined> = {};
    private lastAttacks: Record<number, number | undefined> = {};
    private camouflages: Record<number, { Player: ZPServerPlayer; Team: number } | undefined> = {};

    private Mode(): number { return Math.floor(setting("mode", 2, 0, 2)); }
    Available(): boolean { return this.overview !== undefined && this.Mode() > 0; }
    private Playing(): boolean { return RoundManager.GetRoundState() === ROUND_PLAYING; }
    private Alive(ply: ZPServerPlayer): boolean {
        return IsValid(ply) && ply.Alive() && (ply.Team() === TEAM_HUMANS || ply.Team() === TEAM_ZOMBIES);
    }
    private Viewer(ply: ZPServerPlayer): Viewer {
        const id = ply.EntIndex();
        const previous = this.viewers[id];
        const viewer = previous?.Player === ply ? previous : { Player: ply, Team: ply.Team(), Purchased: false, Ready: false,
            ScanUntil: 0, NextPulse: 0, LastSend: -10, Dirty: true, Contacts: {}, NextReady: 0, NextAllies: 0 };
        this.viewers[id] = viewer;
        if (viewer.Team !== ply.Team()) this.Clear(viewer);
        return viewer;
    }
    private Enabled(viewer: Viewer): boolean {
        return this.overview !== undefined && viewer.Ready && this.Alive(viewer.Player) &&
            this.Mode() > 0 && (this.Mode() === 2 || viewer.Purchased);
    }
    private Clear(viewer: Viewer): void {
        viewer.Team = viewer.Player.Team(); viewer.Purchased = false;
        viewer.ScanUntil = 0; viewer.NextPulse = 0; viewer.NextAllies = 0; viewer.Contacts = {}; viewer.Dirty = true;
    }
    private Send(viewer: Viewer): void {
        if (!IsValid(viewer.Player)) return;
        const enabled = this.Enabled(viewer);
        const contacts: ZPRadarContact[] = [];
        if (enabled) for (const [, contact] of pairs(viewer.Contacts)) if (contact) contacts.push(contact);
        const team = viewer.Team === TEAM_HUMANS || viewer.Team === TEAM_ZOMBIES ? viewer.Team : TEAM_SPECTATOR;
        const snapshot: ZPRadarSnapshot = { Version: 1, Team: team, Enabled: enabled,
            ScanUntil: enabled ? viewer.ScanUntil : 0, Contacts: contacts };
        net.Start("ZPRadarState"); net.WriteTable(snapshot); net.Send(viewer.Player);
        viewer.Dirty = false; viewer.LastSend = CurTime();
    }
    Ready(ply: ZPServerPlayer, ready: boolean): void {
        const viewer = this.Viewer(ply);
        if (CurTime() < viewer.NextReady) return;
        viewer.NextReady = CurTime() + 0.5;
        if (viewer.Ready === ready) return;
        viewer.Ready = ready;
        if (!ready) this.Clear(viewer);
        this.Allies(viewer);
        this.Send(viewer);
    }
    Initialize(ply: ZPServerPlayer): void {
        this.Reset(ply);
        net.Start("ZPRadarOverview"); net.WriteTable(this.overview ?? {}); net.Send(ply);
    }
    Reset(ply: ZPServerPlayer): void {
        const viewer = this.Viewer(ply);
        this.Clear(viewer); this.Send(viewer);
        delete this.lastAttacks[ply.EntIndex()];
        // A death or team change invalidates this target's old contacts for every viewer.
        this.Forget(ply);
    }
    private Forget(ply: GLuaEntity): void {
        this.ForgetID(ply.EntIndex());
    }
    private ForgetID(id: number): void {
        for (const [, other] of pairs(this.viewers)) if (other && other.Contacts[id]) {
            delete other.Contacts[id]; other.Dirty = true; this.Send(other);
        }
    }
    Camouflage(ply: ZPServerPlayer, active: boolean): void {
        const id = ply.EntIndex(), previous = this.camouflages[id];
        const resetEvent = "ZPResetAbilityEvent" + ply.SteamID64();
        if (active) {
            if (!this.Alive(ply) || (previous?.Player === ply && previous.Team === ply.Team())) return;
            this.camouflages[id] = { Player: ply, Team: ply.Team() };
            // Ability cancellation destroys its timer without running the normal expiry callback.
            hook.Add(resetEvent, "ZPRadarCamouflage", () => this.Camouflage(ply, false));
        } else {
            if (previous?.Player !== ply) return;
            delete this.camouflages[id];
            hook.Remove(resetEvent, "ZPRadarCamouflage");
        }
        // A disguise transition never creates or refreshes a positional sample.
        this.Forget(ply);
    }
    Disconnect(ply: ZPServerPlayer): void {
        this.Camouflage(ply, false);
        this.Reset(ply); delete this.viewers[ply.EntIndex()];
    }
    ResetAll(resetCamouflage = false): void {
        if (resetCamouflage) for (const [, disguise] of pairs(this.camouflages))
            if (disguise) this.Camouflage(disguise.Player, false);
        for (const [, viewer] of pairs(this.viewers)) if (viewer) { this.Clear(viewer); this.Send(viewer); }
        this.lastAttacks = {};
    }
    CanBuy(ply: ZPServerPlayer): boolean {
        const viewer = this.Viewer(ply);
        return this.Playing() && this.overview !== undefined && viewer.Ready && this.Mode() > 0 &&
            this.Alive(ply) && viewer.ScanUntil <= CurTime();
    }
    Purchase(ply: ZPServerPlayer): void {
        if (!this.CanBuy(ply)) return;
        const viewer = this.Viewer(ply);
        viewer.Purchased = true; viewer.ScanUntil = CurTime() + setting("scan_duration", 10, 1, 600);
        viewer.NextPulse = CurTime(); this.Pulse(viewer); this.Allies(viewer); this.Send(viewer);
    }
    private Enemy(viewer: Viewer, target: ZPServerPlayer): boolean {
        if (!this.Alive(target) || target === viewer.Player) return false;
        const team = target.Team(), disguise = this.camouflages[target.EntIndex()];
        const perceivedTeam = disguise?.Player === target && disguise.Team === team
            ? (team === TEAM_HUMANS ? TEAM_ZOMBIES : TEAM_HUMANS) : team;
        return perceivedTeam !== viewer.Team;
    }
    private Allies(viewer: Viewer): void {
        if (viewer.NextAllies > CurTime()) return;
        viewer.NextAllies = CurTime() + 0.5;
        for (const [id, contact] of pairs(viewer.Contacts)) if (contact?.Source === "ally") {
            delete viewer.Contacts[id]; viewer.Dirty = true;
        }
        if (setting("allies", 1, 0, 1) < 1 || !this.Enabled(viewer) || !this.Playing()) return;
        for (const target of player.GetAll()) if (target !== viewer.Player && this.Alive(target) && !this.Enemy(viewer, target))
            this.Mark(viewer, target, "ally", 1.5, specialPlayerRole(target));
    }
    RefreshAllies(): void {
        for (const [, viewer] of pairs(this.viewers)) if (viewer) {
            viewer.NextAllies = 0; this.Allies(viewer);
            if (viewer.Dirty) this.Send(viewer);
        }
    }
    private Mark(viewer: Viewer, target: GLuaEntity, source: ZPRadarContact["Source"], duration: number, role?: ZPRadarSpecialRole): void {
        if (!viewer.Contacts[target.EntIndex()] && Object.keys(viewer.Contacts).length >= 128) return;
        const position = target.GetPos();
        viewer.Contacts[target.EntIndex()] = { ID: target.EntIndex(), Position: { x: position.x, y: position.y, z: position.z },
            Source: source, Created: CurTime(), Expires: CurTime() + duration, Special: role !== undefined,
            ...(role === undefined ? {} : { Role: role }) };
        viewer.Dirty = true;
    }
    Attack(ply: ZPServerPlayer, melee: boolean): void {
        if (!this.Playing() || !this.Alive(ply) || !this.overview || this.Mode() === 0 || (melee && !ply.IsZombie())) return;
        const now = CurTime(), id = ply.EntIndex();
        // Shotgun pellets and addons can emit several callbacks for one attack.
        if (now < (this.lastAttacks[id] ?? -1) + 0.08) return;
        this.lastAttacks[id] = now;
        const range = melee ? setting("melee_range", 350, 0, 100000) : setting("shot_range", 2500, 0, 100000);
        for (const [, viewer] of pairs(this.viewers)) {
            if (!viewer || !this.Enabled(viewer) || !this.Enemy(viewer, ply)) continue;
            const duration = ZPRadarRules.Lifetime(Math.sqrt(viewer.Player.GetPos().DistToSqr(ply.GetPos())), range,
                setting("mark_min", 0.4, 0.1, 60), setting("mark_max", 3, 0.1, 60));
            // An existing scan snapshot keeps its source until the next pulse or expiry.
            const previous = viewer.Contacts[id];
            if (duration !== undefined && !(previous?.Source === "scan" && previous.Expires > now)) {
                // The service tick batches simultaneous shots into one snapshot per viewer.
                this.Mark(viewer, ply, "attack", duration, specialPlayerRole(ply));
            }
        }
    }
    Decoy(entity: GLuaEntity): void {
        if (!IsValid(entity) || !this.Playing() || !this.Available()) return;
        const range = setting("shot_range", 2500, 0, 100000);
        for (const [, viewer] of pairs(this.viewers)) {
            if (!viewer || !this.Enabled(viewer) || viewer.Team !== TEAM_ZOMBIES) continue;
            const duration = ZPRadarRules.Lifetime(Math.sqrt(viewer.Player.GetPos().DistToSqr(entity.GetPos())), range,
                setting("mark_min", 0.4, 0.1, 60), setting("mark_max", 3, 0.1, 60));
            if (duration !== undefined) this.Mark(viewer, entity, "attack", duration);
        }
    }
    ForgetDecoy(id: number): void { this.ForgetID(id); }
    private Pulse(viewer: Viewer): void {
        const interval = setting("scan_interval", 1, 0.2, 10), range = setting("scan_range", 3000, 0, 100000);
        viewer.NextPulse = CurTime() + interval;
        for (const target of player.GetAll()) if (this.Enemy(viewer, target) &&
            viewer.Player.GetPos().DistToSqr(target.GetPos()) <= range * range)
            this.Mark(viewer, target, "scan", Math.min(interval, viewer.ScanUntil - CurTime()), specialPlayerRole(target));
        viewer.Dirty = true;
    }
    Tick(): void {
        for (const [, viewer] of pairs(this.viewers)) {
            if (!viewer || !IsValid(viewer.Player)) continue;
            if (viewer.Team !== viewer.Player.Team() || (!this.Alive(viewer.Player) && (viewer.Purchased || viewer.ScanUntil > 0))) this.Clear(viewer);
            if (!this.Enabled(viewer) || !this.Playing()) {
                if (viewer.ScanUntil > 0 || Object.keys(viewer.Contacts).length > 0) {
                    viewer.ScanUntil = 0; viewer.Contacts = {}; viewer.Dirty = true;
                }
            } else {
                if (viewer.ScanUntil > CurTime() && viewer.NextPulse <= CurTime()) this.Pulse(viewer);
                this.Allies(viewer);
            }
            if (viewer.ScanUntil > 0 && viewer.ScanUntil <= CurTime()) { viewer.ScanUntil = 0; viewer.Dirty = true; }
            for (const [id, contact] of pairs(viewer.Contacts)) if (contact && contact.Expires <= CurTime()) {
                delete viewer.Contacts[id]; viewer.Dirty = true;
            }
            if (viewer.Dirty || CurTime() - viewer.LastSend >= 2) this.Send(viewer);
        }
    }
}

const radar = new RadarService();
_G.ZPRadar = radar;
for (const name of ["ZPRadarOverview", "ZPRadarReady", "ZPRadarState"]) util.AddNetworkString(name);
net.Receive("ZPRadarReady", (length, ply) => { if (length === 1 && IsValid(ply)) radar.Ready(ply, net.ReadBool()); });
hook.Add("ZPPlayerEnvironmentReady", "ZPRadar", ply => radar.Initialize(ply));
hook.Add("PlayerSpawn", "ZPRadar", ply => { radar.Camouflage(ply, false); radar.Reset(ply); });
hook.Add("PlayerDeath", "ZPRadar", ply => { radar.Camouflage(ply, false); radar.Reset(ply); });
hook.Add("OnPlayerChangedTeam", "ZPRadar", ply => { radar.Camouflage(ply, false); radar.Reset(ply); });
hook.Add("PlayerDisconnected", "ZPRadar", ply => radar.Disconnect(ply));
hook.Add("ZPEndRound", "ZPRadar", () => radar.ResetAll(true));
hook.Add("ZPCamouflageChanged", "ZPRadar", (ply, active) => radar.Camouflage(ply, active));
hook.Add("PostEntityFireBullets", "ZPRadar", entity => {
    if (!IsValid(entity)) return;
    const owner = entity.IsPlayer() ? entity : entity.GetOwner();
    if (IsValid(owner) && owner.IsPlayer()) radar.Attack(owner, false);
});
hook.Add("ZPRadarMelee", "ZPRadar", ply => radar.Attack(ply, true));
hook.Add("ZPRadarGunshot", "ZPRadar", ply => radar.Attack(ply, false));
hook.Add("OnEntityCreated", "ZPRadar", entity => {
    if (!["crossbow_bolt", "rpg_missile", "grenade_ar2", "prop_combine_ball"].includes(entity.GetClass())) return;
    // Native projectile owners may only be assigned after creation finishes.
    timer.Simple(0, () => {
        if (!IsValid(entity)) return;
        const owner = entity.GetOwner();
        if (IsValid(owner) && owner.IsPlayer()) radar.Attack(owner, false);
    });
});
cvars.AddChangeCallback("zp_radar_mode", () => radar.ResetAll(), "ZPRadar");
cvars.AddChangeCallback("zp_radar_allies", () => radar.RefreshAllies(), "ZPRadar");
timer.Create("ZPRadar", 0.1, 0, () => radar.Tick());
