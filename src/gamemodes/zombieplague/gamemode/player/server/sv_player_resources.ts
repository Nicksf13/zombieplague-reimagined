export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.GiveAmmoPacks = function (this: ZPServerPlayer, Amount: number): void {
    this.SetAmmoPacks((this.GetAmmoPacks() + Amount));
};
PLAYER.TakeAmmoPacks = function (this: ZPServerPlayer, Amount: number): void {
    this.SetAmmoPacks((this.GetAmmoPacks() - Amount));
};
PLAYER.SetAmmoPacks = function (this: ZPServerPlayer, AmmoPacks: number, NotSave?: boolean): void {
    this.AmmoPacks = AmmoPacks;
    net.Start("SendAmmoPacks");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteInt(AmmoPacks, 32);
    net.Broadcast();
    if (((!NotSave) && Bank.ShouldSaveAmmoPacks)) {
        Bank.SetPlayerAmmoPacks(this, AmmoPacks);
    }
};
PLAYER.GetAmmoPacks = function (this: ZPServerPlayer): number {
    return (this.AmmoPacks ?? 0);
};
PLAYER.ChargeBattery = function (this: ZPServerPlayer, Amount: number): void {
    Amount = (this.GetBattery() + Amount);
    if ((Amount > this.GetMaxBatteryCharge())) {
        Amount = this.GetMaxBatteryCharge();
    }
    this.SetBattery(Amount);
    if ((Amount === this.GetMaxBatteryCharge())) {
        hook.Call("PlayerBatteryCharge", GAMEMODE, this);
    }
};
PLAYER.DrainBattery = function (this: ZPServerPlayer, Amount: number): void {
    Amount = (this.GetBattery() - Amount);
    if ((Amount < 0)) {
        Amount = 0;
    }
    this.SetBattery(Amount);
    if ((Amount === 0)) {
        hook.Call("PlayerBatteryOver", GAMEMODE, this);
    }
};
PLAYER.SetBattery = function (this: ZPServerPlayer, Battery: number): void {
    this.Battery = Battery;
    net.Start("SendBatteryCharge");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteFloat(Battery);
    net.Broadcast();
};
PLAYER.GetBattery = function (this: ZPServerPlayer): number {
    return (this.Battery ?? this.GetMaxBatteryCharge());
};
PLAYER.SetMaxBatteryCharge = function (this: ZPServerPlayer, MaxCharge: number): void {
    this.MaxCharge = MaxCharge;
    net.Start("SendMaxBatteryCharge");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteFloat(MaxCharge);
    net.Broadcast();
};
PLAYER.GetMaxBatteryCharge = function (this: ZPServerPlayer): number {
    return (this.MaxCharge ?? 100);
};
PLAYER.AddBreath = function (this: ZPServerPlayer, Breath: number): void {
    this.SetBreath((this.GetBreath() + Breath));
};
PLAYER.TakeBreath = function (this: ZPServerPlayer, Breath: number): void {
    this.SetBreath((this.GetBreath() - Breath));
};
PLAYER.SetBreath = function (this: ZPServerPlayer, Breath: number): void {
    if ((Breath <= 0)) {
        Breath = 0;
        let DmgInfo = DamageInfo();
        DmgInfo.SetDamage(cvars.Number("zp_breath_damage", 5));
        DmgInfo.SetDamageType(DMG_DROWNRECOVER);
        this.TakeDamageInfo(DmgInfo);
    }
    else if ((Breath > this.GetMaxBreath())) {
        Breath = this.GetMaxBreath();
    }
    this.Breath = Breath;
    net.Start("SendBreath");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteFloat(Breath);
    net.Broadcast();
};
PLAYER.GetBreath = function (this: ZPServerPlayer): number {
    return (this.Breath ?? 100);
};
PLAYER.SetMaxBreath = function (this: ZPServerPlayer, MaxBreath: number): void {
    this.MaxBreath = MaxBreath;
    net.Start("SendMaxBreath");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteFloat(MaxBreath);
    net.Broadcast();
};
PLAYER.GetMaxBreath = function (this: ZPServerPlayer): number {
    return (this.MaxBreath ?? 100);
};
PLAYER.SetNightvision = function (this: ZPServerPlayer, Nightvision: boolean, silent: boolean = false): void {
    this.Nightvision = Nightvision;
    if (!silent && this.Alive() && this.IsHuman()) {
        if ((RoundManager as ZPServerRoundManager).IsRealisticMod()) {
            if (Nightvision) {
                this.EmitSound(NIGHTVISION_ON_SOUND, 75, 100, 0.25);
            }
            else if ((!this.NightvisionIsOn())) {
                this.EmitSound(NIGHTVISION_OFF_SOUND, 75, 100, 0.25);
            }
        }
        else {
            if (Nightvision) {
                SendSound(this, NIGHTVISION_ON_SOUND);
            }
            else if ((!this.NightvisionIsOn())) {
                SendSound(this, NIGHTVISION_OFF_SOUND);
            }
        }
    }
    net.Start("SendNightvision");
    net.WriteBool(Nightvision);
    net.Send(this);
};
PLAYER.NightvisionIsOn = function (this: ZPServerPlayer): boolean | undefined {
    return this.Nightvision;
};
