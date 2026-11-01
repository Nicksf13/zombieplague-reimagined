const schema = include("sh_statistics.lua") as typeof import("../shared/sh_statistics");
const { StatisticsJSONStorage } = include("sv_statistics_json.lua") as typeof import("./storage/sv_statistics_json");
const weapons = include("sh_statistics_weapons.lua") as typeof import("../shared/sh_statistics_weapons");
const source = include("sv_statistics_weapon_source.lua") as typeof import("./sv_statistics_weapon_source");

interface RecordsContract {
    Initialize(): void;
    Flush(): void;
    Report(id: string, query: ZPStatisticsQuery): ZPStatisticsReport;
}
export class StatisticsRecords implements RecordsContract {
    Ready = false;
    private started = false;
    private saving = false;
    private storage: ZPStatisticsStorage = new StatisticsJSONStorage();
    private rows = new Map<string, ZPStatisticsRecord>();
    private dirty = new Map<string, number>();
    private revision = 0;

    SetStorage(storage: ZPStatisticsStorage): boolean {
        if (this.started) return false;
        this.storage = storage; return true;
    }
    Initialize(): void {
        if (this.started) return;
        this.started = true;
        this.storage.Load(records => {
            if (!records) { print("[ZP player statistics] History could not be loaded; collection paused to preserve stored data."); return; }
            const loaded = new Map<string, ZPStatisticsRecord>();
            for (const value of records) {
                const row = schema.parse(value), key = row && this.Key(row.Map, row.ID);
                if (!row || !key || loaded.has(key)) { print("[ZP player statistics] Backend returned invalid records; collection paused."); return; }
                loaded.set(key, row);
            }
            this.rows = loaded; this.Ready = true;
        });
    }
    private Key(map: string, id: string): string { return map + ":" + id; }
    Get(map: string, id: string, name: string): ZPStatisticsRecord {
        const key = this.Key(map, id);
        let row = this.rows.get(key);
        if (!row) { row = schema.empty(map, id, name); this.rows.set(key, row); }
        row.Name = schema.playerName(name); return row;
    }
    Touch(row: ZPStatisticsRecord): void { this.dirty.set(this.Key(row.Map, row.ID), ++this.revision); }
    Flush(): void {
        if (!this.Ready || this.saving || this.dirty.size === 0) return;
        const revisions = new Map(this.dirty), batch: ZPStatisticsRecord[] = [];
        for (const key of revisions.keys()) { const row = this.rows.get(key); if (row) batch.push(schema.copy(row)); }
        this.saving = true;
        this.storage.Save(batch, success => {
            this.saving = false;
            if (success) for (const [key, version] of revisions) {
                if (this.dirty.get(key) === version) this.dirty.delete(key);
            }
            else print("[ZP player statistics] Save failed; pending records retained for retry.");
        });
    }
    HasMap(map: string): boolean { return map === "" || map === game.GetMap() || [...this.rows.values()].some(row => row.Map === map); }
    Report(id: string, query: ZPStatisticsQuery): ZPStatisticsReport {
        const scope = query.Map.length > 0 ? query.Map : "all";
        const selectedWeapon = query.Weapon ?? "", weaponIDs = new Set<string>();
        const profiles = new Map<string, ZPStatisticsRecord>(), maps = new Set<string>([game.GetMap()]);
        for (const row of this.rows.values()) {
            maps.add(row.Map);
            if (query.Map !== "" && row.Map !== query.Map) continue;
            if (query.IncludeBots === false && row.Bot) continue;
            let profile = profiles.get(row.ID);
            if (!profile) { profile = schema.empty(scope, row.ID, row.Name); profiles.set(row.ID, profile); }
            schema.merge(profile, row);
        }
        for (const profile of profiles.values()) for (const [id, values] of pairs(profile.Weapons))
            if (weapons.metrics.some(metric => values[query.Role][metric] > 0)) weaponIDs.add(id);
        const ranked = [...profiles.values()].filter(row => row.Roles[query.Role].Rounds > 0).map(row => ({
            ID: row.ID, Bot: row.Bot, SteamID64: row.SteamID64, Name: row.Name, Value: selectedWeapon.length === 0 ? row.Roles[query.Role][query.Metric] :
                weapons.supports(query.Metric) ? row.Weapons[selectedWeapon]?.[query.Role][query.Metric] ?? 0 : 0, Rank: 0,
        }));
        ranked.sort((a, b) => b.Value - a.Value || (a.ID < b.ID ? -1 : 1));
        let previous = -1, rank = 0;
        ranked.forEach((row, index) => { if (row.Value !== previous) rank = index + 1; row.Rank = rank; previous = row.Value; });
        const self = ranked.find(row => row.ID === id), target = query.Target.length > 0 ? query.Target : id;
        const profile = profiles.get(target) ?? schema.empty(scope, id, "");
        const names = [...maps].filter(map => map !== game.GetMap()).sort(); names.unshift(game.GetMap());
        const available = [...weaponIDs].sort().slice(0, weapons.limit - 1);
        if (selectedWeapon.length > 0 && !available.includes(selectedWeapon)) available.push(selectedWeapon);
        const values = selectedWeapon.length > 0 ? profile.Weapons[selectedWeapon]?.[query.Role] : profile.Roles[query.Role];
        return { Maps: names.slice(0, 256), Leaders: ranked.slice(0, 20), SelfRank: self?.Rank ?? 0,
            SelfValue: self?.Value ?? 0, Players: ranked.length, Profile: schema.copy(profile),
            Weapons: available.map(id => ({ ID: id, Name: schema.playerName(source.name(id)) })),
            WeaponValues: { Kills: values?.Kills ?? 0, Infections: values?.Infections ?? 0,
                DamageDealt: values?.DamageDealt ?? 0, ArmorDamageDealt: values?.ArmorDamageDealt ?? 0 } };
    }
}
