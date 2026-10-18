interface SpawnerContract { Capacity(): number; Create(profile?: ZPBotProfile): ZPServerPlayer | undefined; }
export class BotSpawner implements SpawnerContract {
    private sequence = player.GetBots().length;
    constructor(private manager: ZPBotManager, private reserved: (this: void) => number) {}
    Capacity(): number {
        return game.SinglePlayer() ? 0 : Math.max(0, Math.min(this.manager.Available(), game.MaxPlayers() - player.GetCount() - player.GetCountConnecting() - this.reserved()));
    }
    Create(profile?: ZPBotProfile): ZPServerPlayer | undefined {
        if (this.Capacity() < 1) return;
        const bot = player.CreateNextBot("ZP Bot " + (++this.sequence)); if (!IsValid(bot)) return;
        (RoundManager as ZPServerRoundManager).AddPlayerToPlay(bot);
        this.manager.Attach(bot, profile);
        if (!this.manager.GetStatus(bot)) { bot.Kick(); return; }
        return bot;
    }
}
