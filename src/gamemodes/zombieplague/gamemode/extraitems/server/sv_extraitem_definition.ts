export class ExtraItemDefinition implements ZPRegisteredExtraItem {
    ID: string;
    Name: string;
    Price: number;
    OnBuy: ZPRegisteredExtraItem["OnBuy"];
    Type?: 0 | 1;
    Order: number = 100;
    BuySounds?: string[];
    RemoveFunction?: (this: void) => void;

    constructor(options: ZPExtraItemOptions) {
        this.ID = options.ID;
        this.Name = options.Name;
        this.Price = options.Price;
        this.OnBuy = options.OnBuy;
        Object.assign(this, options);
    }

    CanBuy(ply: ZPServerPlayer): boolean { return ply.Alive(); }
    ShouldBeEnabled(): boolean { return true; }
}
_G.ExtraItemDefinition = ExtraItemDefinition;
