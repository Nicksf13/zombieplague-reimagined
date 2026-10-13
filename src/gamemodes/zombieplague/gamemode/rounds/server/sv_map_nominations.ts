export {};
export class MapNominations implements ZPMapNominations {
    private nominations: Record<string, string | undefined> = {};
    private nextRequest: Record<string, number | undefined> = {};

    GetMaps(prefixes: string[]): string[] {
        const [files] = file.Find("maps/*.bsp", "GAME");
        return files.map(name => string.sub(name, 1, -5)).filter(name => name !== game.GetMap() &&
            ZPMapVoteProtocol.Map(name) && prefixes.some(prefix => string.StartWith(name, prefix)));
    }

    Candidates(prefixes: string[], limit: number): string[] {
        const maps = this.GetMaps(prefixes), support: Record<string, number> = {};
        for (const [, map] of pairs(this.nominations))
            if (map && maps.includes(map)) support[map] = (support[map] ?? 0) + 1;
        // Shuffle first: equal nomination counts and unrequested maps get equal chances.
        for (let index = maps.length - 1; index > 0; index--) {
            const other = math.random(0, index), first = maps[index], second = maps[other];
            if (first && second) { maps[index] = second; maps[other] = first; }
        }
        maps.sort((a, b) => (support[b] ?? 0) - (support[a] ?? 0));
        return maps.slice(0, limit);
    }

    Nominate(ply: ZPServerPlayer, args: string[]): void {
        if (!IsValid(ply) || ply.IsBot()) return;
        const id = ply.SteamID64();
        if (CurTime() < (this.nextRequest[id] ?? 0)) return;
        this.nextRequest[id] = CurTime() + 1;
        let key = "mapvoteusage", selected = "";
        if (ZPVoteMap.Voting || RoundManager.GetRoundState() === ROUND_CHANGING_MAP) key = "mapvotelocked";
        else if (args.length === 1 && ZPMapVoteProtocol.Map(args[0])) {
            selected = string.lower(args[0]);
            if (this.GetMaps(ALLOWED_PREFIX).includes(selected)) {
                this.nominations[id] = selected;
                key = "mapvotenominated";
            }
            else key = "mapvoteinvalid";
        }
        if (key === "mapvoteusage")
            SendConsoleMessage(ply, { Phrase: "zombieplague.mapvotemaplist", Arguments: [this.GetMaps(ALLOWED_PREFIX).join(", ")] });
        SendColorMessage(ply, { Phrase: "zombieplague." + key,
            Arguments: key === "mapvotenominated" ? [selected] : [] }, Color(239, 190, 76));
    }

    Remove(ply: ZPServerPlayer): void {
        const id = ply.SteamID64();
        delete this.nominations[id]; delete this.nextRequest[id];
    }
    Clear(): void { this.nominations = {}; }
}
const nominations = new MapNominations();
_G.ZPMapNominations = nominations;
Commands.AddCommand(["nominate", "nominar"], "zombieplague.mapvotenominatehelp", (ply, args) => nominations.Nominate(ply, args), "<map>");
concommand.Add("zp_nominate", (ply, _command, args) => nominations.Nominate(ply, args));
hook.Add("PlayerDisconnected", "ZPMapNominations", ply => nominations.Remove(ply as ZPServerPlayer));
