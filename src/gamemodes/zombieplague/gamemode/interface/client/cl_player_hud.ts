export class PlayerHUDController implements ZPPlayerHUDController {
    private Subject(): ZPClientPlayer | undefined {
        const viewer = LocalPlayer();
        if (!IsValid(viewer) || viewer.GetObserverMode() === OBS_MODE_ROAMING)
            return;
        const subject = viewer.Alive() ? viewer : viewer.GetObserverTarget();
        if (IsValid(subject) && subject.IsPlayer())
            return subject;
    }

    private Ammo(subject: ZPClientPlayer): ZPPlayerHUDAmmo | undefined {
        const weapon = subject.GetActiveWeapon();
        if (!IsValid(weapon))
            return;
        const primary = weapon.GetPrimaryAmmoType(), secondary = weapon.GetSecondaryAmmoType();
        if (primary < 0 && secondary < 0)
            return;
        const ammo: { Primary?: ZPPlayerHUDAmmoChannel; Secondary?: ZPPlayerHUDAmmoChannel; } = {};
        if (primary >= 0)
            ammo.Primary = { Clip: weapon.Clip1(), Reserve: subject.GetAmmoCount(primary) };
        if (secondary >= 0)
            ammo.Secondary = { Clip: weapon.Clip2(), Reserve: subject.GetAmmoCount(secondary) };
        return ammo;
    }

    GetState(): ZPPlayerHUDState {
        const subject = this.Subject();
        const entries: ZPPlayerHUDEntry[] = [];
        if (subject)
            for (const info of HudManager.HudComponents)
                if (info.ShouldRenderFunction(subject))
                    entries.push({ ID: info.HudComponentID, Label: info.TextFunction(subject), Value: info.InfoFunction(subject) });
        const state = { Width: ScrW(), Height: ScrH(),
            Timer: string.FormattedTime(Math.max(0, math.ceil((RoundManager as ZPClientRoundManager).GetTimer())), "%02i:%02i"),
            Spectating: IsValid(LocalPlayer()) && !LocalPlayer().Alive(), Entries: entries };
        // Clip1/Clip2 on other clients can report capacity rather than current ammo.
        // Keep the engine's spectator ammo HUD until we have an authoritative source.
        const ammo = subject && subject === LocalPlayer() && subject.Alive() ? this.Ammo(subject) : undefined;
        return ammo ? { ...state, Ammo: ammo } : state;
    }

    Paint(): void {
        const subject = this.Subject();
        const filter = subject?.GetScreenFilter();
        if (filter)
            draw.RoundedBox(0, 0, 0, ScrW(), ScrH(), filter);
        const theme = ZPThemes.GetTheme();
        if (theme)
            theme.PaintPlayerHUD(this.GetState(), theme.Palette);
    }

    ShouldHide(name: string): boolean | undefined {
        if (!ZPThemes.GetTheme())
            return;
        if (name === "CHudHealth" || name === "CHudBattery")
            return false;
        const subject = this.Subject();
        if ((name === "CHudAmmo" || name === "CHudSecondaryAmmo") && subject && subject === LocalPlayer() && subject.Alive() && this.Ammo(subject))
            return false;
    }
}
const hud = new PlayerHUDController();
_G.ZPPlayerHUD = hud;
hook.Add("HUDShouldDraw", "HideHUD", name => hud.ShouldHide(name));
hook.Add("HUDPaint", "HUDZombiePlague", () => hud.Paint());
