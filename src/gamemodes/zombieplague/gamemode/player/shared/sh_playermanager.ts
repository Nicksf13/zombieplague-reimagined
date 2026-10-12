export class PlayerManager implements ZPSharedPlayerManager {
    GetPlayerID(ply: ZPPlayer): string {
        return ply.SteamID64();
    }
    DiscoverPlayerByTextID(textID: string): ZPPlayer | undefined {
        for (const ply of player.GetAll()) {
            if (this.GetPlayerID(ply) === textID) {
                return ply;
            }
        }
        return undefined;
    }
}
const playerManager = new PlayerManager();
_G.PlayerManager = playerManager;
