export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.SetZombieClass = function (this: ZPServerPlayer, ZombieClass: ZPClassDefinition): void {
    this.ZombieClass = ZombieClass;
    net.Start("SendZombieClass");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteString(ZombieClass.Name);
    net.Broadcast();
};
PLAYER.GetZombieClass = function (this: ZPServerPlayer): ZPClassDefinition {
    if (this.ZombieClass)
        return this.ZombieClass;
    const definition = ClassManager.GetZPClass("DefaultZombie", TEAM_ZOMBIES);
    if (!definition)
        throw "No zombie classes registered";
    this.SetZombieClass(definition);
    return definition;
};
PLAYER.SetNextZombieClass = function (this: ZPServerPlayer, NextZombieClass: ZPClassDefinition): void {
    this.NextZombieClass = NextZombieClass;
};
PLAYER.GetNextZombieClass = function (this: ZPServerPlayer): ZPClassDefinition | undefined {
    let NextZombieClass = this.NextZombieClass;
    delete this.NextZombieClass;
    return NextZombieClass;
};
PLAYER.SetHumanClass = function (this: ZPServerPlayer, HumanClass: ZPClassDefinition): void {
    this.HumanClass = HumanClass;
    net.Start("SendHumanClass");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteString(HumanClass.Name);
    net.Broadcast();
};
PLAYER.GetHumanClass = function (this: ZPServerPlayer): ZPClassDefinition {
    if (this.HumanClass)
        return this.HumanClass;
    const definition = ClassManager.GetZPClass("DefaultHuman", TEAM_HUMANS);
    if (!definition)
        throw "No human classes registered";
    this.SetHumanClass(definition);
    return definition;
};
PLAYER.SetNextHumanClass = function (this: ZPServerPlayer, NextHumanClass: ZPClassDefinition): void {
    this.NextHumanClass = NextHumanClass;
};
PLAYER.GetNextHumanClass = function (this: ZPServerPlayer): ZPClassDefinition | undefined {
    let NextHumanClass = this.NextHumanClass;
    delete this.NextHumanClass;
    return NextHumanClass;
};
PLAYER.GetZPClass = function (this: ZPServerPlayer): ZPClassDefinition {
    if (this.IsZombie()) {
        return this.GetZombieClass();
    }
    else {
        return this.GetHumanClass();
    }
};
