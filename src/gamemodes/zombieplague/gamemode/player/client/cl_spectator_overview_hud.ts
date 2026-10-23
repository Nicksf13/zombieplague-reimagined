const { markers, hit, paint } = include("cl_spectator_overview_map.lua") as typeof import("./cl_spectator_overview_map");
const phrase = (key: string): string => language.GetPhrase("zombieplague.overview" + key);

export class SpectatorOverviewHUD implements ZPSpectatorOverviewPresentation {
    private frame: GLuaPanel | undefined;
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    Open(actions: ZPSpectatorOverviewClient, overview: ZPRadarOverview): void {
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false); frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        frame.SetSize(ScrW(), ScrH()); frame.SetPos(0, 0);
        const [width, height] = frame.GetSize(), size = Math.max(32, Math.min(width - 32, height - 174));
        frame.Paint = (w, h) => {
            // The overview fully replaces the match image, including translucent addon palettes.
            draw.RoundedBox(0, 0, 0, w, h, Color(this.palette.Surface.r, this.palette.Surface.g, this.palette.Surface.b, 255));
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
            draw.DrawText(phrase("title"), "DermaLarge", 16, 12, this.palette.Text, TEXT_ALIGN_LEFT);
            const state = actions.GetSnapshot();
            draw.DrawText(phrase(state?.Restricted ? "teamonly" : "allteams"), "DermaDefault", 16, h - 66, this.palette.Muted, TEXT_ALIGN_LEFT);
            draw.DrawText(language.GetPhrase("zombieplague.scoreboardtitlehumans"), "DermaDefault", 16, h - 48, HUMANS_COLOR, TEXT_ALIGN_LEFT);
            draw.DrawText(language.GetPhrase("zombieplague.scoreboardtitlezombies"), "DermaDefault", w / 2, h - 48, ZOMBIES_COLOR, TEXT_ALIGN_LEFT);
            draw.DrawText(string.format(phrase("help"), input.LookupBinding("+jump") ?? "?"), "DermaDefault", 16, h - 27, this.palette.Text, TEXT_ALIGN_LEFT);
        };
        const close = vgui.Create("DButton", frame);
        close.SetText(""); close.SetPos(width - 48, 12); close.SetSize(32, 32);
        close.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, close.IsHovered() ? this.palette.Accent : this.palette.Panel);
            draw.DrawText("X", "Trebuchet18", 10, 5, close.IsHovered() ? Color(12, 18, 22) : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        close.DoClick = () => actions.Follow(0);
        let layer: number | undefined;
        const combo = vgui.Create("DComboBox", frame) as ZPMenuComboBox<number>;
        combo.SetPos(16, 54); combo.SetSize(Math.min(300, width - 32), 28); combo.SetSortItems(false);
        combo.AddChoice(phrase("alllevels"), -1); combo.SetValue(phrase("alllevels"));
        overview.Layers?.forEach((_, index) => combo.AddChoice(string.format(language.GetPhrase("zombieplague.radarlevel"),
            index + 1, overview.Layers?.length ?? 0), index));
        combo.SetEnabled((overview.Layers?.length ?? 0) > 0);
        combo.OnSelect = (_index, _text, value) => { layer = value < 0 ? undefined : value; };
        ZPMenuControls.ComboBox(combo, this.palette, this.square);
        const map = vgui.Create("DPanel", frame);
        map.SetPos((width - size) / 2, 94); map.SetSize(size, size);
        const points = (): ReturnType<typeof markers> => {
            const state = actions.GetSnapshot();
            return state ? markers(overview, state, size) : [];
        };
        map.Paint = () => {
            const state = actions.GetSnapshot();
            const [x, y] = map.LocalCursorPos();
            if (state) paint(overview, state, size, this.palette, layer, hit(points(), x, y));
        };
        map.OnMousePressed = button => {
            if (button !== MOUSE_LEFT) return;
            const [x, y] = map.LocalCursorPos(), id = hit(points(), x, y);
            if (id !== undefined) actions.Follow(id);
        };
        frame.MakePopup(); frame.SetKeyboardInputEnabled(false);
    }
    Destroy(): void { if (this.frame && IsValid(this.frame)) this.frame.Remove(); this.frame = undefined; }
}
