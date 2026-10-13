export {};
interface Receipt { Request: ZPClassMenuRequest; Code: ZPClassMenuReplyCode; }
interface Session { NextRequest: number; Selected: Record<ZPClassMenuKind, string>; Receipts: Receipt[]; }

class ClassMenuService implements ZPClassMenuService {
    private sessions: Record<string, Session | undefined> = {};

    private Session(ply: ZPServerPlayer): Session {
        const id = ply.SteamID64();
        const session = this.sessions[id] ?? { NextRequest: 0, Selected: { human: "", zombie: "" }, Receipts: [] };
        this.sessions[id] = session;
        return session;
    }

    private Registry(kind: ZPClassMenuKind): Record<string, ZPClassDefinition> {
        return kind === "human" ? ClassManager.GetHumanClasses() : ClassManager.GetZombieClasses();
    }

    NeedsChoice(ply: ZPServerPlayer, kind: ZPClassMenuKind): boolean {
        const definition = this.Registry(kind)[this.Session(ply).Selected[kind]];
        return !definition || !definition.ShouldBeEnabled();
    }

    private Snapshot(ply: ZPServerPlayer): ZPClassMenuSnapshot {
        const entries: ZPClassMenuEntry[] = [];
        let budget = 0;
        // Reserve space for table keys/type overhead as well as bounded strings.
        for (const kind of ["human", "zombie"] as const) {
            for (const [id, definition] of pairs(this.Registry(kind))) {
                const cost = id.length + definition.Name.length + definition.Description.length + 900;
                if (entries.length >= 64 || !definition.ShouldBeEnabled() || id.length > 128 ||
                    definition.Name.length > 128 || definition.Description.length > 128 || budget + cost > 48000) continue;
                budget += cost;
                entries.push({ ID: id, Kind: kind, Name: definition.Name, Description: definition.Description, Order: definition.Order,
                    Health: definition.MaxHealth, Armor: definition.Armor ?? 0, Speed: definition.Speed,
                    RunSpeed: kind === "zombie" && !cvars.Bool("zp_zombie_should_run", true) ? definition.Speed : definition.RunSpeed,
                    Gravity: definition.Gravity, Jump: definition.JumpPower, Damage: definition.DamageAmplifier,
                    Ability: definition.Ability?.MaxAbilityPower ?? 0, CrouchSpeed: definition.CrouchSpeed,
                    Battery: kind === "human" ? definition.Battery ?? 100 : 0, Breath: definition.Breath,
                    Scale: definition.Scale ?? 1, Footstep: definition.Footstep, FallDamage: definition.FallFunction(),
                    AbilityCost: definition.Ability?.Drain ?? 0, AbilityOnActivation: definition.Ability?.DrainOnActivation ?? false });
            }
        }
        entries.sort((a, b) => a.Order !== b.Order ? a.Order - b.Order : a.ID < b.ID ? -1 : a.ID === b.ID ? 0 : 1);
        return { Entries: entries, Selected: { ...this.Session(ply).Selected },
            First: { human: this.NeedsChoice(ply, "human"), zombie: this.NeedsChoice(ply, "zombie") } };
    }

    private Reply(ply: ZPServerPlayer, id: number, code: ZPClassMenuReplyCode): void {
        const reply: ZPClassMenuReply = code === "invalid" || code === "rate_limited" ?
            { Version: 1, RequestID: id, Code: code } : { Version: 1, RequestID: id, Code: code, Snapshot: this.Snapshot(ply) };
        net.Start("ZPClassMenuReply"); net.WriteTable(reply); net.Send(ply);
    }

    private Allow(ply: ZPServerPlayer, id: number): boolean {
        const session = this.Session(ply);
        if (CurTime() < session.NextRequest) {
            this.Reply(ply, id, "rate_limited"); return false;
        }
        session.NextRequest = CurTime() + 0.2;
        return true;
    }

    Catalog(ply: ZPServerPlayer, id: number): void {
        if (this.Allow(ply, id)) this.Reply(ply, id, "catalog");
    }

    Select(ply: ZPServerPlayer, request: ZPClassMenuRequest): void {
        if (!this.Allow(ply, request.RequestID)) return;
        const session = this.Session(ply), previous = session.Receipts.find(receipt => receipt.Request.RequestID === request.RequestID);
        if (previous) {
            this.Reply(ply, request.RequestID, previous.Request.Kind === request.Kind && previous.Request.ID === request.ID ? previous.Code : "invalid");
            return;
        }
        // Exact registry lookup: GetZPClass intentionally falls back to a random class.
        const definition = this.Registry(request.Kind)[request.ID];
        let code: ZPClassMenuReplyCode = "invalid";
        if (definition && definition.ShouldBeEnabled()) {
            const current = request.Kind === "human" ? ply.IsHuman() : ply.IsZombie();
            const immediate = this.NeedsChoice(ply, request.Kind) && ply.Alive() && current && !ply.IsSurvivor() && !ply.IsNemesis();
            session.Selected[request.Kind] = request.ID;
            if (immediate) {
                ZPApplyInitialClass(ply, definition, request.Kind);
                code = "applied";
            }
            else {
                if (request.Kind === "human") ply.SetNextHumanClass(definition);
                else ply.SetNextZombieClass(definition);
                code = "saved";
            }
        }
        session.Receipts.push({ Request: request, Code: code });
        if (session.Receipts.length > 16) session.Receipts.shift();
        this.Reply(ply, request.RequestID, code);
        if (code === "applied" && request.Kind === "human") hook.Call("ZPClassMenuConfirmed", GAMEMODE, ply);
    }

    OpenMissing(ply: ZPServerPlayer): void {
        if (!IsValid(ply) || ply.IsBot() || !ply.Alive() || ply.IsSurvivor() || ply.IsNemesis()) return;
        const kind = ply.IsHuman() ? "human" : ply.IsZombie() ? "zombie" : undefined;
        if (kind && this.NeedsChoice(ply, kind) && this.Snapshot(ply).Entries.some(entry => entry.Kind === kind)) {
            net.Start("ZPClassMenuMissing"); net.WriteString(kind); net.Send(ply);
        }
    }

    Disconnect(ply: ZPPlayer): void { delete this.sessions[ply.SteamID64()]; }
}
const service = new ClassMenuService();
_G.ZPClassMenu = service;
for (const name of ["ZPClassMenuCatalog", "ZPClassMenuSelect", "ZPClassMenuReply", "ZPClassMenuMissing", "ZPClassMenuOpen"])
    util.AddNetworkString(name);
net.Receive("ZPClassMenuCatalog", (length, ply) => {
    if (!IsValid(ply) || length < 39 || length > 48) return;
    const version = net.ReadUInt(8), id = net.ReadUInt(31);
    if (version === 1 && ZPClassMenuProtocol.RequestID(id)) service.Catalog(ply, id);
});
net.Receive("ZPClassMenuSelect", (length, ply) => {
    if (!IsValid(ply) || length > 4096) return;
    const request = ZPClassMenuProtocol.Selection(net.ReadTable());
    if (request) service.Select(ply, request);
});
hook.Add("ZPClassSelectionReady", "ZPClassMenuFirstChoice", (ply: ZPServerPlayer) => {
    timer.Simple(0, () => service.OpenMissing(ply));
});
hook.Add("PlayerDisconnected", "ZPClassMenuCleanup", ply => service.Disconnect(ply));
Commands.AddCommand("classes", "Open the class selection menu.", ply => {
    net.Start("ZPClassMenuOpen"); net.Send(ply);
});
