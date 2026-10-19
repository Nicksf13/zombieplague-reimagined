// Renderers receive detached display data. Only the controller reads Player/Weapon.
export class PlayerHUDRenderer implements ZPPlayerHUDRenderer {
    private Text(text: string | number, font: string, x: number, y: number, color: GLuaColor): void {
        draw.DrawText(tostring(text), font, x, y, color, TEXT_ALIGN_LEFT);
    }

    private Value(state: ZPPlayerHUDState, id: string): ZPPlayerHUDEntry | undefined {
        return state.Entries.find(entry => entry.ID === id);
    }

    private Ammo(channel: ZPPlayerHUDAmmoChannel | undefined): string {
        if (!channel)
            return "--";
        return channel.Clip < 0 ? tostring(channel.Reserve) : channel.Clip + " / " + channel.Reserve;
    }

    private Card(label: string, value: string | number, x: number, y: number, width: number,
        palette: ZPThemePalette, style: "classic" | "hl2" | "cs16"): void {
        if (style === "classic") {
            draw.RoundedBox(5, x, y, width, 64, palette.Surface);
            draw.RoundedBox(0, x, y, width, 2, palette.Accent);
        }
        else if (style === "hl2")
            draw.RoundedBox(8, x, y, width, 64, palette.Surface);
        else
            draw.RoundedBox(0, x, y, width, 64, palette.Surface);
        this.Text(label, "DermaDefault", x + 10, y + 7, style === "classic" ? palette.Muted : palette.Accent);
        this.Text(value, "DermaLarge", x + 10, y + 26, palette.Accent);
    }

    private Details(state: ZPPlayerHUDState, palette: ZPThemePalette, y: number, margin: number): void {
        // Oxygen and sprinting share breath; the segmented stamina card owns its display.
        const entries = state.Entries.filter(entry => entry.ID !== "HUDHealth" && entry.ID !== "HUDArmor" && entry.ID !== "HUDAP" && entry.ID !== "HUDOxygenLevel");
        // Wrap by measured words so addon text and translated class names remain readable.
        const maxWidth = Math.min(520, state.Width - (state.Width < 900 ? 172 : 206) - margin * 2 - 32);
        const lines: string[] = [];
        surface.SetFont("DermaDefault");
        for (const entry of entries) {
            let line = "";
            for (const word of (entry.Label + ": " + entry.Value).split(" ")) {
                const candidate = line.length > 0 ? line + " " + word : word;
                const [width] = surface.GetTextSize(candidate);
                if (width > maxWidth && line.length > 0) {
                    lines.push(line);
                    line = word;
                }
                else
                    line = candidate;
            }
            lines.push(line);
        }
        const visible = lines.slice(-Math.max(1, Math.floor((y - 90) / 20)));
        visible.forEach((line, index) => {
            const lineY = y - (visible.length - index) * 20;
            const [width] = surface.GetTextSize(line);
            draw.RoundedBox(2, margin, lineY, Math.min(width + 16, maxWidth + 16), 19, palette.Surface);
            this.Text(line, "DermaDefault", margin + 8, lineY + 2, palette.Text);
        });
    }

    private Stamina(fraction: number, x: number, y: number, width: number,
        palette: ZPThemePalette, style: "classic" | "hl2" | "cs16"): void {
        const radius = style === "cs16" ? 0 : style === "hl2" ? 8 : 5;
        draw.RoundedBox(radius, x, y, width, 64, palette.Surface);
        if (style === "classic")
            draw.RoundedBox(0, x, y, width, 2, palette.Accent);
        this.Text(language.GetPhrase("zombieplague.hudstamina"), "DermaDefault", x + 10, y + 7,
            style === "classic" ? palette.Muted : palette.Accent);
        const segmentWidth = (width - 20 - 9 * 3) / 10;
        const filled = Math.ceil(Math.max(0, Math.min(1, fraction)) * 10);
        const inactive = Color(palette.Muted.r, palette.Muted.g, palette.Muted.b, 45);
        for (let index = 0; index < 10; index++)
            draw.RoundedBox(0, x + 10 + index * (segmentWidth + 3), y + 34, segmentWidth, 16,
                index < filled ? palette.Accent : inactive);
    }

    private Paint(state: ZPPlayerHUDState, palette: ZPThemePalette, style: "classic" | "hl2" | "cs16"): void {
        const margin = state.Width < 800 ? 12 : 24;
        const y = state.Height - margin - 64;
        const compact = state.Width < 900;
        const cell = compact ? 104 : 132;
        const timerWidth = 108, timerX = (state.Width - timerWidth) / 2;
        const health = this.Value(state, "HUDHealth"), armor = this.Value(state, "HUDArmor"), packs = this.Value(state, "HUDAP");
        if (health)
            this.Card(health.Label, health.Value, margin, y, cell, palette, style);
        if (armor)
            this.Card(armor.Label, armor.Value, margin + cell + 8, y, cell, palette, style);
        if (packs) {
            // Reserve the stamina slot so ammo packs stay still when the bar hides.
            const top = compact || margin + (cell + 8) * 4 > timerX;
            const packsX = top ? state.Width - margin - cell : margin + (cell + 8) * 2;
            const packsY = top ? margin : y;
            this.Card(packs.Label, packs.Value, packsX, packsY, cell, palette, style);
            if (state.Stamina !== undefined)
                this.Stamina(state.Stamina, packsX + (top ? -1 : 1) * (cell + 8), packsY, cell, palette, style);
        }
        this.Card(language.GetPhrase("zombieplague.hudtimer"), state.Timer, timerX, y, timerWidth, palette, style);
        if (state.Ammo) {
            const width = compact ? 172 : 206, x = state.Width - margin - width;
            if (state.Ammo.Primary)
                this.Card(language.GetPhrase("zombieplague.hudprimaryammo"), this.Ammo(state.Ammo.Primary), x, y, width, palette, style);
            if (state.Ammo.Secondary)
                this.Card(language.GetPhrase("zombieplague.hudsecondaryammo"), this.Ammo(state.Ammo.Secondary), x, y - 72, width, palette, style);
        }
        this.Details(state, palette, y - 8, margin);
    }

    PaintClassic(state: ZPPlayerHUDState, palette: ZPThemePalette): void { this.Paint(state, palette, "classic"); }
    PaintHL2(state: ZPPlayerHUDState, palette: ZPThemePalette): void { this.Paint(state, palette, "hl2"); }
    PaintCS16(state: ZPPlayerHUDState, palette: ZPThemePalette): void { this.Paint(state, palette, "cs16"); }
}
_G.ZPPlayerHUDRenderer = new PlayerHUDRenderer();
