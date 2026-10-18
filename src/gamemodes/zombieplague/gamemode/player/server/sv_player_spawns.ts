const { PlayerSpawnOccupancy, sameSpawnLocation } = include("sv_spawn_occupancy.lua") as typeof import("./sv_spawn_occupancy");
export {};

interface PlayerSpawnQueue {
    Select(ply: ZPServerPlayer, transition?: boolean): GLuaEntity | undefined;
    CheckSpawn(ply: ZPServerPlayer, transition?: boolean): void;
    Reset(): void;
}

class ServerPlayerSpawnQueue implements PlayerSpawnQueue {
    private queues: Record<number, GLuaEntity[] | undefined> = {};
    private occupancy = new PlayerSpawnOccupancy();
    private pendingChecks = new Map<ZPServerPlayer, object>();

    constructor(private gamemode: ZPGameMode) {}

    Reset(): void {
        this.queues = {};
        this.occupancy.Reset();
        this.pendingChecks.clear();
    }

    CheckSpawn(ply: ZPServerPlayer, transition?: boolean): void {
        if (transition) return;
        const request = {};
        this.pendingChecks.set(ply, request);
        // PlayerSpawn hooks run before the gamemode finishes restoring the player.
        // Check the final engine position once, after the entire spawn wave completes.
        timer.Simple(0, () => {
            if (this.pendingChecks.get(ply) !== request) return;
            this.pendingChecks.delete(ply);
            if (!IsValid(ply) || !ply.Alive() || ply.Team() === TEAM_SPECTATOR || ply.ZPVoluntarySpectator) return;
            if (!this.occupancy.HasPlayerOverlap(ply)) return;
            const point = this.Select(ply);
            // An exhausted map must not move players from one overlap to another.
            if (!point || !this.occupancy.IsFree(ply, point)) return;
            const pos = point.GetPos();
            ply.SetPos(Vector(pos.x, pos.y, pos.z + 1));
        });
    }

    Select(ply: ZPServerPlayer, transition?: boolean): GLuaEntity | undefined {
        if (transition) return;
        this.occupancy.BeginSelection();

        const teamID = this.gamemode.TeamBased ? ply.Team() : 0;
        // FirstSpawn is changed by PlayerSpawn; its value must not decide
        // whether an engine spawn participates in allocation.
        if (ply.Team() === TEAM_SPECTATOR || ply.ZPVoluntarySpectator)
            return this.FindPoints(teamID)[0];
        const current = this.occupancy.Current(ply);
        if (current) return current;

        let queue = this.ValidPoints(this.queues[teamID] ?? []);
        if (queue.length === 0) queue = this.Refill(teamID);
        this.queues[teamID] = queue;
        const suitable = (point: GLuaEntity): boolean => {
            // Never request bMakeSuitable: the base implementation kills blockers.
            return this.occupancy.IsFree(ply, point) && !!hook.Call("IsSpawnpointSuitable", this.gamemode, ply, point, false);
        };
        let point = queue.find(candidate => suitable(candidate));
        if (!point) {
            const all = this.FindPoints(teamID);
            // A rejected pending point must not reset consumption or forget
            // reservations. Try free alternatives before the unavoidable fallback.
            point = all.find(candidate => suitable(candidate)) ?? queue.find(candidate => this.occupancy.IsFree(ply, candidate)) ??
                all.find(candidate => this.occupancy.IsFree(ply, candidate)) ??
                queue.find(candidate => !this.occupancy.IsReserved(ply, candidate)) ??
                all.find(candidate => !this.occupancy.IsReserved(ply, candidate)) ?? queue[0] ?? all[0];
        }
        if (!point) return;
        const selected = point;
        this.queues[teamID] = queue.filter(candidate => !sameSpawnLocation(candidate, selected));
        return this.occupancy.Reserve(ply, selected);
    }

    private Refill(teamID: number): GLuaEntity[] {
        const queue = this.FindPoints(teamID);
        for (let index = queue.length - 1; index > 0; index--) {
            const other = math.random(0, index), point = queue[index], swap = queue[other];
            if (point && swap) {
                queue[index] = swap;
                queue[other] = point;
            }
        }
        this.queues[teamID] = queue;
        return queue;
    }

    private FindPoints(teamID: number): GLuaEntity[] {
        if (this.gamemode.TeamBased) {
            const configured = this.ValidPoints(team.GetSpawnPoints(teamID) ?? []);
            if (configured.length > 0) return configured;
        }

        // Match the base gamemode's map families, including addon registrations.
        const classes: Record<string, boolean> = {
            info_player_start: true, info_player_combine: true, info_player_rebel: true,
            gmod_player_start: true, info_player_teamspawn: true,
            info_player_counterterrorist: true, info_player_terrorist: true,
        };
        for (const name of scripted_ents.GetMember("gmod_player_start", "SpawnPointClasses") ?? []) {
            // The base gamemode also excludes this marker (it can be outside the map).
            if (name !== "info_survivor_position") classes[name] = true;
        }
        const points: GLuaEntity[] = [];
        for (const name of Object.keys(classes))
            for (const point of ents.FindByClass(name)) points.push(point);
        return this.ValidPoints(points);
    }

    private ValidPoints(points: readonly GLuaEntity[]): GLuaEntity[] {
        const valid: GLuaEntity[] = [];
        for (const point of points)
            if (IsValid(point) && point.IsInWorld() && !valid.some(existing => sameSpawnLocation(existing, point))) valid.push(point);
        return valid;
    }
}

const spawns = new ServerPlayerSpawnQueue(GM);
GM.PlayerSelectSpawn = function (ply, transition) { return spawns.Select(ply, transition); };
hook.Add("PostCleanupMap", "ZPResetPlayerSpawnQueue", () => spawns.Reset());
hook.Add("PlayerSpawn", "ZPCheckPlayerSpawnPosition", (ply, transition) => spawns.CheckSpawn(ply, transition));
