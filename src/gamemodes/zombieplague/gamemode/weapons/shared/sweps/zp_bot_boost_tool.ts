export {};
AddCSLuaFile();
SWEP.Base = "weapon_base";
SWEP.PrintName = "#zombieplague.botboosttitle";
SWEP.Instructions = "#zombieplague.botboostcapture";
SWEP.Author = "Zombie Plague";
SWEP.Spawnable = false;
SWEP.AdminOnly = true;
SWEP.ViewModel = "models/weapons/c_toolgun.mdl";
SWEP.WorldModel = "models/weapons/w_toolgun.mdl";
SWEP.UseHands = true;
SWEP.ViewModelFOV = 54;
SWEP.DrawAmmo = false;
SWEP.DrawCrosshair = true;
SWEP.AutoSwitchTo = false;
SWEP.AutoSwitchFrom = false;
SWEP.Slot = 5;
SWEP.SlotPos = 6;
for (const ammo of [SWEP.Primary, SWEP.Secondary]) {
    ammo.ClipSize = -1; ammo.DefaultClip = -1; ammo.Automatic = false; ammo.Ammo = "none";
}
SWEP.Initialize = function (): void { this.SetHoldType("revolver"); };
// Predicted callbacks dispatch once on the owning client. Singleplayer needs an explicit client call.
function action(weapon: ZPScriptedWeapon, method: string, operation: number): void {
    if (SERVER) { if (game.SinglePlayer()) weapon.CallOnClient(method); return; }
    if (IsFirstTimePredicted()) hook.Run("ZPBotBoostToolAction", operation);
}
SWEP.PrimaryAttack = function (): void {
    this.SetNextPrimaryFire(CurTime() + 0.2); action(this, "PrimaryAttack", 0);
};
SWEP.SecondaryAttack = function (): void {
    this.SetNextSecondaryFire(CurTime() + 0.2); action(this, "SecondaryAttack", 1);
};
SWEP.Reload = function (): void { action(this, "Reload", 2); };
SWEP.OnDrop = function (): void { if (SERVER) this.Remove(); };
