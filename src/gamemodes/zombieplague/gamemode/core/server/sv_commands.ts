export class Commands implements ZPCommands {
    CommandList: Record<string, ZPCommand> = {};
    AddCommand(names: string | string[], description: string, action: ZPCommandAction, help?: string, privateCommand?: boolean, permission?: (this: void, ply: ZPServerPlayer) => boolean): void {
        const aliases = typeof names === "string" ? [names] : names;
        for (const name of aliases) {
            if (!this.CommandList[name]) {
                this.CommandList[name] = { Description: description, Function: action, Help: help ?? "",
                    Private: privateCommand, PermissionFunction: permission };
            }
        }
    }
}
const commands = new Commands();
_G.Commands = commands;
commands.AddCommand("commands", "Print the server's commands.", (ply) => {
    SendColorMessage(ply, "Server's command list has been printed!", Color(255, 255, 0));
    let text = "--------------------------Commands--------------------------\n";
    for (const [name, command] of pairs(commands.CommandList)) {
        if (!command.Private || ply.IsSuperAdmin()) {
            text += name + " - Description: " + command.Description + " - Sintax: /" + name + " " + command.Help + "\n";
        }
    }
    SendConsoleMessage(ply, text + "------------------------------------------------------------");
});
type BotResult = "usage" | "singleplayer" | "full" | "created" | "failed";
const botConsoleMessages: Record<BotResult, string> = {
    usage: "Usage: zp_addbot [1-16] or /bot [1-16].",
    singleplayer: "Bots require multiplayer. Start a local game with at least 2 player slots.",
    full: "No player slots available.",
    created: "Added %d idle test bot(s).",
    failed: "Could not create a bot. Check server player slots.",
};
function reportBots(ply: ZPServerPlayer, result: BotResult, count?: number): void {
    const args = count === undefined ? [] : [count];
    if (IsValid(ply))
        SendConsoleMessage(ply, { Phrase: "zombieplague.bot" + result, Arguments: args });
    else
        print("[ZP] " + string.format(botConsoleMessages[result], ...args));
}
function addIdleBots(ply: ZPServerPlayer, args: string[]): void {
    // Invalid caller is the dedicated server console; clients require superadmin.
    if (IsValid(ply) && !ply.IsSuperAdmin()) {
        SendPopupMessage(ply, { Phrase: "zombieplague.commandnotaccess" });
        return;
    }
    const count = args[0] === undefined ? 1 : tonumber(args[0]);
    if (args.length > 1 || count === undefined || count < 1 || count > 16 || count % 1 !== 0) {
        reportBots(ply, "usage");
        return;
    }
    if (game.SinglePlayer()) {
        reportBots(ply, "singleplayer");
        return;
    }
    const available = Math.max(0, game.MaxPlayers() - player.GetCount());
    if (available === 0) {
        reportBots(ply, "full");
        return;
    }
    let created = 0;
    for (let index = 0; index < Math.min(count, available); index++) {
        const bot = player.CreateNextBot("ZP Test Bot " + (player.GetBots().length + 1));
        if (!IsValid(bot)) {
            reportBots(ply, "failed");
            break;
        }
        bot.ZPIdleTestBot = true;
        // Bots have no client Lua to send RequestServerStatus, so join explicitly.
        (RoundManager as ZPServerRoundManager).AddPlayerToPlay(bot);
        created++;
    }
    if (created > 0)
        reportBots(ply, "created", created);
}
if (BOT_MODE) {
    commands.AddCommand("bot", "Add idle test bots to the match", addIdleBots, "[1-16]", true, ply => ply.IsSuperAdmin());
    concommand.Add("zp_addbot", (ply, _command, args) => addIdleBots(ply, args));
    hook.Add("StartCommand", "ZPIdleTestBots", (ply, command) => {
        if (!ply.IsBot() || !ply.ZPIdleTestBot)
            return;
        command.ClearButtons();
        command.ClearMovement();
        command.SetImpulse(0);
    });
}
hook.Add("PlayerSay", "Commands", (ply, text) => {
    const args = string.Explode(" ", string.lower(text));
    const first = args[0] ?? "";
    if (string.sub(first, 1, 1) !== "/" && string.sub(first, 1, 1) !== "!")
        return;
    const command = commands.CommandList[string.sub(first, 2)];
    args.shift();
    if (!command)
        return;
    if (args[0] === "help" || args[0] === "ajuda") {
        SendColorMessage(ply, "Help:\n" + command.Help, Color(255, 255, 0));
    }
    else if (!command.PermissionFunction || command.PermissionFunction(ply)) {
        command.Function(ply, args);
    }
    else
        SendPopupMessage(ply, { Phrase: "zombieplague.commandnotaccess" });
    if (command.Private)
        return "";
});
