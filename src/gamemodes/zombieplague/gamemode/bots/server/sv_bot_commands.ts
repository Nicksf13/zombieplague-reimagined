import type { isProfile as profileValidator } from "./sv_bot_brain";
import type { BotSpawner } from "./sv_bot_spawner";
type Result = "usage" | "singleplayer" | "full" | "created" | "failed" | "navmissing";
const consoleMessages: Record<Result, string> = {
    usage: "Use zp_addaibot [1-16] [aggressive|cooperative|defensive|cautious|random] or /aibot with the same arguments.",
    singleplayer: "Bots require multiplayer. Start a local game with at least 2 player slots.",
    full: "No player slots available.", created: "Added %d adaptive bot(s).",
    failed: "Could not create a bot. Check server player slots.",
    navmissing: "This map has no loaded navigation mesh. Bots can fight visible enemies, but exploration and routing are limited.",
};
function report(ply: ZPServerPlayer, result: Result, count?: number): void {
    const prefix = result === "usage" || result === "created" || result === "navmissing" ? "aibot" : "bot";
    if (IsValid(ply)) SendConsoleMessage(ply, { Phrase: "zombieplague." + prefix + result, Arguments: count === undefined ? [] : [count] });
    else print("[ZP] " + string.format(consoleMessages[result], ...(count === undefined ? [] : [count])));
}
export function register(manager: ZPBotManager, isProfile: typeof profileValidator, spawner: BotSpawner): void {
    const add = (ply: ZPServerPlayer, args: string[]): void => {
        if (IsValid(ply) && !ply.IsSuperAdmin()) { SendPopupMessage(ply, { Phrase: "zombieplague.commandnotaccess" }); return; }
        const count = args[0] === undefined ? 1 : tonumber(args[0]), profile = args[1] ?? "random";
        if (args.length > 2 || count === undefined || count !== count || count < 1 || count > 16 || count % 1 !== 0 ||
            (profile !== "random" && !isProfile(profile))) { report(ply, "usage"); return; }
        if (game.SinglePlayer()) { report(ply, "singleplayer"); return; }
        const available = spawner.Capacity();
        if (available <= 0) { report(ply, "full"); return; }
        if (!navmesh.IsLoaded()) report(ply, "navmissing");
        let created = 0;
        for (let index = 0; index < Math.min(count, available); index++) {
            const bot = spawner.Create(profile === "random" ? undefined : profile);
            if (!bot) { report(ply, "failed"); break; }
            created++;
        }
        if (created > 0) report(ply, "created", created);
    };
    Commands.AddCommand("aibot", "zombieplague.aibotusage", add, "[1-16] [aggressive|cooperative|defensive|cautious|random]", true, ply => ply.IsSuperAdmin());
    concommand.Add("zp_addaibot", (ply, _name, args) => add(ply, args));
}
