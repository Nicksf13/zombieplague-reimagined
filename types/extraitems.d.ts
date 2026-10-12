interface ZPRegisteredExtraItem extends ZPExtraItem {
    ID: string;
    Name: string;
    Price: number;
    OnBuy(this: ZPExtraItem, ply: ZPServerPlayer): void;
}
interface ZPServerExtraItemsManager {
    ZombiesExtraItems: ZPRegisteredExtraItem[];
    HumansExtraItems: ZPRegisteredExtraItem[];
    PostRoundEvents: ((this: void) => void)[];
    AddExtraItem(this: ZPServerExtraItemsManager, item: ZPRegisteredExtraItem, kind?: 0 | 1): void;
    GetZombiesExtraItems(this: ZPServerExtraItemsManager): ZPRegisteredExtraItem[];
    GetHumansExtraItems(this: ZPServerExtraItemsManager): ZPRegisteredExtraItem[];
    AddRemoveFunction(this: ZPServerExtraItemsManager, callback: (this: void) => void): void;
    GetItemById(this: ZPServerExtraItemsManager, team: number, id: string): ZPRegisteredExtraItem | undefined;
    BuyItem(this: ZPServerExtraItemsManager, ply: ZPServerPlayer, item: ZPRegisteredExtraItem | undefined): void;
}
interface ZPServerPlayer { GetAmmoPacks(this: ZPServerPlayer): number; }
interface ZPGlobals {
    ExtraItemsManager: ZPServerExtraItemsManager;
    ExtraItem: ZPExtraItem;
    ITEM_HUMAN: 0;
    ITEM_ZOMBIE: 1;
}
