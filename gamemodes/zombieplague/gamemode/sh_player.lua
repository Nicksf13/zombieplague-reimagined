-- Generated from src/gamemodes/zombieplague/gamemode/player/shared/sh_player.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.IsHuman = function(self)
    return self:Team() == TEAM_HUMANS
end
PLAYER.IsZombie = function(self)
    return self:Team() == TEAM_ZOMBIES
end
return ____exports
