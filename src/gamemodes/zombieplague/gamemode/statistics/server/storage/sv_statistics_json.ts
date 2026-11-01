const schema = include("sh_statistics.lua") as typeof import("../../shared/sh_statistics");

/** Files are isolated by map. Invalid history is never replaced with an empty database. */
export class StatisticsJSONStorage implements ZPStatisticsStorage {
    private maps = new Map<string, Map<string, ZPStatisticsRecord>>();
    private previous = new Map<string, string>();
    private writable = false;
    constructor(private directory = "zombieplague/statistics/v1") {}

    Load(done: (this: void, records: ZPStatisticsRecord[] | undefined) => void): void {
        const rows: ZPStatisticsRecord[] = [];
        const [ok] = pcall(() => {
            const [files] = file.Find(this.directory + "/*.json", "DATA");
            for (const name of files) {
                const map = name.substring(0, name.length - 5);
                if (!schema.mapName(map)) throw "Invalid statistics filename";
                const raw = file.Read(this.directory + "/" + name, "DATA");
                if (!raw || raw.length > 16777216) throw "Unreadable statistics map";
                const data = schema.record(util.JSONToTable(raw));
                if ((data?.Version !== 1 && data?.Version !== 2 && data?.Version !== 3 && data?.Version !== 4) || data.Map !== map || !Array.isArray(data.Records)) throw "Invalid statistics map";
                const entries = new Map<string, ZPStatisticsRecord>();
                for (const value of data.Records) {
                    const row = schema.parse(value);
                    if (!row || row.Map !== map || entries.has(row.ID)) throw "Invalid statistics player";
                    entries.set(row.ID, row); rows.push(row);
                }
                this.maps.set(map, entries); this.previous.set(map, raw);
            }
        });
        this.writable = ok;
        done(ok ? rows : undefined);
    }

    Save(records: ZPStatisticsRecord[], done: (this: void, success: boolean) => void): void {
        if (!this.writable) { done(false); return; }
        const [ok] = pcall(() => {
            const changed = new Set<string>();
            for (const row of records) {
                const entries = this.maps.get(row.Map) ?? new Map<string, ZPStatisticsRecord>();
                this.maps.set(row.Map, entries); entries.set(row.ID, schema.copy(row)); changed.add(row.Map);
            }
            file.CreateDir(this.directory);
            for (const map of changed) {
                const path = this.directory + "/" + map + ".json";
                const data = util.TableToJSON({ Version: 4, Map: map, Records: [...(this.maps.get(map)?.values() ?? [])] });
                if (!data || data.length > 16777216) throw "Statistics map exceeds file limit";
                const previous = this.previous.get(map);
                if (previous !== undefined) {
                    file.Write(path + ".bak.txt", previous);
                    if (file.Read(path + ".bak.txt", "DATA") !== previous) throw "Statistics backup failed";
                }
                file.Write(path, data);
                if (file.Read(path, "DATA") !== data) throw "Statistics write failed";
                this.previous.set(map, data);
            }
        });
        done(ok);
    }
}
