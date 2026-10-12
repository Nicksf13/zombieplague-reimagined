-- Generated from src/gamemodes/zombieplague/gamemode/weapons/shared/sweps/zp_antidote_grenade_thrower.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
AddCSLuaFile()
SWEP.PrintName = "Antitode Grenade Launcher"
SWEP.Author = "The Fire Fuchs"
SWEP.Instructions = "Cures an enemy"
SWEP.Base = "weapon_base"
SWEP.Spawnable = true
SWEP.AdminOnly = true
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
SWEP.ShootSound = Sound("weapons/crossbow/fire1.wav")
SWEP.AlternateSound = Sound("weapons/pistol/pistol_empty.wav")
SWEP.HoldType = "grenade"
SWEP.ViewModelFOV = 55
SWEP.ViewModelFlip = false
SWEP.ViewModel = "models/weapons/c_grenade.mdl"
SWEP.WorldModel = "models/weapons/w_grenade.mdl"
SWEP.ShowViewModel = true
SWEP.ShowWorldModel = false
SWEP.UseHands = true
SWEP.ViewModelBoneMods = {
    ["ValveBiped.Bip01_R_Finger1"] = {
        scale = Vector(1, 1, 1),
        pos = Vector(0, 0, 0),
        angle = Angle(0.082, 25.221, 0)
    },
    ["ValveBiped.Bip01_R_Finger11"] = {
        scale = Vector(1, 1, 1),
        pos = Vector(0, -0.015, 0),
        angle = Angle(0, 3.606, 0)
    },
    ["ValveBiped.Bip01_R_Finger2"] = {
        scale = Vector(1, 1, 1),
        pos = Vector(0, 0, 0),
        angle = Angle(1.61, 27.894, 0)
    },
    ["ValveBiped.Bip01_R_Finger21"] = {
        scale = Vector(1, 1, 1),
        pos = Vector(0, 0, 0),
        angle = Angle(0, -13.43, 0)
    },
    ["ValveBiped.Grenade_body"] = {
        scale = Vector(0.019, 0.019, 0.019),
        pos = Vector(0, 0, 0),
        angle = Angle(0, 0, 0)
    }
}
SWEP.SCKMaterials = {}
SWEP.IronSightsPos = Vector(0.52, 0, 0.56)
SWEP.IronSightsAng = Vector(0, 0, 0)
SWEP.VElements = {["base+"] = {
    type = "Model",
    model = "models/Items/battery.mdl",
    bone = "ValveBiped.Grenade_body",
    rel = "",
    pos = Vector(0.22, 0.063, 3.268),
    angle = Angle(-3.253, 138.17799, -179.612),
    size = Vector(0.737, 0.864, 0.864),
    color = Color(255, 255, 255, 255),
    surpresslightning = false,
    bonemerge = false,
    highrender = false,
    nocull = false,
    material = "",
    skin = 0,
    bodygroup = {}
}}
SWEP.WElements = {["base+"] = {
    type = "Model",
    model = "models/Items/battery.mdl",
    bone = "ValveBiped.Bip01_R_Hand",
    rel = "",
    pos = Vector(2.688, 2.861, 3.348),
    angle = Angle(-1.168, 126.483, 167.461),
    size = Vector(0.737, 0.864, 0.864),
    color = Color(255, 255, 255, 255),
    surpresslightning = false,
    bonemerge = false,
    highrender = false,
    nocull = false,
    material = "",
    skin = 0,
    bodygroup = {}
}}
for ____, name in ipairs({"weapon_grenade", "weaponconstruction_models", "weaponconstruction_bones", "weaponconstruction_draw"}) do
    AddCSLuaFile(("zombieplague/gamemode/" .. name) .. ".lua")
end
if CLIENT then
    include("zombieplague/gamemode/weaponconstruction_models.lua")
    include("zombieplague/gamemode/weaponconstruction_bones.lua")
    include("zombieplague/gamemode/weaponconstruction_draw.lua")
end
include("zombieplague/gamemode/weapon_grenade.lua")
return ____exports
