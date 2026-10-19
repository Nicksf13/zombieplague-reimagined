export {};
interface CvarSession { Next: number; Reload?: { Token: number; Category: number; Revision: number; Expires: number }; }
interface ServerCvarsContract { Receive(length: number, ply: ZPServerPlayer): void; Disconnect(ply: ZPPlayer): void; }
/** Category-sized transactions keep payloads bounded and never execute client-supplied command names. */
class ServerCvarsService implements ServerCvarsContract {
    private sessions = new Map<string, CvarSession>();
    private revisions = new Map<ZPServerCvarGroup, number>();
    private watched = new Set<string>();
    private token = 0;
    private restarting = false;
    private readonly initial = new Map(ZPServerCvars.Entries.filter(entry => entry.Apply === "map")
        .map(entry => [entry.Name, GetConVar(entry.Name)?.GetString() ?? entry.Default] as const));
    private readonly direct = new Set(["zp_givetake_ammopacks_allowed", ...ZPAdminConfig.Entries.map(entry => entry.Name)]);
    private Registered(entry: ZPServerCvarEntry): GLuaConVar | undefined {
        return this.direct.has(entry.Name) || ConvarManager.Convars[entry.Name] !== undefined ? GetConVar(entry.Name) : undefined;
    }
    private Watch(category: ZPServerCvarGroup, entries: readonly ZPServerCvarEntry[]): void {
        for (const entry of entries) if (!this.watched.has(entry.Name) && this.Registered(entry)) {
            this.watched.add(entry.Name);
            cvars.AddChangeCallback(entry.Name, () => {
                this.revisions.set(category, (this.revisions.get(category) ?? 1) % 2147483647 + 1);
            }, "ZPServerCvars");
        }
    }
    private ReloadRequired(group: ZPServerCvarGroup): boolean {
        return ZPServerCvars.ForCategory(group).some(entry => {
            if (entry.Apply !== "map") return false;
            // Round registration caches this value before map-specific configs run.
            const cached = entry.Name === "zp_min_players" ? (RoundManager as ZPServerRoundManager).GetRounds().SimpleRound?.MinPlayers : undefined;
            const applied = cached !== undefined ? tostring(cached) : this.initial.get(entry.Name) ?? entry.Default;
            const current = this.Registered(entry)?.GetString() ?? applied;
            if (entry.Kind === "number") return Number(current) !== Number(applied);
            return (ZPServerCvars.Normalize(entry, current) ?? current) !== (ZPServerCvars.Normalize(entry, applied) ?? applied);
        });
    }
    private Reply(ply: ZPServerPlayer, id: number, categoryIndex: number, code: number, version: number, session: CvarSession): void {
        delete session.Reload;
        net.Start("ZPServerCvarsReply"); net.WriteUInt(version, 8); net.WriteUInt(id, 31);
        net.WriteUInt(categoryIndex, 8); net.WriteUInt(code, 2);
        const category = ZPServerCvars.Categories[categoryIndex];
        if (category && code < 2) {
            net.WriteUInt(this.revisions.get(category.ID) ?? 1, 31);
            const entries = ZPServerCvars.ForCategory(category.ID); net.WriteUInt(entries.length, 8);
            for (const entry of entries) {
                const convar = this.Registered(entry); net.WriteBool(convar !== undefined);
                const raw = convar?.GetString() ?? entry.Default;
                // Show the real value even if a console/addon set it outside the editor's constraints.
                net.WriteString(raw.length <= 128 ? raw : raw.substring(0, 128));
            }
            if (version === 2) {
                const reload = this.ReloadRequired(category.ID);
                if (reload && code === 1) {
                    this.token = this.token % 2147483647 + 1;
                    session.Reload = { Token: this.token, Category: categoryIndex,
                        Revision: this.revisions.get(category.ID) ?? 1, Expires: CurTime() + 60 };
                }
                net.WriteBool(reload); net.WriteUInt(session.Reload?.Token ?? 0, 31);
            }
        }
        net.Send(ply);
    }
    Receive(length: number, ply: ZPServerPlayer): void {
        if (!IsValid(ply) || !ply.IsAdmin() || length < 49 || length > 32768) return;
        const version = net.ReadUInt(8), action = net.ReadUInt(2), id = net.ReadUInt(31), index = net.ReadUInt(8);
        const category = ZPServerCvars.Categories[index];
        // Environment retains its existing restart-confirmation protocol.
        if ((version !== 1 && version !== 2) || action > (version === 2 ? 2 : 1) || id < 1 || !category || category.ID === "environment" || this.restarting) return;
        const session = this.sessions.get(ply.SteamID64()) ?? { Next: 0 };
        this.sessions.set(ply.SteamID64(), session);
        const reply = (code: number): void => this.Reply(ply, id, index, code, version, session);
        if (CurTime() < session.Next) { reply(2); return; }
        session.Next = CurTime() + 0.25;
        const entries = ZPServerCvars.ForCategory(category.ID); this.Watch(category.ID, entries);
        if (action === 0) { reply(0); return; }
        if ((category.SuperAdmin && !ply.IsSuperAdmin()) || length < (action === 2 ? 111 : 88)) { reply(2); return; }
        if (action === 2) {
            const revision = net.ReadUInt(31), token = net.ReadUInt(31), authorization = session.Reload;
            if (!authorization || token === 0 || token !== authorization.Token || index !== authorization.Category ||
                revision !== authorization.Revision || revision !== (this.revisions.get(category.ID) ?? 1) ||
                CurTime() > authorization.Expires || !this.ReloadRequired(category.ID)) { reply(2); return; }
            delete session.Reload; this.restarting = true;
            timer.Simple(0.1, () => {
                if (IsValid(ply) && this.sessions.get(ply.SteamID64()) === session && ply.IsAdmin() &&
                    (!category.SuperAdmin || ply.IsSuperAdmin()) && revision === (this.revisions.get(category.ID) ?? 1) && this.ReloadRequired(category.ID))
                    RunConsoleCommand("changelevel", game.GetMap());
                else this.restarting = false;
            });
            return;
        }
        const revision = net.ReadUInt(31), count = net.ReadUInt(8);
        if (revision !== (this.revisions.get(category.ID) ?? 1) || count < 1 || count > entries.length || length < 88 + count * 16) {
            reply(2); return;
        }
        const touched = new Set<number>(), changes: { Convar: GLuaConVar; Value: string }[] = [];
        for (let item = 0; item < count; item++) {
            const field = net.ReadUInt(8), raw = net.ReadString(), entry = entries[field];
            if (!entry || touched.has(field)) { reply(2); return; }
            touched.add(field);
            const value = ZPServerCvars.Normalize(entry, raw), convar = this.Registered(entry);
            if (value === undefined || !convar) { reply(2); return; }
            changes.push({ Convar: convar, Value: value });
        }
        // Only changed fields are written, after every field has passed validation.
        for (const change of changes) if (change.Convar.GetString() !== change.Value) change.Convar.SetString(change.Value);
        reply(1);
    }
    Disconnect(ply: ZPPlayer): void { this.sessions.delete(ply.SteamID64()); }
}
const service = new ServerCvarsService();
util.AddNetworkString("ZPServerCvarsRequest"); util.AddNetworkString("ZPServerCvarsReply");
net.Receive("ZPServerCvarsRequest", (length, ply) => service.Receive(length, ply));
hook.Add("PlayerDisconnected", "ZPServerCvars", ply => service.Disconnect(ply));
