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
if (BOT_MODE) {
    commands.AddCommand("bot", "Add a bot to the server", () => {
        RunConsoleCommand("bot");
        timer.Create("bot", 1, 1, () => {
            const manager = RoundManager as ZPServerRoundManager;
            const participants = manager.GetPlayersToPlay();
            for (const bot of player.GetBots()) {
                if (!participants.includes(bot))
                    manager.AddPlayerToPlay(bot);
            }
        });
    }, "", true, (ply) => ply.IsSuperAdmin());
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
