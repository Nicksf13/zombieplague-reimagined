import type { BotPopulationConfig } from "./sv_bot_population_config";
import type { BotSpawner } from "./sv_bot_spawner";
interface PopulationContract { Tick(): void; Connect(): void; Disconnect(ply: ZPServerPlayer): void; Snapshot(): ZPBotPopulationSnapshot; }
export class BotPopulation implements PopulationContract {
    private pending = new Set<ZPServerPlayer>();
    private refillAt = 0;
    private busy = false;
    constructor(private manager: ZPBotManager, readonly Config: BotPopulationConfig, private spawner: BotSpawner) {}
    Snapshot(): ZPBotPopulationSnapshot {
        const players = player.GetAll().filter(ply => IsValid(ply)), bots = player.GetBots().filter(ply => IsValid(ply)).length;
        const connecting = player.GetCountConnecting(), limit = Math.max(0, Math.min(64, game.MaxPlayers() - 1));
        return { Revision: this.Config.Revision, Enabled: this.Config.Enabled, Target: Math.min(this.Config.Target, limit), Limit: limit,
            Humans: players.length - bots, Bots: bots, Connecting: connecting, Free: Math.max(0, game.MaxPlayers() - players.length - connecting) };
    }
    private Managed(): ZPServerPlayer[] { return player.GetBots().filter(ply => IsValid(ply) && this.manager.GetStatus(ply) !== undefined); }
    private Ready(): boolean { return BOT_MODE && !cvars.Bool("zp_bot_training", false) && this.Config.Enabled && !game.SinglePlayer() && game.MaxPlayers() > 1; }
    private Target(): number { return Math.min(this.Config.Target === 0 ? 64 : this.Config.Target, Math.max(0, game.MaxPlayers() - 1)); }
    private Remove(candidates: ZPServerPlayer[], count: number): void {
        const removing = candidates.filter(ply => !this.pending.has(ply));
        removing.sort((a, b) => {
            const life = Number(a.Alive()) - Number(b.Alive());
            return life !== 0 ? life : (this.manager.GetStatus(b)?.ID ?? 0) - (this.manager.GetStatus(a)?.ID ?? 0);
        });
        const chosen = removing.slice(0, count);
        for (const bot of chosen) { this.pending.add(bot); this.manager.Reset(bot); }
        if (chosen.length > 0) this.manager.Save();
        for (const bot of chosen) if (IsValid(bot) && bot.IsBot()) bot.Kick();
    }
    Connect(): void {
        if (!this.Ready() || this.busy) return;
        this.refillAt = Math.max(this.refillAt, CurTime() + 2);
        const managed = this.Managed(), pending = managed.filter(ply => this.pending.has(ply)).length;
        // PlayerConnect can precede the native connecting count. Release capacity before the client loads.
        if (player.GetCount() + player.GetCountConnecting() - pending >= this.Target()) this.Remove(managed, 1);
    }
    Disconnect(ply: ZPServerPlayer): void {
        this.pending.delete(ply);
        this.refillAt = Math.max(this.refillAt, CurTime() + 1);
    }
    Tick(): void {
        if (!this.Ready() || this.busy) return;
        this.busy = true;
        const [ok] = pcall(() => {
            const players = player.GetAll(), managed = this.Managed();
            for (const bot of this.pending) if (!IsValid(bot) || !players.includes(bot)) this.pending.delete(bot);
            const alive = managed.filter(ply => !this.pending.has(ply));
            const other = Math.max(0, player.GetCount() - managed.length) + player.GetCountConnecting();
            const wanted = Math.max(0, this.Target() - other);
            if (alive.length > wanted) this.Remove(alive, alive.length - wanted);
            else if (alive.length < wanted && this.pending.size === 0 && CurTime() >= this.refillAt) {
                for (let index = 0; index < Math.min(2, wanted - alive.length); index++) if (!this.spawner.Create()) break;
            }
        });
        this.busy = false;
        if (!ok) { this.refillAt = CurTime() + 5; print("[ZP bots] Population adjustment failed; retrying later."); }
    }
}
