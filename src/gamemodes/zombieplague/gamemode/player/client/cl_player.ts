export {};
const PLAYER = FindMetaTable("Player") as ZPClientPlayer;
PLAYER.SetAmmoPacks = function (this: ZPClientPlayer, value): void { this.AmmoPacks = value; };
PLAYER.GetAmmoPacks = function (this: ZPClientPlayer) { return this.AmmoPacks ?? 0; };
PLAYER.SetBattery = function (this: ZPClientPlayer, value): void { this.Battery = value; };
PLAYER.GetBattery = function (this: ZPClientPlayer) { return this.Battery ?? this.GetMaxBatteryCharge(); };
PLAYER.SetMaxBatteryCharge = function (this: ZPClientPlayer, value): void { this.MaxCharge = value; };
PLAYER.GetMaxBatteryCharge = function (this: ZPClientPlayer) { return this.MaxCharge ?? 100; };
PLAYER.SetZombieClass = function (this: ZPClientPlayer, value): void { this.ZombieClass = value; };
PLAYER.GetZombieClass = function (this: ZPClientPlayer) { return this.ZombieClass ?? ""; };
PLAYER.SetHumanClass = function (this: ZPClientPlayer, value): void { this.HumanClass = value; };
PLAYER.GetHumanClass = function (this: ZPClientPlayer) { return this.HumanClass ?? ""; };
PLAYER.SetNemesis = function (this: ZPClientPlayer, value): void { this.Nemesis = value; };
PLAYER.IsNemesis = function (this: ZPClientPlayer) { return this.Nemesis; };
PLAYER.SetSurvivor = function (this: ZPClientPlayer, value): void { this.Survivor = value; };
PLAYER.IsSurvivor = function (this: ZPClientPlayer) { return this.Survivor; };
PLAYER.SetFootstep = function (this: ZPClientPlayer, value): void { if (value === undefined)
    delete this.Footstep;
else
    this.Footstep = value; };
PLAYER.GetFootstep = function (this: ZPClientPlayer) { return this.Footstep; };
PLAYER.SetAbilityPower = function (this: ZPClientPlayer, value): void { this.AbilityPower = value; };
PLAYER.GetAbilityPower = function (this: ZPClientPlayer) { return this.AbilityPower ?? -1; };
PLAYER.SetMaxAbilityPower = function (this: ZPClientPlayer, value): void { this.MaxAbilityPower = value; };
PLAYER.GetMaxAbilityPower = function (this: ZPClientPlayer) { return this.MaxAbilityPower ?? -1; };
PLAYER.SetBreath = function (this: ZPClientPlayer, value): void { this.Breath = value; };
PLAYER.GetBreath = function (this: ZPClientPlayer) { return this.Breath ?? 100; };
PLAYER.SetMaxBreath = function (this: ZPClientPlayer, value): void { this.MaxBreath = value; };
PLAYER.GetMaxBreath = function (this: ZPClientPlayer) { return this.MaxBreath ?? 100; };
PLAYER.SetPoints = function (this: ZPClientPlayer, value): void { this.Points = value; };
PLAYER.GetPoints = function (this: ZPClientPlayer) { return this.Points ?? 0; };
PLAYER.SetLight = function (this: ZPClientPlayer, value): void { if (value === undefined)
    delete this.Light;
else
    this.Light = value; };
PLAYER.GetLight = function (this: ZPClientPlayer) { return this.Light; };
PLAYER.SetScreenFilter = function (this: ZPClientPlayer, value): void { if (value === undefined)
    delete this.ScreenFilter;
else
    this.ScreenFilter = value; };
PLAYER.GetScreenFilter = function (this: ZPClientPlayer) { return this.ScreenFilter; };
PLAYER.GetZPClass = function (this: ZPClientPlayer): string {
    if (this.IsNemesis())
        return language.GetPhrase("zombieplague.nemesis");
    if (this.IsSurvivor())
        return language.GetPhrase("zombieplague.survivor");
    if (this.IsZombie())
        return language.GetPhrase("zombieplague." + string.lower(this.GetZombieClass()));
    if (this.IsHuman())
        return language.GetPhrase("zombieplague." + string.lower(this.GetHumanClass()));
    return "";
};
let nightvision = false;
_G.SetNightvision = (value) => { nightvision = value; };
_G.IsNightvisionOn = () => nightvision;
PLAYER.GetNightvisionColor = function (this: ZPClientPlayer): GLuaColor {
    return this.IsNemesis() ? Color(255, 0, 0) : this.IsSurvivor() ? Color(0, 0, 255) : NIGHTVISION_COLOR;
};
for (const [event, talking] of [["PlayerStartVoice", true], ["PlayerEndVoice", false]] as const) {
    hook.Add(event, "ZPStartTalking", (ply) => {
        if (ply === LocalPlayer()) {
            net.Start("SendVoice");
            net.WriteBool(talking);
            net.SendToServer();
        }
    });
}
net.Receive("SendNightvision", () => SetNightvision(net.ReadBool()));
net.Receive("SendAmmoPacks", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetAmmoPacks(net.ReadInt(32));
});
net.Receive("SendBatteryCharge", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetBattery(net.ReadFloat());
});
net.Receive("SendMaxBatteryCharge", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetMaxBatteryCharge(net.ReadFloat());
});
net.Receive("SendZombieClass", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetZombieClass(net.ReadString());
});
net.Receive("SendHumanClass", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetHumanClass(net.ReadString());
});
net.Receive("SendNemesis", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetNemesis(net.ReadBool());
});
net.Receive("SendSurvivor", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetSurvivor(net.ReadBool());
});
net.Receive("SendFoostep", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetFootstep(net.ReadBool());
});
net.Receive("SendAbilityPower", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetAbilityPower(net.ReadInt(16));
});
net.Receive("SendMaxAbilityPower", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetMaxAbilityPower(net.ReadInt(16));
});
net.Receive("SendBreath", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetBreath(net.ReadFloat());
});
net.Receive("SendMaxBreath", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetMaxBreath(net.ReadFloat());
});
net.Receive("SendPoints", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetPoints(net.ReadInt(32));
});
net.Receive("SendLight", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetLight(net.ReadBool() ? net.ReadColor() : undefined);
});
net.Receive("SendScreenFilter", () => {
    const ply = PlayerManager.DiscoverPlayerByTextID(net.ReadString()) as ZPClientPlayer | undefined;
    if (ply && IsValid(ply))
        ply.SetScreenFilter(net.ReadBool() ? net.ReadColor() : undefined);
});
