include("sv_class_definitions.lua");
export class ClassManager implements ZPServerClassManager {
    ZombieClasses: Record<string, ZPClassDefinition> = {};
    HumanClasses: Record<string, ZPClassDefinition> = {};
    SearchClasses(): void {
        for (const [folder, human] of [["zombies", false], ["humans", true]] as const) {
            for (const [, path] of pairs(Utils.RecursiveFileSearch("zombieplague/gamemode/classes/" + folder, ".lua"))) {
                _G.ZPClass = human ? this.NewHumanClass() : this.NewZombieClass();
                const loaded = include(path);
                const exported = typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded;
                if ((exported instanceof HumanClassDefinition || exported instanceof ZombieClassDefinition) && exported.ShouldBeEnabled())
                    this.AddZPClass(exported.ID, exported, exported.Team);
            }
        }
    }
    GetZombieClasses(): Record<string, ZPClassDefinition> { return this.ZombieClasses; }
    GetHumanClasses(): Record<string, ZPClassDefinition> { return this.HumanClasses; }
    CreateClassAbility(drain: boolean, activate: (this: void, ply: ZPServerPlayer) => void, reset?: ((this: void, ply: ZPServerPlayer) => void), delay?: number): ZPAbility {
        const ability: ZPAbility = {
            DrainOnActivation: drain, Drain: 60, MaxAbilityPower: 60,
            UseAction(this: ZPAbility, ply): void {
                activate(ply);
                if (reset)
                    ply.SetAbilityTimer("ZPClassAbility", delay ?? ability.Drain - 10, () => reset(ply));
            },
            CanUseAbility(this: ZPAbility): boolean { return true; },
        };
        return ability;
    }
    AddZPClass(id: string, definition: ZPClassDefinition, teamID: ZPTeam): void {
        if (teamID === TEAM_HUMANS || teamID === TEAM_ZOMBIES) {
            const registry = teamID === TEAM_HUMANS ? this.HumanClasses : this.ZombieClasses;
            registry[id] = definition;
            resource.AddFile(definition.PModel);
        }
        else
            Utils.Print(WARNING_MESSAGE, "Invalid ZP class: " + id);
    }
    GetZPClass(id: string, teamID: ZPTeam): ZPClassDefinition | undefined {
        const registry = teamID === TEAM_HUMANS ? this.HumanClasses : this.ZombieClasses;
        return registry[id] ?? SafeTableRandom(registry);
    }
    GetHumanClass(id: string): ZPClassDefinition | undefined { return this.GetZPClass(id, TEAM_HUMANS); }
    GetZombieClass(id: string): ZPClassDefinition | undefined { return this.GetZPClass(id, TEAM_ZOMBIES); }
    SetZPClass(ply: ZPServerPlayer, id: string, teamID: ZPTeam): void {
        const definition = this.GetZPClass(id, teamID);
        if (!definition)
            return;
        if (teamID === TEAM_HUMANS)
            ply.SetHumanClass(definition);
        else
            ply.SetZombieClass(definition);
    }
    NewHumanClass(): ZPClassDefinition {
        return { Name: "HumanDefaultClassName", Description: "HumanDefaultClassDescription", MaxHealth: 100,
            Armor: 25, PModel: "models/player/gasmask.mdl", Speed: 230, RunSpeed: 100, CrouchSpeed: 0.4,
            Gravity: 1, Battery: 100, Breath: 100, JumpPower: 200, Footstep: true, DamageAmplifier: 1, Order: 100,
            FallFunction(this: ZPClassDefinition) { return true; }, ShouldBeEnabled(this: ZPClassDefinition) { return true; } };
    }
    NewZombieClass(): ZPClassDefinition {
        return { Name: "ZombieDefaultClassName", Description: "ZombieDefaultClassDescription", MaxHealth: 2000,
            PModel: "models/player/zombie_classic.mdl", Speed: 290, RunSpeed: 100, CrouchSpeed: 0.4,
            Gravity: 0.8, Breath: 100, JumpPower: 200, Footstep: false, DamageAmplifier: 1, Order: 100,
            FallFunction(this: ZPClassDefinition) { return false; }, ShouldBeEnabled(this: ZPClassDefinition) { return true; },
            WeaponGive(this: ZPClassDefinition, ply) { ply.Give(ZOMBIE_KNIFE); } };
    }

}
const classManager = new ClassManager();
_G.ClassManager = classManager;
net.Receive("RequestAbility", (_length, ply) => {
    let phrase: string | undefined;
    if (!ply.Alive() || ply.Team() === TEAM_SPECTATOR)
        phrase = "NoticeIsNotAlive";
    else {
        const ability = ply.GetZPClass().Ability;
        if (!ability)
            phrase = "NoticeNoAbility";
        else if (ply.IsNemesis() || ply.IsSurvivor())
            phrase = "NoticeSpecialClassNotAllowed";
        else if (!ability.CanUseAbility())
            phrase = "NoticeNotAllowed";
        else if (ply.GetAbilityPower() < ability.Drain)
            phrase = "NoticeNotEnoughAbilityPower";
        else {
            if (ability.DrainOnActivation)
                ply.DrainAbilityPower(ability.Drain);
            ability.UseAction(ply);
        }
    }
    if (phrase)
        SendPopupMessage(ply, { Phrase: "zombieplague." + string.lower(phrase) });
});
util.AddNetworkString("RequestAbility");
