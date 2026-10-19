export class EmoteWheelHUD implements ZPEmoteWheelPresentation {
    private panel: GLuaPanel | undefined;
    constructor(private actions: ZPEmoteWheelActions) {}

    Open(): void {
        const panel = vgui.Create("DPanel");
        this.panel = panel;
        panel.SetPos(0, 0);
        panel.SetSize(ScrW(), ScrH());
        panel.Paint = (width, height) => this.Paint(width, height);
        panel.OnMouseWheeled = delta => { this.actions.Page(delta > 0 ? -1 : 1); return true; };
        panel.OnMousePressed = button => this.actions.Click(button);
        panel.OnRemove = () => { this.panel = undefined; this.actions.Cancel(); };
        panel.MakePopup();
        panel.SetKeyboardInputEnabled(false);
        input.SetCursorPos(ScrW() / 2, ScrH() / 2);
    }

    private Radius(width: number, height: number): number {
        return Math.min(260, width * 0.42, height * 0.36, (height - 180) / 2);
    }

    Selection(): number | undefined {
        const panel = this.panel;
        if (!panel || !IsValid(panel)) return undefined;
        const [width, height] = panel.GetSize(), [mouseX, mouseY] = panel.LocalCursorPos();
        const x = mouseX - width / 2, y = mouseY - height / 2, radius = this.Radius(width, height);
        const distance = Math.sqrt(x * x + y * y);
        if (distance < radius * 0.42 || distance > radius) return undefined;
        // Slot zero points up. Half a segment makes the visual center and hit test agree.
        return Math.floor(((math.atan2(y, x) + Math.PI * 2.5 + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));
    }

    private Text(text: string, font: string, x: number, y: number, color: GLuaColor, maxWidth: number): void {
        surface.SetFont(font);
        const lines: string[] = [];
        let line = "";
        for (const word of text.split(" ")) {
            const candidate = line.length > 0 ? line + " " + word : word, [width] = surface.GetTextSize(candidate);
            if (width > maxWidth && line.length > 0) { lines.push(line); line = word; }
            else line = candidate;
        }
        lines.push(line);
        lines.forEach((value, index) => {
            const [width, height] = surface.GetTextSize(value);
            draw.DrawText(value, font, x - width / 2, y + (index - (lines.length - 1) / 2) * height,
                color, TEXT_ALIGN_LEFT);
        });
    }

    private Segment(cx: number, cy: number, radius: number, slot: number, color: GLuaColor, square: boolean): void {
        const middle = -Math.PI / 2 + slot * Math.PI / 4, half = Math.PI / 8 - 0.015;
        const steps = square ? 1 : 10;
        draw.NoTexture();
        surface.SetDrawColor(color.r, color.g, color.b, color.a);
        const point = (angle: number, scale: number): ZPEmoteVertex =>
            ({ x: cx + Math.cos(angle) * radius * scale, y: cy + Math.sin(angle) * radius * scale });
        // Convex strips avoid DrawPoly's inability to render a concave annular sector.
        for (let step = 0; step < steps; step++) {
            const start = middle - half + step * half * 2 / steps, end = start + half * 2 / steps;
            surface.DrawPoly([point(start, 0.42), point(start, 1), point(end, 1), point(end, 0.42)]);
        }
    }

    private Paint(width: number, height: number): void {
        const theme = ZPThemes.GetTheme();
        if (!theme) return;
        const palette = theme.Palette, square = ZPThemes.GetActiveID() === "cs16";
        const cx = width / 2, cy = height / 2, radius = this.Radius(width, height);
        const selected = this.Selection(), state = this.actions.State();
        draw.RoundedBox(0, 0, 0, width, height, Color(palette.Surface.r, palette.Surface.g, palette.Surface.b, 215));
        this.Text(language.GetPhrase("zombieplague.keybindingdance"), "DermaLarge", cx, cy - radius - 58, palette.Text, width - 32);
        state.Entries.forEach((entry, slot) => {
            const hovered = selected === slot && entry.Available;
            this.Segment(cx, cy, radius, slot, hovered ? palette.Accent : palette.Panel, square);
            const angle = -Math.PI / 2 + slot * Math.PI / 4;
            // Keep text on theme surfaces so contrast also works for arbitrary addon accents.
            const x = cx + Math.cos(angle) * radius * 0.72, y = cy + Math.sin(angle) * radius * 0.72;
            const label = language.GetPhrase("zombieplague.emote" + entry.Name);
            draw.RoundedBox(square ? 0 : 4, x - radius * 0.23, y - 15, radius * 0.46, 44, palette.Surface);
            this.Text(label, "DermaDefault", x, y, !entry.Available ? palette.Muted : hovered ? palette.Accent : palette.Text, radius * 0.44);
        });
        const entry = selected === undefined ? undefined : state.Entries[selected];
        draw.RoundedBox(square ? 0 : 8, cx - radius * 0.28, cy - radius * 0.27, radius * 0.56, radius * 0.54, palette.Surface);
        this.Text(language.GetPhrase(entry ? "zombieplague.emote" + entry.Name : "zombieplague.admincancel"),
            "Trebuchet18", cx, cy - 20, entry?.Available ? palette.Accent : palette.Muted, radius * 0.5);
        this.Text((state.Page + 1) + " / " + state.Pages, "DermaDefault", cx, cy + 26, palette.Muted, radius * 0.5);
        this.Text(language.GetPhrase(entry && !entry.Available ? "zombieplague.danceunavailable" : "zombieplague.emotehelp"),
            "Trebuchet18", cx, cy + radius + 20, palette.Text, width - 40);
        this.Text(language.GetPhrase("zombieplague.emotepages"), "DermaDefault", cx, cy + radius + 56, palette.Muted, width - 40);
    }

    Destroy(): void {
        const panel = this.panel;
        this.panel = undefined;
        panel?.Remove();
    }
}
