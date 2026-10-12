export {};
const PLAYER = FindMetaTable("Player");
PLAYER.IsHuman = function (this: ZPPlayer): boolean {
    return this.Team() === TEAM_HUMANS;
};
PLAYER.IsZombie = function (this: ZPPlayer): boolean {
    return this.Team() === TEAM_ZOMBIES;
};
