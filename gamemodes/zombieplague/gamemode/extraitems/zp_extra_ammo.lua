-- Generated from src/gamemodes/zombieplague/gamemode/extraitems/server/zp_extra_ammo.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.default = __TS__New(
    ExtraItemDefinition,
    {
        ID = "ZPExtraAmmo",
        Name = "ExtraItemExtraAmmoName",
        Price = 3,
        OnBuy = function(self, ply)
            for ____, Weap in ipairs(ply:GetWeapons()) do
                if WeaponManager:IsChoosableWeapon(Weap:GetClass()) then
                    if Weap:GetMaxClip1() ~= nil then
                        ply:GiveAmmo(
                            Weap:GetMaxClip1() * 15,
                            Weap:GetPrimaryAmmoType(),
                            true
                        )
                    else
                        ply:GiveAmmo(
                            Weap:GetMaxClip2() * 15,
                            Weap:GetSecondaryAmmoType(),
                            true
                        )
                    end
                end
            end
        end,
        CanBuy = function(self, ply)
            return ply:Alive() and cvars.Number("zp_clip_mode", 0) == WMODE_NONE
        end
    }
)
return ____exports
