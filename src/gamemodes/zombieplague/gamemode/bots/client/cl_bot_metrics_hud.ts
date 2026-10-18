import type { BotMetricsCard as CardType } from "./cl_bot_metrics_card";
const { BotMetricsCard } = include("cl_bot_metrics_card.lua") as typeof import("./cl_bot_metrics_card");
const phrase = (key: string): string => language.GetPhrase("zombieplague.botmetrics" + key);
const enabled = (value: boolean): string => language.GetPhrase("zombieplague.settings" + (value ? "enabled" : "disabled"));
interface MetricsRow { ID: number; Card: CardType; }
interface MetricsViewContract { Update(state: ZPAdminState): void; Destroy(): void; }
export class BotMetricsView implements MetricsViewContract {
    private panel: GLuaPanel;
    private status: GLuaPanel;
    private previous: GLuaPanel;
    private next: GLuaPanel;
    private rows: Record<number, MetricsRow | undefined> = {};
    private data: ZPBotDiagnostic[] = [];
    private requestID = 0;
    private refreshed = 0;
    constructor(parent: GLuaPanel, private width: number, private palette: ZPThemePalette, private square: boolean, actions: ZPAdminActions, y = 198) {
        this.panel = parent.Add("DPanel"); this.panel.SetPos(0, y); this.panel.SetSize(width, 80); this.panel.Paint = () => {};
        this.status = this.Label(this.panel, 0, 44);
        this.previous = this.Button("previous", 0, () => actions.BotPage(-1));
        this.next = this.Button("next", width / 2 + 5, () => actions.BotPage(1));
    }
    private Label(parent: GLuaPanel, y: number, height: number): GLuaPanel {
        const label = vgui.Create("DLabel", parent);
        label.SetPos(10, y); label.SetSize(this.width - 28, height); label.SetWrap(true);
        label.SetFont("DermaDefault"); label.SetColor(this.palette.Text);
        return label;
    }
    private Button(key: string, x: number, action: ZPAction): GLuaPanel {
        const button = this.panel.Add("DButton"); button.SetText(""); button.SetPos(x, 48); button.SetSize(this.width / 2 - 5, 30);
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            draw.DrawText(phrase(key), "DermaDefault", 10, 8, !button.IsEnabled() ? this.palette.Muted : button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); };
        return button;
    }
    private Layout(): void {
        let y = 90;
        for (const entry of this.data) {
            const card = this.rows[entry.ID]?.Card;
            if (!card) continue;
            card.Panel.SetPos(0, y); card.Panel.SetSize(this.width, card.Height()); y += card.Height() + 10;
        }
        this.panel.SetSize(this.width, y);
    }
    Update(state: ZPAdminState): void {
        const snapshot = state.BotMetrics, data = snapshot?.Rows ?? [], wanted: Record<number, boolean> = {};
        this.data = data;
        if (snapshot && snapshot.RequestID !== this.requestID) { this.requestID = snapshot.RequestID; this.refreshed = CurTime(); }
        this.status.SetText(snapshot ? string.format(phrase("page"), snapshot.Page + 1, Math.max(1, Math.ceil(snapshot.Total / 16)), snapshot.Total, enabled(snapshot.Learning)) :
            language.GetPhrase(state.BotMetricsLoading ? "zombieplague.weaponmenuwaiting" : "zombieplague.weaponmenutimeout"));
        this.previous.SetEnabled(snapshot !== undefined && snapshot.Page > 0 && !state.BotMetricsLoading);
        this.next.SetEnabled(snapshot !== undefined && (snapshot.Page + 1) * 16 < snapshot.Total && !state.BotMetricsLoading);
        data.forEach(entry => {
            wanted[entry.ID] = true;
            let row = this.rows[entry.ID];
            if (!row) {
                row = { ID: entry.ID, Card: new BotMetricsCard(this.panel, entry, this.width, this.palette, this.square, () => this.Layout()) };
                this.rows[entry.ID] = row;
            }
            // Keep cards alive during polling so native scrolling and pointer position remain stable.
            row.Card.Update(entry, this.refreshed);
        });
        for (const [, row] of pairs(this.rows)) if (row && !wanted[row.ID]) { row.Card.Destroy(); delete this.rows[row.ID]; }
        this.Layout();
        if (snapshot && data.length === 0) this.status.SetText(phrase("empty"));
    }
    Destroy(): void { this.panel.Remove(); this.rows = {}; this.data = []; }
}
