export function createItem(this: void, kind: 0 | 1): ZPRegisteredExtraItem {
    const price = (): number => {
        const value = cvars.Number("zp_radar_price", 10);
        return Number.isFinite(value) ? Math.floor(Math.max(0, Math.min(1000000000, value))) : 10;
    };
    const item = new ExtraItemDefinition({
        ID: "ZPRadar", Name: "ExtraItemRadarName", Type: kind, Price: price(), Order: 60,
        RegisterWhenDisabled: true,
        ShouldBeEnabled() { return ZPRadar.Available(); },
        CanBuy(ply) { return ZPRadar.CanBuy(ply); },
        OnBuy(ply) { ZPRadar.Purchase(ply); },
    });
    cvars.AddChangeCallback("zp_radar_price", () => { item.Price = price(); }, "ZPRadarItem" + kind);
    return item;
}
