_G.ITEM_HUMAN = 0;
_G.ITEM_ZOMBIE = 1;
include("sv_extraitem_definition.lua");
function isRegistered(this: void, item: ZPExtraItem): item is ZPRegisteredExtraItem {
    return item.ID !== undefined && item.Name !== undefined && item.Price !== undefined && item.OnBuy !== undefined;
}
export class ExtraItemsManager implements ZPServerExtraItemsManager {
    ZombiesExtraItems: ZPRegisteredExtraItem[] = [];
    HumansExtraItems: ZPRegisteredExtraItem[] = [];
    PostRoundEvents: ((this: void) => void)[] = [];
    Search(): void {
        for (const [, path] of pairs(Utils.RecursiveFileSearch("zombieplague/gamemode/extraitems", ".lua"))) {
            _G.ExtraItem = {
                Order: 100,
                CanBuy(this: ZPExtraItem, ply): boolean { return ply.Alive(); },
                ShouldBeEnabled(this: ZPExtraItem): boolean { return true; },
            };
            const loaded = include(path);
            const exported = typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded;
            const item = exported instanceof ExtraItemDefinition ? exported : ExtraItem;
            if (item.ShouldBeEnabled()) {
                if (isRegistered(item))
                    this.AddExtraItem(item, item.Type);
                else
                    Utils.Print(WARNING_MESSAGE, "Invalid Extra Item: '" + path + "'");
            }
        }
    }
    AddExtraItem(item: ZPRegisteredExtraItem, kind?: 0 | 1): void {
        (kind === ITEM_ZOMBIE ? this.ZombiesExtraItems : this.HumansExtraItems).push(item);
        if (item.BuySounds)
            for (const sound of item.BuySounds)
                resource.AddFile("sound/" + sound);
    }
    GetZombiesExtraItems(): ZPRegisteredExtraItem[] { return this.ZombiesExtraItems; }
    GetHumansExtraItems(): ZPRegisteredExtraItem[] { return this.HumansExtraItems; }
    AddRemoveFunction(callback: (this: void) => void): void { this.PostRoundEvents.push(callback); }
    GetItemById(team: number, id: string): ZPRegisteredExtraItem | undefined {
        const items = team === TEAM_HUMANS ? this.HumansExtraItems : this.ZombiesExtraItems;
        for (const item of items)
            if (item.ID === id)
                return item;
        return undefined;
    }
    BuyItem(ply: ZPServerPlayer, item: ZPRegisteredExtraItem | undefined): ZPExtraItemPurchaseCode {
        let phrase: string;
        let result: ZPExtraItemPurchaseCode;
        if (!item) {
            phrase = "ExtraItemChoose"; result = "invalid_item";
        }
        else if (!item.CanBuy(ply)) {
            phrase = "ExtraItemCantBuy"; result = "restricted";
        }
        else if (ply.GetAmmoPacks() < item.Price) {
            phrase = "ExtraItemEnought"; result = "insufficient";
        }
        else {
            item.OnBuy(ply);
            if (item.RemoveFunction)
                this.PostRoundEvents.push(item.RemoveFunction);
            if (item.BuySounds) {
                const sound = SafeTableRandom(item.BuySounds);
                if (sound !== undefined)
                    SendSound(ply, sound);
            }
            ply.TakeAmmoPacks(item.Price);
            SendPopupMessage(ply, { Phrase: "zombieplague.extraitembought", Arguments: [{ Phrase: "zombieplague." + string.lower(item.Name) }] });
            return "bought";
        }
        SendPopupMessage(ply, { Phrase: "zombieplague." + string.lower(phrase) });
        return result;
    }
}
const extraItemsManager = new ExtraItemsManager();
_G.ExtraItemsManager = extraItemsManager;
// Match the event actually emitted by the round manager; pop callbacks before invoking them.
hook.Add("ZPEndRound", "ZPExtraItemsRemove", () => {
    while (extraItemsManager.PostRoundEvents.length > 0) {
        const remove = extraItemsManager.PostRoundEvents.pop();
        if (remove)
            remove();
    }
});
