export {};
const PLAYER = FindMetaTable("Player") as ZPServerPlayer;
PLAYER.SetFootstep = function (this: ZPServerPlayer, Footstep: boolean): void {
    this.Footstep = Footstep;
    net.Start("SendFoostep");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteBool(Footstep);
    net.Broadcast();
};
PLAYER.GetFootstep = function (this: ZPServerPlayer): boolean | undefined {
    return this.Footstep;
};
PLAYER.SetTalking = function (this: ZPServerPlayer, Talking: boolean): void {
    this.Talking = Talking;
};
PLAYER.IsTalking = function (this: ZPServerPlayer): boolean {
    return (this.Talking ?? false);
};
PLAYER.SetLastMove = function (this: ZPServerPlayer, LastMove: number): void {
    this.LastMove = LastMove;
};
PLAYER.GetLastMove = function (this: ZPServerPlayer): number {
    return (this.LastMove ?? (CurTime() + 1));
};
PLAYER.MoveSpectateID = function (this: ZPServerPlayer, Move: number, Players: ZPServerPlayer[]): void {
    if (Players.length === 0)
        return;
    this.SpectateID = (((this.GetSpectateID() + Move) + Players.length) % Players.length);
    const target = Players[this.GetSpectateID()];
    if (!target)
        return;
    this.SpectateEntity(target);
    this.SetupHands(target);
};
PLAYER.GetSpectateID = function (this: ZPServerPlayer): number {
    return (this.SpectateID ?? 1);
};
PLAYER.SetAuxGravity = function (this: ZPServerPlayer, AuxGravity: number): void {
    this.AuxGravity = AuxGravity;
};
PLAYER.GetAuxGravity = function (this: ZPServerPlayer): number {
    return (this.AuxGravity ?? 1);
};
PLAYER.SetNemesis = function (this: ZPServerPlayer, Nemesis: boolean): void {
    this.Nemesis = Nemesis;
    net.Start("SendNemesis");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteBool(Nemesis);
    net.Broadcast();
};
PLAYER.IsNemesis = function (this: ZPServerPlayer): boolean | undefined {
    return this.Nemesis;
};
PLAYER.SetSurvivor = function (this: ZPServerPlayer, Survivor: boolean): void {
    this.Survivor = Survivor;
    net.Start("SendSurvivor");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteBool(Survivor);
    net.Broadcast();
};
PLAYER.IsSurvivor = function (this: ZPServerPlayer): boolean | undefined {
    return this.Survivor;
};
PLAYER.IsHuman = function (this: ZPServerPlayer): boolean {
    return (this.Team() === TEAM_HUMANS);
};
PLAYER.IsZombie = function (this: ZPServerPlayer): boolean {
    return (this.Team() === TEAM_ZOMBIES);
};
PLAYER.ZPEmitSound = function (this: ZPServerPlayer, SoundPath: string | undefined, DelayTime: number, Force?: boolean): void {
    if (SoundPath) {
        if ((this.ZPCanEmitSound() || Force)) {
            this.ZPEmit = (CurTime() + DelayTime);
            this.EmitSound(SoundPath);
        }
    }
};
PLAYER.ZPCanEmitSound = function (this: ZPServerPlayer): boolean {
    return (CurTime() > (this.ZPEmit ?? 0));
};
PLAYER.SetLight = function (this: ZPServerPlayer, Light: GLuaColor | undefined): void {
    net.Start("SendLight");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteBool((!(!Light)));
    if (Light) {
        net.WriteColor(Light);
    }
    net.Broadcast();
    this.Light = Light;
};
PLAYER.GetLight = function (this: ZPServerPlayer): GLuaColor | undefined {
    return this.Light;
};
PLAYER.SetScreenFilter = function (this: ZPServerPlayer, ScreenFilter: GLuaColor | undefined): void {
    net.Start("SendScreenFilter");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteBool((!(!ScreenFilter)));
    if (ScreenFilter) {
        net.WriteColor(ScreenFilter);
    }
    net.Broadcast();
    this.ScreenFilter = ScreenFilter;
};
PLAYER.AddPoints = function (this: ZPServerPlayer, PointsToAdd: number): void {
    this.SetPoints((this.GetPoints() + PointsToAdd));
};
PLAYER.RemovePoints = function (this: ZPServerPlayer, PointsToRemove: number): void {
    this.SetPoints((this.GetPoints() - PointsToRemove));
};
PLAYER.SetPoints = function (this: ZPServerPlayer, Points: number): void {
    net.Start("SendPoints");
    net.WriteString(PlayerManager.GetPlayerID(this));
    net.WriteInt(Points, 32);
    net.Broadcast();
    this.Points = Points;
};
PLAYER.GetPoints = function (this: ZPServerPlayer): number {
    return (this.Points ?? 0);
};
