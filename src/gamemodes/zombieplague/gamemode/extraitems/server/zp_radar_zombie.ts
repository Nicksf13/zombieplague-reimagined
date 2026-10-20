const { createItem } = include("zombieplague/gamemode/sv_radar_item.lua") as typeof import("../../radar/server/sv_radar_item");
export default createItem(ITEM_ZOMBIE);
