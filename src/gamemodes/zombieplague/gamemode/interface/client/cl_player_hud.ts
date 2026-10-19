export class PlayerHUDController implements ZPPlayerHUDController {
    private staminaSubject: ZPClientPlayer | undefined;
    private staminaVisible = false;
    private staminaFullSince: number | undefined;

    private Stamina(subject: ZPClientPlayer | undefined): number | undefined {
        if (subject !== this.staminaSubject) {
            this.staminaSubject = subject;
            this.staminaVisible = false;
            this.staminaFullSince = undefined;
        }
        if (!subject)
            return;
        const max = subject.GetMaxBreath();
        const fraction = max > 0 ? Math.max(0, Math.min(1, subject.GetBreath() / max)) : 0;
        if (fraction < 1) {
            this.staminaVisible = true;
            this.staminaFullSince = undefined;
        }
        else if (this.staminaVisible) {
            // Start the grace period on full recovery, not on the last drain update.
            this.staminaFullSince ??= CurTime();
            if (CurTime() - this.staminaFullSince >= 3)
                this.staminaVisible = false;
        }
        return this.staminaVisible ? fraction : undefined;
    }

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
        const fraction = this.Stamina(subject);
        const stamina = fraction === undefined ? {} : { Stamina: fraction };
        return ammo ? { ...state, ...stamina, Ammo: ammo } : { ...state, ...stamina };
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
