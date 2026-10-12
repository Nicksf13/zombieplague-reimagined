export class InfectionManager implements ZPInfectionManager {
    Infect(target: ZPServerPlayer, attacker: ZPServerPlayer): void {
        if (cvars.Bool("zp_ap_zombies", false) && target !== attacker) {
            attacker.GiveAmmoPacks(cvars.Number("zp_ap_zombies_total", 1));
        }
        target.Infect();
        const infect = attacker.GetZombieClass().InfectionFunction;
        if (infect)
            infect(attacker, target);
        attacker.AddFrags(1);
        target.AddDeaths(1);
        attacker.AddPoints(cvars.Number("zp_point_points_per_infection", 10));
        if (!RoundManager.IsRealisticMod()) {
            for (const ply of player.GetAll()) {
                const phrase = target !== attacker ? "NoticeInfect" : "NoticeSelfInfect";
                SendPopupMessage(ply, { Phrase: "zombieplague." + string.lower(phrase), Arguments: [target.Name(), attacker.Name()] });
            }
        }
        hook.Call("ZPInfectionEvent", GAMEMODE, target, attacker);
        hook.Call("ZPResetAbilityEvent" + target.SteamID64(), GAMEMODE);
        if (RoundManager.LastHuman())
            hook.Call("ZPLastHumanEvent");
    }
    Cure(target: ZPServerPlayer, attacker: ZPServerPlayer): void {
        target.Cure();
        attacker.AddFrags(1);
        if (!RoundManager.IsRealisticMod()) {
            for (const ply of player.GetAll()) {
                const phrase = target !== attacker ? "NoticeGetCured" : "NoticeAntidote";
                SendPopupMessage(ply, { Phrase: "zombieplague." + string.lower(phrase), Arguments: [target.Name(), attacker.Name()] });
            }
        }
        attacker.AddPoints(cvars.Number("zp_point_points_per_cure", 50));
        hook.Call("ZPCureEvent", GAMEMODE, target, attacker);
        hook.Call("ZPResetAbilityEvent" + target.SteamID64(), GAMEMODE);
        if (RoundManager.LastZombie())
            hook.Call("ZPLastZombieEvent");
    }
}
const infectionManager = new InfectionManager();
_G.InfectionManager = infectionManager;
