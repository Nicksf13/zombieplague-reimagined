const phrase = (key: string): string => language.GetPhrase("zombieplague.botboost" + key);
export interface BoostMenuContext {
    Data: ZPBotBoostSnapshot | undefined;
    Selected: number;
    Pending: boolean;
    Confirm: "discard" | "delete" | undefined;
}
export interface BoostMenuItem { Operation: number; ID: number; Text: string; Enabled: boolean; }
export interface BoostMenuView { Title: string; Message: string; Items: BoostMenuItem[]; Active: number; }
interface BoostToolMenuContract {
    Open(focus?: number): void;
    Close(): void;
    IsOpen(): boolean;
    Choose(): void;
    Back(): boolean;
    Move(direction: number, context: BoostMenuContext): void;
    View(context: BoostMenuContext): BoostMenuView | undefined;
}
// Keep navigation local to the weapon; only a confirmed action reaches the server.
export class BotBoostMenu implements BoostToolMenuContract {
    private opened = false;
    private choosing = false;
    private operation = 1;
    private id = 0;

    Open(focus?: number): void {
        this.opened = true;
        if (focus !== undefined) { this.choosing = false; this.operation = focus; this.id = 0; }
    }
    Close(): void { this.opened = false; this.choosing = false; this.operation = 1; this.id = 0; }
    IsOpen(): boolean { return this.opened; }
    Choose(): void { this.choosing = true; this.operation = 12; this.id = 0; }
    Back(): boolean {
        if (!this.choosing) return false;
        this.choosing = false; this.operation = 24; this.id = 0; return true;
    }
    Move(direction: number, context: BoostMenuContext): void {
        const view = this.View(context); if (!view || view.Items.length === 0) return;
        const index = (view.Active + direction + view.Items.length) % view.Items.length;
        const item = view.Items[index];
        if (item) { this.operation = item.Operation; this.id = item.ID; }
    }
    View(context: BoostMenuContext): BoostMenuView | undefined {
        if (!this.opened) return undefined;
        const item = (operation: number, key: string, available = true, id = context.Selected): BoostMenuItem => ({
            Operation: operation, ID: id, Text: key === "admincancel" ? language.GetPhrase("zombieplague.admincancel") : phrase(key) +
                ([7, 16, 23].includes(operation) && id !== 0 ? " #" + id : ""),
            Enabled: available && (!context.Pending || [17, 19, 22].includes(operation))
        });
        let items: BoostMenuItem[];
        if (context.Confirm === "discard") items = [item(21, "save", context.Data?.Editing === true), item(20, "discard"), item(22, "admincancel"), item(17, "close")];
        else if (context.Confirm === "delete") items = [item(23, "remove", context.Selected !== 0), item(22, "admincancel"), item(17, "close")];
        else if (this.choosing) items = [...(context.Data?.Points ?? []).map(point => ({
            Operation: 12, ID: point.ID, Text: "#" + point.ID, Enabled: !context.Pending
        })), item(19, "back")];
        else items = [item(1, "new"), item(5, "save", context.Data?.Editing === true),
            item(24, "choose", (context.Data?.Points.length ?? 0) > 0), item(7, "test", context.Selected !== 0),
            item(16, "remove", context.Selected !== 0), item(17, "close"), item(19, "back")];
        const active = Math.max(0, items.findIndex(entry => entry.Operation === this.operation && (entry.Operation !== 12 || entry.ID === this.id)));
        const focused = items[active]; if (focused) { this.operation = focused.Operation; this.id = focused.ID; }
        return { Title: phrase(context.Confirm ? "actions" : this.choosing ? "choose" : "actions"),
            Message: context.Confirm === "discard" ? phrase("unsaved") : context.Confirm === "delete" ? string.format(phrase("confirmremove"), context.Selected) : "",
            Items: items, Active: active };
    }
}
