export {};

interface AdminSession { NextRequest: number; Token: number; Revision: number; Expires: number; }
interface AdminSettingsServiceContract {
    Receive(length: number, player: ZPServerPlayer): void;
    Disconnect(player: ZPPlayer): void;
}

class AdminSettingsService implements AdminSettingsServiceContract {
    private sessions: Record<string, AdminSession | undefined> = {};
    private revision = 1;
    private token = 0;
    private restarting = false;
    private readonly initialAudio = GetConVar("zp_map_mute_ambient")?.GetBool() ?? true;

    constructor() {
        for (const entry of ZPAdminConfig.Entries)
            cvars.AddChangeCallback(entry.Name, () => {
                this.revision = this.revision % 2147483647 + 1;
            }, "ZPAdminSettings");
    }

    private ReloadRequired(): boolean {
        return (GetConVar("zp_map_mute_ambient")?.GetBool() ?? true) !== this.initialAudio;
    }

    private Reply(player: ZPServerPlayer, id: number, code: number, session: AdminSession): void {
        net.Start("ZPAdminSettingsReply");
        net.WriteUInt(id, 31);
        net.WriteUInt(code, 2);
        if (code < 2) {
            const reload = this.ReloadRequired();
            this.token = this.token % 2147483647 + 1;
            // Reading settings never authorizes a restart; only an acknowledged save does.
            session.Token = reload && code === 1 ? this.token : 0;
            session.Revision = this.revision;
            session.Expires = CurTime() + 60;
            net.WriteUInt(this.revision, 31);
            net.WriteBool(reload);
            net.WriteUInt(session.Token, 31);
            for (const entry of ZPAdminConfig.Entries) {
                const raw = GetConVar(entry.Name)?.GetString() ?? entry.Default;
                net.WriteString(ZPAdminConfig.Normalize(entry, raw) ?? entry.Default);
            }
        }
        net.Send(player);
    }

    Receive(length: number, player: ZPServerPlayer): void {
        if (!IsValid(player) || length < 41 || length > 2048) return;
        // Permissions precede parsing the variable-length payload, for every action.
        if (!player.IsAdmin()) return;
        const version = net.ReadUInt(8), action = net.ReadUInt(2), id = net.ReadUInt(31);
        if (version !== 1 || id < 1 || action > 2) return;
        const key = player.SteamID64();
        const session = this.sessions[key] ?? { NextRequest: 0, Token: 0, Revision: 0, Expires: 0 };
        this.sessions[key] = session;
        if (CurTime() < session.NextRequest || this.restarting) {
            this.Reply(player, id, 2, session);
            return;
        }
        session.NextRequest = CurTime() + 0.25;
        if (action === 0) {
            this.Reply(player, id, 0, session);
            return;
        }
        if (length < (action === 1 ? 120 : 103)) return;
        const revision = net.ReadUInt(31);
        if (revision !== this.revision) {
            this.Reply(player, id, 2, session);
            return;
        }
        if (action === 1) {
            const values: string[] = [];
            const convars: GLuaConVar[] = [];
            // Validate the entire batch before changing any convar.
            for (const entry of ZPAdminConfig.Entries) {
                const value = ZPAdminConfig.Normalize(entry, net.ReadString());
                const convar = GetConVar(entry.Name);
                if (value === undefined || !convar) {
                    this.Reply(player, id, 2, session);
                    return;
                }
                values.push(value);
                convars.push(convar);
            }
            convars.forEach((convar, index) => {
                const value = values[index];
                if (value !== undefined) convar.SetString(value);
            });
            this.Reply(player, id, 1, session);
            return;
        }
        const token = net.ReadUInt(31);
        if (!this.ReloadRequired() || token === 0 || token !== session.Token ||
            session.Revision !== this.revision || CurTime() > session.Expires) {
            this.Reply(player, id, 2, session);
            return;
        }
        session.Token = 0;
        this.restarting = true;
        // Reload only the server's current map. No command/map text comes from the client.
        timer.Simple(0.1, () => {
            if (IsValid(player) && player.IsAdmin()) RunConsoleCommand("changelevel", game.GetMap());
            else this.restarting = false;
        });
    }

    Disconnect(player: ZPPlayer): void { delete this.sessions[player.SteamID64()]; }
}

const service = new AdminSettingsService();
util.AddNetworkString("ZPAdminSettingsRequest");
util.AddNetworkString("ZPAdminSettingsReply");
net.Receive("ZPAdminSettingsRequest", (length, player) => service.Receive(length, player));
hook.Add("PlayerDisconnected", "ZPAdminSettings", player => service.Disconnect(player));
