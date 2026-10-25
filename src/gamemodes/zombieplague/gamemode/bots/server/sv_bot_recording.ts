const { BotRecordingObstacles } = include("sv_bot_recording_obstacles.lua") as typeof import("./sv_bot_recording_obstacles");
interface RecordingSource { Snapshot(): object[]; ManagedPlayers(): ZPServerPlayer[]; }
interface RecordingContract { SetEnabled(enabled: boolean): void; Tick(): void; Save(): boolean; }
/** Server-only observation. Never consulted by perception, navigation or learning. */
export class BotRecording implements RecordingContract {
    Enabled = false;
    Path = "";
    private frames = new Map<number, { Time: number; JSON: string }>();
    private sequence = 0;
    private bytes = 0;
    private next = 0;
    private dropped = 0;
    private saves = 0;
    private obstacles = new BotRecordingObstacles();
    constructor(private source: RecordingSource, private session: string, private code: string) {}
    SetEnabled(enabled: boolean): void {
        if (enabled && !this.Enabled) { this.frames.clear(); this.bytes = 0; this.dropped = 0; this.next = 0; }
        this.Enabled = enabled;
    }
    Seconds(): number {
        const entries = [...this.frames.values()];
        return entries.length < 2 ? 0 : Math.max(0, entries[entries.length - 1]!.Time - entries[0]!.Time);
    }
    Tick(): void {
        const now = CurTime();
        if (!this.Enabled || now < this.next) return;
        this.next = now + 0.5;
        const players = player.GetAll();
        const json = util.TableToJSON({ Time: now, Round: RoundManager.GetRoundState(),
            PlayersOmitted: Math.max(0, players.length - 128), Players: players.slice(0, 128).filter(ply => IsValid(ply)).map(ply => {
                const p = ply.GetPos(), v = ply.GetVelocity(), a = ply.EyeAngles(), weapon = ply.GetActiveWeapon();
                const [min, max] = ply.GetHull();
                return { Entity: ply.EntIndex(), User: ply.UserID(), Team: ply.Team(), Alive: ply.Alive(), Health: ply.Health(),
                    MaxHealth: ply.GetMaxHealth(), Run: ply.GetRunSpeed(), Jump: ply.GetJumpPower(), Breath: ply.GetBreath(),
                    Water: ply.WaterLevel(), MoveType: ply.GetMoveType(), Hull: [[min.x, min.y, min.z], [max.x, max.y, max.z]],
                    Position: [p.x, p.y, p.z], Velocity: [v.x, v.y, v.z], Aim: [a.p, a.y], Ground: ply.OnGround(),
                    Frozen: ply.IsFrozen(), Weapon: IsValid(weapon) ? weapon.GetClass() : "",
                    Clip: IsValid(weapon) ? weapon.Clip1() : -1, Reach: IsValid(weapon) ? weapon.HitDistance : undefined };
            }), Bots: this.source.Snapshot(), Obstacles: this.obstacles.Capture(this.source.ManagedPlayers()) });
        if (!json || json.length > 262144) { this.dropped++; return; }
        this.frames.set(++this.sequence, { Time: now, JSON: json }); this.bytes += json.length;
        for (const [id, frame] of this.frames) {
            if (this.frames.size <= 600 && this.bytes <= 8388608 && now - frame.Time <= 300) break;
            this.bytes -= frame.JSON.length; this.frames.delete(id); this.dropped++;
        }
    }
    Save(): boolean {
        if (this.frames.size === 0) return false;
        const metadata = util.TableToJSON({ Version: 1, Session: this.session, Code: this.code, Map: game.GetMap(),
            SavedAt: os.time(), SampleInterval: 0.5, DroppedFrames: this.dropped, Enabled: this.Enabled,
            Learning: cvars.Bool("zp_bot_learning", true), Evaluation: cvars.Bool("zp_bot_evaluation", false) });
        if (!metadata) return false;
        const json = metadata.substring(0, metadata.length - 1) + ',"Frames":[' + [...this.frames.values()].map(frame => frame.JSON).join(",") + "]}";
        const directory = "zombieplague/bots/diagnostics";
        const path = directory + "/recording-" + util.SHA256(this.session).substring(0, 12) + "-" + os.time() + "-" + (++this.saves) + ".json";
        file.CreateDir(directory);
        const [ok] = pcall(() => file.Write(path, json));
        if (!ok || file.Read(path, "DATA") !== json) return false;
        this.Path = "data/" + path; return true;
    }
}
