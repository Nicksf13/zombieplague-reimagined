-- Generated from src/gamemodes/zombieplague/gamemode/weapons/shared/sweps/zp_infection_grenade_thrower.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
AddCSLuaFile()
AddCSLuaFile("zombieplague/gamemode/weapon_grenade.lua")
SWEP.PrintName = "Infection Grenade"
SWEP.Author = "The Fire Fuchs"
SWEP.Instructions = "Infects an enemy"
SWEP.Base = "weapon_base"
SWEP.Spawnable = true
SWEP.AdminOnly = true
SWEP.UseHands = true
SWEP.DrawAmmo = true
SWEP.DrawCrosshair = true
SWEP.Primary.ClipSize = 1
SWEP.Primary.DefaultClip = 1
SWEP.Primary.Automatic = false
SWEP.Primary.Ammo = "GrenadeHL1"
SWEP.Secondary.ClipSize = -1
SWEP.Secondary.DefaultClip = -1
SWEP.Secondary.Automatic = false
SWEP.Secondary.Ammo = "none"
SWEP.Weight = 5
SWEP.AutoSwitchTo = false
SWEP.AutoSwitchFrom = false
SWEP.Slot = 5
SWEP.SlotPos = 5
SWEP.ViewModel = "models/weapons/c_bugbait.mdl"
SWEP.WorldModel = "models/weapons/w_bugbait.mdl"
SWEP.AlternateSounds = {"weapons/bugbait/bugbait_squeeze1.wav", "weapons/bugbait/bugbait_squeeze2.wav", "weapons/bugbait/bugbait_squeeze3.wav"}
include("zombieplague/gamemode/weapon_grenade.lua")
return ____exports
