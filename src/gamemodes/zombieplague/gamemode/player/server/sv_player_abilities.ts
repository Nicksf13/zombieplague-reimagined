export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.SetAbilityPower = function (this: ZPServerPlayer, AbilityPower: number): void {
    this.AbilityPower = AbilityPower;
    net.Start("SendAbilityPower");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteInt(AbilityPower, 16);
    net.Broadcast();
};
PLAYER.GetAbilityPower = function (this: ZPServerPlayer): number {
    return (this.AbilityPower ?? (-1));
};
PLAYER.DrainAbilityPower = function (this: ZPServerPlayer, Power: number): void {
    let AbilityPower = (this.GetAbilityPower() - Power);
    if ((AbilityPower <= 0)) {
        AbilityPower = 0;
        hook.Call(("PlayerAbilityPowerOver" + this.SteamID64()), GAMEMODE);
    }
    this.SetAbilityPower(AbilityPower);
    this.AddRechargeOnAbilityPower(1);
};
PLAYER.AddRechargeOnAbilityPower = function (this: ZPServerPlayer, Amount: number): void {
    let RechargeAbilityPower = ("RechargeAbilityPower" + this.SteamID64());
    hook.Add("SecondTickManager", RechargeAbilityPower, () => {
        this.AddAbilityPower(Amount);
    });
    let EventName = ("ZPResetAbilityEvent" + this.SteamID64());
    hook.Add(EventName, RechargeAbilityPower, () => {
        hook.Remove("SecondTickManager", RechargeAbilityPower);
        hook.Remove(EventName, RechargeAbilityPower);
    });
};
PLAYER.AddAbilityPower = function (this: ZPServerPlayer, Power: number): void {
    let AbilityPower = (this.GetAbilityPower() + Power);
    if ((AbilityPower >= this.GetMaxAbilityPower())) {
        AbilityPower = this.GetMaxAbilityPower();
        hook.Remove("SecondTickManager", ("RechargeAbilityPower" + this.SteamID64()));
    }
    this.SetAbilityPower(AbilityPower);
};
PLAYER.SetMaxAbilityPower = function (this: ZPServerPlayer, MaxAbilityPower: number): void {
    this.MaxAbilityPower = MaxAbilityPower;
    net.Start("SendMaxAbilityPower");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteInt(MaxAbilityPower, 16);
    net.Broadcast();
};
PLAYER.GetMaxAbilityPower = function (this: ZPServerPlayer): number {
    return (this.MaxAbilityPower ?? (-1));
};
PLAYER.SetAbilityTimer = function (this: ZPServerPlayer, TimerName: string, Seconds: number, TimerAction: (this: void) => void): void {
    let TimerNameWithSteamID64 = (TimerName + this.SteamID64());
    timer.Create(TimerNameWithSteamID64, Seconds, 1, TimerAction);
    let EventName = ("ZPResetAbilityEvent" + this.SteamID64());
    hook.Add(EventName, TimerNameWithSteamID64, () => {
        timer.Destroy(TimerNameWithSteamID64);
        hook.Remove(EventName, TimerNameWithSteamID64);
    });
};
