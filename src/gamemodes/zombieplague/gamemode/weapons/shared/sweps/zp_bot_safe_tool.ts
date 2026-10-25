export {};
AddCSLuaFile();
SWEP.Base = "weapon_base";
SWEP.PrintName = "#zombieplague.bsafetitle";
SWEP.Instructions = "#zombieplague.bsafetoolhint";
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
SWEP.SlotPos = 7;
for (const ammo of [SWEP.Primary, SWEP.Secondary]) {
    ammo.ClipSize = -1; ammo.DefaultClip = -1; ammo.Automatic = false; ammo.Ammo = "none";
}
SWEP.Initialize = function (): void { this.SetHoldType("revolver"); };
// CreateMove consumes each physical press before engine prediction can replay it.
SWEP.PrimaryAttack = function (): void { this.SetNextPrimaryFire(CurTime() + 0.2); };
SWEP.SecondaryAttack = function (): void { this.SetNextSecondaryFire(CurTime() + 0.2); };
SWEP.Reload = function (): void {};
SWEP.OnDrop = function (): void { if (SERVER) this.Remove(); };
