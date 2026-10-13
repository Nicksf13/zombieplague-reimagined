export {};
interface Receipt { Request: ZPWeaponMenuRequest; Code: ZPWeaponMenuReplyCode; }
interface Session { NextRequest: number; Receipts: Receipt[]; }
interface WeaponMenuServiceContract {
    Catalog(ply: ZPServerPlayer, id: number): void;
    Select(ply: ZPServerPlayer, request: ZPWeaponMenuRequest): void;
    Disconnect(ply: ZPPlayer): void;
    OpenMissing(ply: ZPServerPlayer): void;
    Remember(ply: ZPServerPlayer, id: number, remember: boolean): void;
}

// The adapter delegates to existing Player setters: saving and delivery keep their rules.
class WeaponMenuService implements WeaponMenuServiceContract {
    private sessions: Record<string, Session | undefined> = {};

    private Session(ply: ZPServerPlayer): Session {
        const id = ply.SteamID64();
        const session = this.sessions[id] ?? { NextRequest: 0, Receipts: [] };
        this.sessions[id] = session;
        return session;
    }

    Disconnect(ply: ZPPlayer): void { delete this.sessions[ply.SteamID64()]; }

    private CanReceive(ply: ZPServerPlayer, kind: ZPWeaponMenuCategory): boolean {
        const given = kind === "primary" ? ply.GetPrimaryWeaponGiven() :
            kind === "secondary" ? ply.GetSecondaryWeaponGiven() : ply.GetMeleeWeaponGiven();
        return ply.Alive() && ply.IsHuman() && !given;
    }

    private Snapshot(ply: ZPServerPlayer): ZPWeaponMenuSnapshot {
        const entries: ZPWeaponMenuEntry[] = [];
        let budget = 0, truncated = false;
        for (const [kind, weaponType] of [["primary", WEAPON_PRIMARY], ["secondary", WEAPON_SECONDARY], ["melee", WEAPON_MELEE]] as const) {
            for (const [, weapon] of pairs(WeaponManager.GetWeaponsTableByWeaponType(weaponType))) {
                if (!weapon.ShouldBeEnabled())
                    continue;
                // Bound WriteTable well below GMod's message limit, including field/type overhead.
                const namePhrase = typeof weapon.NamePhrase === "string" && weapon.NamePhrase.length <= 128 ? weapon.NamePhrase : undefined;
                const description = typeof weapon.Description === "string" && weapon.Description.length <= 128 ? weapon.Description : undefined;
                const cost = weapon.WeaponID.length + weapon.PrettyName.length + (namePhrase?.length ?? 0) + (description?.length ?? 0) + 256;
                if (entries.length >= 256 || budget + cost > 48000 || weapon.WeaponID.length > 128 || weapon.PrettyName.length > 128) {
                    truncated = true;
                    continue;
                }
                budget += cost;
                entries.push({ ID: weapon.WeaponID, Name: weapon.PrettyName, Kind: kind, Order: weapon.Order,
                    ...(namePhrase ? { NamePhrase: namePhrase } : {}), ...(description ? { Description: description } : {}),
                    Family: ZPWeaponMenuProtocol.Family(weapon.Family) ? weapon.Family : kind === "secondary" ? "pistol" : kind === "melee" ? "melee" : "other" });
            }
        }
        entries.sort((a, b) => a.Order !== b.Order ? a.Order - b.Order : a.ID < b.ID ? -1 : a.ID === b.ID ? 0 : 1);
        return {
            Entries: entries,
            // The default crowbar is a fallback loadout, not an explicit melee choice.
            Selected: { primary: ply.GetPrimaryWeapon()?.WeaponID ?? "", secondary: ply.GetSecondaryWeapon()?.WeaponID ?? "", melee: ply.MeleeWeapon?.WeaponID ?? "" },
            CanReceive: { primary: this.CanReceive(ply, "primary"), secondary: this.CanReceive(ply, "secondary"), melee: this.CanReceive(ply, "melee") },
            Truncated: truncated,
            Remember: ply.RememberWeaponChoices ?? true,
        };
    }

    OpenMissing(ply: ZPServerPlayer): void {
        if (!IsValid(ply) || ply.IsBot() || !ply.Alive() || !ply.IsHuman() || ply.IsSurvivor())
            return;
        const snapshot = this.Snapshot(ply);
        const missing = (["primary", "secondary", "melee"] as const).find(kind =>
            snapshot.Selected[kind] === "" && snapshot.Entries.some(entry => entry.Kind === kind));
        if (missing) {
            net.Start("ZPWeaponMenuMissing");
            net.WriteString(missing);
            net.Send(ply);
        }
    }

    private Reply(ply: ZPServerPlayer, id: number, code: ZPWeaponMenuReplyCode): void {
        const reply: ZPWeaponMenuReply = code === "invalid_weapon" || code === "rate_limited" ?
            { Version: 1, RequestID: id, Code: code } : { Version: 1, RequestID: id, Code: code, Snapshot: this.Snapshot(ply) };
        net.Start("ZPWeaponMenuReply");
        net.WriteTable(reply);
        net.Send(ply);
    }

    private Allow(session: Session): boolean {
        if (CurTime() < session.NextRequest)
            return false;
        session.NextRequest = CurTime() + 0.2;
        return true;
    }

    Catalog(ply: ZPServerPlayer, id: number): void {
        if (!this.Allow(this.Session(ply))) {
            this.Reply(ply, id, "rate_limited");
            return;
        }
        this.Reply(ply, id, "catalog");
    }

    Remember(ply: ZPServerPlayer, id: number, remember: boolean): void {
        if (!this.Allow(this.Session(ply))) {
            this.Reply(ply, id, "rate_limited");
            return;
        }
        // Applies at the next round boundary; current inventory and choices stay intact.
        ply.RememberWeaponChoices = remember;
        this.Reply(ply, id, "preferences");
    }

    Select(ply: ZPServerPlayer, request: ZPWeaponMenuRequest): void {
        const session = this.Session(ply);
        if (!this.Allow(session)) {
            this.Reply(ply, request.RequestID, "rate_limited");
            return;
        }
        const previous = session.Receipts.find(receipt => receipt.Request.RequestID === request.RequestID);
        if (previous) {
            const matches = previous.Request.Kind === request.Kind && previous.Request.ID === request.ID;
            this.Reply(ply, request.RequestID, matches ? previous.Code : "invalid_weapon");
            return;
        }
        const weaponType = request.Kind === "primary" ? WEAPON_PRIMARY : request.Kind === "secondary" ? WEAPON_SECONDARY : WEAPON_MELEE;
        const weapon = WeaponManager.FindWeaponByWeaponId(request.ID, weaponType);
        let code: ZPWeaponMenuReplyCode = "invalid_weapon";
        if (weapon && weapon.ShouldBeEnabled()) {
            const canReceive = this.CanReceive(ply, request.Kind);
            if (request.Kind === "primary")
                ply.SetPrimaryWeapon(weapon);
            else if (request.Kind === "secondary")
                ply.SetSecondaryWeapon(weapon);
            else
                ply.SetMeleeWeapon(weapon);
            code = canReceive && IsValid(ply.GetWeapon(weapon.WeaponID)) ? "issued" : "saved";
        }
        session.Receipts.push({ Request: request, Code: code });
        if (session.Receipts.length > 16)
            session.Receipts.shift();
        this.Reply(ply, request.RequestID, code);
    }
}

const service = new WeaponMenuService();
for (const name of ["ZPWeaponMenuCatalog", "ZPWeaponMenuSelect", "ZPWeaponMenuReply", "ZPWeaponMenuOpen", "ZPWeaponMenuMissing", "ZPWeaponMenuRemember"])
    util.AddNetworkString(name);
net.Receive("ZPWeaponMenuCatalog", (length, ply) => {
    if (!IsValid(ply) || length > 128)
        return;
    const version = net.ReadUInt(8), id = net.ReadUInt(31);
    if (version === 1 && ZPWeaponMenuProtocol.RequestID(id))
        service.Catalog(ply, id);
});
net.Receive("ZPWeaponMenuSelect", (length, ply) => {
    if (!IsValid(ply) || length > 4096)
        return;
    const request = ZPWeaponMenuProtocol.Selection(net.ReadTable());
    if (request)
        service.Select(ply, request);
});
net.Receive("ZPWeaponMenuRemember", (length, ply) => {
    if (!IsValid(ply) || length < 40 || length > 48)
        return;
    const version = net.ReadUInt(8), id = net.ReadUInt(31);
    if (version === 1 && ZPWeaponMenuProtocol.RequestID(id))
        service.Remember(ply, id, net.ReadBool());
});
hook.Add("PlayerDisconnected", "ZPWeaponMenuCleanup", ply => service.Disconnect(ply));
// PlayerLoadout establishes the human/zombie state inside GM.PlayerSpawn.
hook.Add("PlayerSpawn", "ZPWeaponMenuMissingChoices", ply => {
    timer.Simple(0, () => service.OpenMissing(ply));
});
Commands.AddCommand("weapons", "Open the weapon selection HUD.", ply => {
    net.Start("ZPWeaponMenuOpen");
    net.Send(ply);
});
