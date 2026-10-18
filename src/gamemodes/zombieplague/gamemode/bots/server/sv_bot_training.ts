import type { BotSpawner } from "./sv_bot_spawner";
const { enterSpectator } = include("sv_player_spectator.lua") as typeof import("../../player/server/sv_player_spectator");
interface TrainingContract { Ready(): void; Tick(): void; }

/** Session-only orchestration; persisted population settings and combat memories keep their owners. */
export class BotTraining implements TrainingContract {
    private ready = false;
    private previous = new Map<string, string>();
    private pending = new Set<ZPServerPlayer>();
    private warned = new Set<ZPServerPlayer>();
    constructor(private manager: ZPBotManager, private spawner: BotSpawner, private rounds: ZPServerRoundManager) {}
    Ready(): void { this.ready = true; }
    Tick(): void {
        if (!cvars.Bool("zp_bot_training", false)) {
            for (const [name, value] of this.previous) GetConVar(name)?.SetString(value);
            this.previous.clear(); this.warned.clear();
            return;
        }
        if (!this.ready || !BOT_MODE || game.SinglePlayer()) return;
        const humans = (player.GetAll() as ZPServerPlayer[]).filter(ply => IsValid(ply) && !ply.IsBot());
        if (humans.length === 0) return;
        for (const name of ["zp_bot_ai_enabled", "zp_bot_learning"]) {
            const convar = GetConVar(name);
            if (convar && !this.previous.has(name)) {
                this.previous.set(name, convar.GetString());
                convar.SetString("1");
            }
        }
        for (const ply of humans) {
            if (!ply.ZPVoluntarySpectator || ply.Team() !== TEAM_SPECTATOR || ply.Alive() || this.rounds.GetPlayersToPlay().includes(ply))
                enterSpectator(ply, this.rounds);
        }
        const managed = player.GetBots().filter(ply => IsValid(ply) && this.manager.GetStatus(ply) !== undefined);
        for (const ply of this.pending) if (!managed.includes(ply)) this.pending.delete(ply);
        const active = managed.filter(ply => !this.pending.has(ply));
        const raw = cvars.Number("zp_bot_training_count", 2);
        const requested = raw === raw ? Math.max(2, Math.min(64, Math.floor(raw))) : 2;
        const target = Math.min(requested, active.length + this.spawner.Capacity());
        const excess = active.slice(target);
        for (const bot of excess) { this.pending.add(bot); this.manager.Reset(bot); }
        if (excess.length > 0) this.manager.Save();
        for (const bot of excess) bot.Kick();
        if (this.pending.size > 0) return;
        if (target < requested) {
            for (const ply of humans) if (!this.warned.has(ply)) {
                this.warned.add(ply);
                SendPopupMessage(ply, { Phrase: "zombieplague.botfull" });
            }
        }
        else this.warned.clear();
        // One bot cannot start an infection round; wait for room for an opponent.
        if (target < 2) return;
        const missing = Math.max(0, target - active.length);
        for (let index = 0; index < missing; index++) if (!this.spawner.Create()) break;
    }
}
