export {};
interface Receipt { Request: ZPExtraMenuRequest; Code: ZPExtraMenuReplyCode; }
interface Session { NextRequest: number; LastPurchase: number; Receipts: Receipt[]; }
interface ExtraMenuServiceContract {
    Catalog(ply: ZPServerPlayer, id: number): void;
    Purchase(ply: ZPServerPlayer, request: ZPExtraMenuRequest): void;
    Disconnect(ply: ZPPlayer): void;
}

class ExtraMenuService implements ExtraMenuServiceContract {
    private sessions: Record<string, Session | undefined> = {};
    private Session(ply: ZPServerPlayer): Session {
        const key = ply.SteamID64(), session = this.sessions[key] ?? { NextRequest: 0, LastPurchase: 0, Receipts: [] };
        this.sessions[key] = session;
        return session;
    }
    private Team(ply: ZPServerPlayer): ZPExtraMenuKind | "spectator" {
        return ply.Team() === TEAM_HUMANS ? "human" : ply.Team() === TEAM_ZOMBIES ? "zombie" : "spectator";
    }
    private Availability(ply: ZPServerPlayer, kind: ZPExtraMenuKind, item: ZPRegisteredExtraItem): ZPExtraMenuAvailability {
        if (this.Team(ply) !== kind) return "wrong_team";
        if (!ply.Alive()) return "not_alive";
        if (!ZPExtraMenuProtocol.Amount(ply.GetAmmoPacks()) || !item.CanBuy(ply)) return "restricted";
        if (ply.GetAmmoPacks() < item.Price) return "insufficient";
        return "available";
    }
    private Snapshot(ply: ZPServerPlayer): ZPExtraMenuSnapshot {
        const entries: ZPExtraMenuEntry[] = [], seen: Record<string, boolean> = {};
        const team = this.Team(ply);
        let budget = 0, truncated = false;
        for (const kind of ["human", "zombie"] as const) {
            if (kind !== team) continue;
            const items = kind === "human" ? ExtraItemsManager.GetHumansExtraItems() : ExtraItemsManager.GetZombiesExtraItems();
            for (const item of items) {
                if (!item.ShouldBeEnabled() || !ZPExtraMenuProtocol.Amount(item.Price)) continue;
                const key = kind + ":" + item.ID, cost = item.ID.length + item.Name.length + 320;
                if (seen[key]) continue;
                if (entries.length >= 128 || budget + cost > 48000 || item.ID.length === 0 || item.ID.length > 128 || item.Name.length === 0 || item.Name.length > 128) {
                    truncated = true; continue;
                }
                budget += cost; seen[key] = true;
                entries.push({ ID: item.ID, Name: item.Name, Kind: kind, Price: item.Price, Order: item.Order,
                    Availability: this.Availability(ply, kind, item) });
            }
        }
        entries.sort((a, b) => a.Order !== b.Order ? a.Order - b.Order : a.ID < b.ID ? -1 : a.ID === b.ID ? 0 : 1);
        const balance = ply.GetAmmoPacks();
        return { Entries: entries, Balance: ZPExtraMenuProtocol.Amount(balance) ? balance : 0,
            Team: team, Alive: ply.Alive(), Truncated: truncated };
    }
    private Reply(ply: ZPServerPlayer, id: number, code: ZPExtraMenuReplyCode): void {
        const reply: ZPExtraMenuReply = code === "rate_limited" ? { Version: 1, RequestID: id, Code: code } :
            { Version: 1, RequestID: id, Code: code, Snapshot: this.Snapshot(ply) };
        net.Start("ZPExtraMenuReply"); net.WriteTable(reply); net.Send(ply);
    }
    private Allow(ply: ZPServerPlayer, id: number): boolean {
        const session = this.Session(ply);
        if (CurTime() < session.NextRequest) { this.Reply(ply, id, "rate_limited"); return false; }
        session.NextRequest = CurTime() + 0.25;
        return true;
    }
    Catalog(ply: ZPServerPlayer, id: number): void { if (this.Allow(ply, id)) this.Reply(ply, id, "catalog"); }
    Purchase(ply: ZPServerPlayer, request: ZPExtraMenuRequest): void {
        if (!this.Allow(ply, request.RequestID)) return;
        const session = this.Session(ply), previous = session.Receipts.find(receipt => receipt.Request.RequestID === request.RequestID);
        if (previous) {
            this.Reply(ply, request.RequestID, previous.Request.Kind === request.Kind && previous.Request.ID === request.ID ? previous.Code : "invalid_item");
            return;
        }
        // Reject old IDs even after their detailed receipt leaves the bounded cache.
        if (request.RequestID <= session.LastPurchase) { this.Reply(ply, request.RequestID, "invalid_item"); return; }
        session.LastPurchase = request.RequestID;
        const team = request.Kind === "human" ? TEAM_HUMANS : TEAM_ZOMBIES;
        const item = ExtraItemsManager.GetItemById(team, request.ID);
        let code: ZPExtraMenuReplyCode = "invalid_item";
        if (item && item.ShouldBeEnabled() && ZPExtraMenuProtocol.Amount(item.Price)) {
            if (this.Team(ply) !== request.Kind || !ply.Alive() || !ZPExtraMenuProtocol.Amount(ply.GetAmmoPacks())) code = "restricted";
            else code = ExtraItemsManager.BuyItem(ply, item);
        }
        session.Receipts.push({ Request: request, Code: code });
        if (session.Receipts.length > 16) session.Receipts.shift();
        this.Reply(ply, request.RequestID, code);
    }
    Disconnect(ply: ZPPlayer): void { delete this.sessions[ply.SteamID64()]; }
}
const service = new ExtraMenuService();
for (const name of ["ZPExtraMenuCatalog", "ZPExtraMenuBuy", "ZPExtraMenuReply", "ZPExtraMenuOpen"]) util.AddNetworkString(name);
net.Receive("ZPExtraMenuCatalog", (length, ply) => {
    if (!IsValid(ply) || length < 39 || length > 48) return;
    const version = net.ReadUInt(8), id = net.ReadUInt(31);
    if (version === 1 && ZPExtraMenuProtocol.RequestID(id)) service.Catalog(ply, id);
});
net.Receive("ZPExtraMenuBuy", (length, ply) => {
    if (!IsValid(ply) || length > 4096) return;
    const request = ZPExtraMenuProtocol.Purchase(net.ReadTable());
    if (request) service.Purchase(ply, request);
});
hook.Add("PlayerDisconnected", "ZPExtraMenuCleanup", ply => service.Disconnect(ply));
Commands.AddCommand("extras", "Open the extra items shop.", ply => { net.Start("ZPExtraMenuOpen"); net.Send(ply); });
