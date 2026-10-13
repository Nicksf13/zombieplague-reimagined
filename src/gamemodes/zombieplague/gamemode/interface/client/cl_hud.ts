// Public data registry and drawing helpers; layouts belong to themes.
export class HudManager implements ZPHudManager {
    HudComponents: ZPHudInfo[] = [];
    CreateHudInfo(id: string, text: (this: void, ply: ZPClientPlayer) => string, info: (this: void, ply: ZPClientPlayer) => string | number, show: (this: void, ply: ZPClientPlayer) => boolean): void {
        this.HudComponents.push({ HudComponentID: id,
            TextFunction(this: ZPHudInfo, ply) { return text(ply); },
            InfoFunction(this: ZPHudInfo, ply) { return info(ply); },
            ShouldRenderFunction(this: ZPHudInfo, ply) { return show(ply); } });
    }
    CreateBox(borderSize: number, radius: number, border: GLuaColor | undefined, body: GLuaColor, x: number, y: number, width: number, height: number): void {
        if (borderSize > 0 && border && border.a > 0) {
            draw.RoundedBox(radius, x, y, width, height, border);
            width -= borderSize * 2;
            height -= borderSize * 2;
            x += borderSize;
            y += borderSize;
        }
        if (body.a > 0)
            draw.RoundedBox(radius, x, y, width, height, body);
    }
    CalculateTextSize(text: string | number, font: string): LuaMultiReturn<[number, number]> { surface.SetFont(font); return surface.GetTextSize(text); }
}
const hudManager = new HudManager();
_G.HudManager = hudManager;
function percent(this: void, value: number, max: number): string {
    return string.format("%.0f%%", max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0);
}

hudManager.CreateHudInfo("HUDZPSpectatingPlayer", () => language.GetPhrase("zombieplague.hudspectatingplayer"), ply => ply.Name(), () => !LocalPlayer().Alive());
hudManager.CreateHudInfo("HUDZPClass", () => language.GetPhrase("zombieplague.classclass"), ply => ply.GetZPClass(), () => true);
hudManager.CreateHudInfo("HUDHealth", () => language.GetPhrase("zombieplague.classhealth"), ply => ply.Health(), () => true);
hudManager.CreateHudInfo("HUDArmor", () => language.GetPhrase("zombieplague.classarmor"), ply => ply.Armor(), () => true);
hudManager.CreateHudInfo("HUDOxygenLevel", () => language.GetPhrase("zombieplague.classoxygenlevel"), ply => percent(ply.GetBreath(), ply.GetMaxBreath()), ply => ply.GetBreath() < ply.GetMaxBreath());
hudManager.CreateHudInfo("HUDBattery", () => language.GetPhrase("zombieplague.classbattery"), ply => percent(ply.GetBattery(), ply.GetMaxBatteryCharge()), ply => ply.GetBattery() < ply.GetMaxBatteryCharge());
hudManager.CreateHudInfo("HUDAbilityPower", () => language.GetPhrase("zombieplague.classabilitypower"), ply => percent(ply.GetAbilityPower(), ply.GetMaxAbilityPower()), ply => ply.GetAbilityPower() < ply.GetMaxAbilityPower());
hudManager.CreateHudInfo("HUDAP", () => language.GetPhrase("zombieplague.ap"), ply => ply.GetAmmoPacks(), () => true);
function light(this: void, ply: ZPClientPlayer, tint: GLuaColor, size: number, duration: number, shoot: boolean): void {
    const effect = DynamicLight(ply.EntIndex());
    if (!effect)
        return;
    effect.pos = shoot ? ply.GetShootPos() : ply.GetPos();
    effect.r = tint.r;
    effect.g = tint.g;
    effect.b = tint.b;
    effect.brightness = 2;
    effect.Decay = 1000;
    effect.Size = size;
    effect.DieTime = CurTime() + duration;
}
hook.Add("Think", "ZPSpecialLights", () => {
    if (!IsValid(LocalPlayer()))
        return;
    for (const entry of player.GetAll()) {
        const ply = entry as ZPClientPlayer, tint = ply.GetLight();
        if (tint)
            light(ply, tint, 250, 0.5, false);
    }
});
