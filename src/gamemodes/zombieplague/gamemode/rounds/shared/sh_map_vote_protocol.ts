export {};
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const integer = (value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 2147483647 && value % 1 === 0;
const mapName = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 &&
    string.match(value, "^[%w_%-]+$") !== undefined;
_G.ZPMapVoteProtocol = {
    Map: mapName,
    Request(this: void, value) {
        const data = record(value);
        if (data?.Version === 1 && integer(data.ID) && data.ID > 0 && mapName(data.Map))
            return { Version: 1, ID: data.ID, Map: data.Map };
    },
    Snapshot(this: void, value) {
        const data = record(value), entries = record(data?.Entries);
        if (data?.Version !== 1 || !integer(data.ID) || typeof data.Voting !== "boolean" || !entries ||
            Object.keys(entries).length > 9 || typeof data.Remaining !== "number" || data.Remaining < 0 || data.Remaining > 120 ||
            data.Remaining !== data.Remaining || typeof data.Selected !== "string" || typeof data.Winner !== "string") return;
        const result: ZPMapVoteEntry[] = [], seen: Record<string, boolean> = {};
        let extensions = 0;
        for (let index = 1; index <= Object.keys(entries).length; index++) {
            const entry = record(entries[index]);
            if (!entry || !mapName(entry.Map) || !integer(entry.Votes) || typeof entry.Extend !== "boolean" || seen[entry.Map]) return;
            if (entry.Extend) extensions++;
            seen[entry.Map] = true;
            result.push({ Map: entry.Map, Votes: entry.Votes, Extend: entry.Extend });
        }
        if (extensions > 1 || result.length - extensions > 8 || (data.Voting && (result.length === 0 || data.ID === 0)) ||
            (data.Selected !== "" && !seen[data.Selected]) || (data.Winner !== "" && !seen[data.Winner])) return;
        return { Version: 1, ID: data.ID, Voting: data.Voting, Remaining: data.Remaining,
            Entries: result, Selected: data.Selected, Winner: data.Winner };
    },
};
