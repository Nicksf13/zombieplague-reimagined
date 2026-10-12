_G.HUD_TOP = 1;
_G.HUD_CENTER = 2;
_G.HUD_BOTTOM = 3;
_G.HUD_LEFT = 4;
_G.HUD_RIGHT = 5;
function defaults(this: void, x: number, y: number): ZPHudConfig {
    return { Border: Color(0, 0, 0, 144), Body: Color(72, 72, 72, 144), Text: Color(255, 255, 255),
        Font: "Trebuchet18", XPos: x, YPos: y };
}
function color(this: void, value: unknown): GLuaColor | undefined {
    const entry = ZPClientData.Record(value);
    if (!entry || typeof entry.r !== "number" || typeof entry.g !== "number" || typeof entry.b !== "number" || typeof entry.a !== "number")
        return;
    return Color(entry.r, entry.g, entry.b, entry.a);
}
function config(this: void, value: unknown, fallback: ZPHudConfig): ZPHudConfig {
    const entry = ZPClientData.Record(value);
    if (!entry)
        return fallback;
    return { Border: color(entry.Border) ?? fallback.Border, Body: color(entry.Body) ?? fallback.Body,
        Text: color(entry.Text) ?? fallback.Text, Font: typeof entry.Font === "string" ? entry.Font : fallback.Font,
        XPos: typeof entry.XPos === "number" ? entry.XPos : fallback.XPos, YPos: typeof entry.YPos === "number" ? entry.YPos : fallback.YPos };
}
export class HudManager implements ZPHudManager {
    HUDConfig: Record<ZPHudComponentID, ZPHudConfig> = { Status: defaults(HUD_LEFT, HUD_BOTTOM), Timer: defaults(HUD_CENTER, HUD_BOTTOM) };
    SaveFileName: string = "zombieplague/hudconfig.json";
    HudComponents: ZPHudInfo[] = [];
    CreateHudInfo(id: string, text: (this: void, ply: ZPClientPlayer) => string, info: (this: void, ply: ZPClientPlayer) => string | number, show: (this: void, ply: ZPClientPlayer) => boolean): void {
        this.HudComponents.push({ HudComponentID: id,
            TextFunction(this: ZPHudInfo, ply) { return text(ply); },
            InfoFunction(this: ZPHudInfo, ply) { return info(ply); },
            ShouldRenderFunction(this: ZPHudInfo, ply) { return show(ply); } });
    }
    CreateTextDisplayBox(text: { Text: string; TextFont: string; TextColor: GLuaColor; TextMargin?: number; }, borderSize: number, radius: number, border: GLuaColor, body: GLuaColor, x: number, y: number): void {
        const margin = text.TextMargin ?? 0;
        const [width, height] = this.CalculateTextSize(text.Text, text.TextFont);
        const [posX, posY] = this.CalculatePos(x, y, width, height, 20, 20);
        this.CreateBox(borderSize, radius, border, body, posX, posY, width + margin * 2, height + margin * 2);
        draw.DrawText(text.Text, text.TextFont, posX + margin, posY + margin, text.TextColor, TEXT_ALIGN_LEFT);
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
    CalculatePos(x: number, y: number, width: number, height: number, borderX: number | undefined = 0, borderY: number | undefined = 0): LuaMultiReturn<[number, number]> {
        const posX = x === HUD_CENTER ? ScrW() / 2 - width / 2 : x === HUD_RIGHT ? ScrW() - width - borderX : borderX;
        const posY = y === HUD_CENTER ? ScrH() / 2 - height / 2 : y === HUD_BOTTOM ? ScrH() - height - borderY : borderY;
        return $multi(posX, posY);
    }
    GetConfig<K extends keyof ZPHudConfig>(id: ZPHudComponentID, key: K): ZPHudConfig[K] { return this.HUDConfig[id][key]; }
    GetComponentConfig(id: ZPHudComponentID): ZPHudConfig { return this.HUDConfig[id]; }
    LoadHudInformation(): void {
        const saved = file.Read(this.SaveFileName, "DATA");
        if (saved !== undefined) {
            const data = ZPClientData.Record(util.JSONToTable(saved));
            if (data)
                for (const id of ["Status", "Timer"] as const)
                    this.HUDConfig[id] = config(data[id], this.HUDConfig[id]);
        }
        else
            this.Save();
    }
    Save(): void { file.Write(this.SaveFileName, util.TableToJSON(this.HUDConfig, true)); }
    CreateHudComponentInfo(x: number, y: number): ZPHudConfig { return defaults(x, y); }
}
const hudManager = new HudManager();
_G.HudManager = hudManager;
hudManager.LoadHudInformation();
hudManager.CreateHudInfo("HUDZPSpectatingPlayer", () => language.GetPhrase("zombieplague.hudspectatingplayer"), ply => ply.Name(), () => !LocalPlayer().Alive());
hudManager.CreateHudInfo("HUDZPClass", () => language.GetPhrase("zombieplague.classclass"), ply => ply.GetZPClass(), () => true);
hudManager.CreateHudInfo("HUDHealth", () => language.GetPhrase("zombieplague.classhealth"), ply => ply.Health(), () => true);
hudManager.CreateHudInfo("HUDArmor", () => language.GetPhrase("zombieplague.classarmor"), ply => ply.Armor(), ply => ply.Armor() > 0);
hudManager.CreateHudInfo("HUDOxygenLevel", () => language.GetPhrase("zombieplague.classoxygenlevel"), ply => string.format("%.2f", ply.GetBreath() / ply.GetMaxBreath() * 100) + "%", ply => ply.GetBreath() < ply.GetMaxBreath());
hudManager.CreateHudInfo("HUDBattery", () => language.GetPhrase("zombieplague.classbattery"), ply => string.format("%.2f", ply.GetBattery() / ply.GetMaxBatteryCharge() * 100) + "%", ply => ply.GetBattery() < ply.GetMaxBatteryCharge());
hudManager.CreateHudInfo("HUDAbilityPower", () => language.GetPhrase("zombieplague.classabilitypower"), ply => string.format("%.2f", ply.GetAbilityPower() / ply.GetMaxAbilityPower() * 100) + "%", ply => ply.GetAbilityPower() < ply.GetMaxAbilityPower());
hudManager.CreateHudInfo("HUDAP", () => language.GetPhrase("zombieplague.ap"), ply => ply.GetAmmoPacks(), () => true);
hook.Add("HUDShouldDraw", "HideHUD", name => {
    if (name === "CHudHealth" || name === "CHudBattery")
        return false;
});
hook.Add("HUDPaint", "HUDZombiePlague", () => {
    if (LocalPlayer().GetObserverMode() !== OBS_MODE_ROAMING) {
        const ply = LocalPlayer().Alive() ? LocalPlayer() : LocalPlayer().GetObserverTarget();
        if (IsValid(ply)) {
            const filter = ply.GetScreenFilter();
            if (filter)
                draw.RoundedBox(0, 0, 0, ScrW(), ScrH(), filter);
            const parts: string[] = [];
            for (const info of hudManager.HudComponents)
                if (info.ShouldRenderFunction(ply))
                    parts.push(info.TextFunction(ply) + ": " + info.InfoFunction(ply));
            const status = hudManager.GetComponentConfig("Status");
            hudManager.CreateTextDisplayBox({ Text: parts.join(" - "), TextFont: status.Font, TextColor: status.Text, TextMargin: 6 }, 1, 10, status.Border, status.Body, status.XPos, status.YPos);
        }
    }
    const timerConfig = hudManager.GetComponentConfig("Timer");
    hudManager.CreateTextDisplayBox({ Text: string.FormattedTime(math.ceil((RoundManager as ZPClientRoundManager).GetTimer()), "%02i:%02i"),
        TextFont: timerConfig.Font, TextColor: timerConfig.Text, TextMargin: 6 }, 1, 10, timerConfig.Border, timerConfig.Body, timerConfig.XPos, timerConfig.YPos);
});
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
    if (IsNightvisionOn())
        light(LocalPlayer(), LocalPlayer().GetNightvisionColor(), 750, 1, true);
    for (const entry of player.GetAll()) {
        const ply = entry as ZPClientPlayer, tint = ply.GetLight();
        if (tint)
            light(ply, tint, 250, 0.5, false);
    }
});
