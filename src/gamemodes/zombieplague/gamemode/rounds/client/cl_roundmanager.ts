export {};
const manager = RoundManager as ZPClientRoundManager;
manager.SetTimer = function (this: ZPClientRoundManager, seconds): void { this.Timer = CurTime() + seconds; };
manager.GetTimer = function (this: ZPClientRoundManager): number {
    const remaining = (this.Timer ?? 0) - CurTime();
    return remaining < 0 ? 0 : remaining;
};
net.Receive("SyncTimer", () => manager.SetTimer(net.ReadInt(16)));
net.Receive("SendRoundEnd", () => { hook.Call("ZombiePlagueEndRound", GAMEMODE, net.ReadInt(4)); });
