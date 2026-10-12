abstract class PlayerClassDefinition implements ZPRegisteredPlayerClass {
    ID: string;
    abstract readonly Team: typeof TEAM_HUMANS | typeof TEAM_ZOMBIES;
    abstract Name: string;
    abstract Description: string;
    MaxHealth: number = 100;
    Armor?: number;
    PModel: string = "models/player/gasmask.mdl";
    Speed: number = 230;
    RunSpeed: number = 100;
    CrouchSpeed: number = 0.4;
    Gravity: number = 1;
    Battery?: number;
    Breath: number = 100;
    JumpPower: number = 200;
    Footstep: boolean = true;
    DamageAmplifier: number = 1;
    Order: number = 100;
    Scale?: number;
    Ability?: ZPAbility;
    WeaponGive?: (this: ZPClassDefinition, ply: ZPServerPlayer) => void;
    InfectionFunction?: (this: void, attacker: ZPServerPlayer, infected: ZPServerPlayer) => void;

    constructor(id: string) { this.ID = id; }

    FallFunction(): boolean { return true; }
    ShouldBeEnabled(): boolean { return true; }
}

export class HumanClassDefinition extends PlayerClassDefinition {
    readonly Team: typeof TEAM_HUMANS = TEAM_HUMANS;
    Name: string = "HumanDefaultClassName";
    Description: string = "HumanDefaultClassDescription";
    Armor: number = 25;
    Battery: number = 100;

    constructor(options: ZPPlayerClassOptions) {
        super(options.ID);
        Object.assign(this, options);
    }
}

export class ZombieClassDefinition extends PlayerClassDefinition {
    readonly Team: typeof TEAM_ZOMBIES = TEAM_ZOMBIES;
    Name: string = "ZombieDefaultClassName";
    Description: string = "ZombieDefaultClassDescription";
    MaxHealth: number = 2000;
    PModel: string = "models/player/zombie_classic.mdl";
    Speed: number = 290;
    Gravity: number = 0.8;
    Footstep: boolean = false;

    constructor(options: ZPPlayerClassOptions) {
        super(options.ID);
        Object.assign(this, options);
    }

    override FallFunction(): boolean { return false; }
    override WeaponGive = function (this: ZPClassDefinition, ply: ZPServerPlayer): void { ply.Give(ZOMBIE_KNIFE); };
}
_G.HumanClassDefinition = HumanClassDefinition;
_G.ZombieClassDefinition = ZombieClassDefinition;
