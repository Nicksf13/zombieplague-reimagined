interface CategoryDraft { Values: string[]; Saved: string[]; Available: boolean[]; Revision: number; Feedback: string; Reload: boolean; Token: number; }
interface CvarsClientContract { State(): ZPServerCvarClientState; Open(category: number): void; Stop(): void; Tick(): void; Receive(length: number): void; }
export class ServerCvarsClient implements CvarsClientContract {
    private category = -1;
    private active = false;
    private sequence = 0;
    private next = 0;
    private drafts = new Map<number, CategoryDraft>();
    private pending: { ID: number; Category: number; Deadline: number } | undefined;
    constructor(private changed: (this: void) => void) {}
    private Draft(): CategoryDraft {
        let draft = this.drafts.get(this.category);
        if (!draft) {
            const category = ZPServerCvars.Categories[this.category];
            draft = { Values: category ? ZPServerCvars.ForCategory(category.ID).map(entry => entry.Default) : [], Saved: [], Available: [], Revision: 0, Feedback: "", Reload: false, Token: 0 };
            this.drafts.set(this.category, draft);
        }
        return draft;
    }
    private Allowed(): boolean { return IsValid(LocalPlayer()) && LocalPlayer().IsAdmin(); }
    State(): ZPServerCvarClientState {
        const draft = this.Draft(), category = ZPServerCvars.Categories[this.category];
        return { Category: this.category, Values: [...draft.Values], Available: [...draft.Available], Ready: draft.Revision > 0,
            ReloadRequired: draft.Reload, CanReload: draft.Token > 0,
            Pending: this.pending !== undefined, Dirty: draft.Revision > 0 && draft.Values.some((raw, index) => {
                const entry = category ? ZPServerCvars.ForCategory(category.ID)[index] : undefined;
                return entry !== undefined && (ZPServerCvars.Normalize(entry, raw) ?? raw) !== (ZPServerCvars.Normalize(entry, draft.Saved[index] ?? "") ?? draft.Saved[index]);
            }), Feedback: draft.Feedback, CanEdit: this.Allowed() && category !== undefined && (!category.SuperAdmin || LocalPlayer().IsSuperAdmin()) };
    }
    Open(category: number): void {
        this.category = category; this.active = true;
        if (this.Draft().Revision === 0) { this.Draft().Feedback = ""; this.Refresh(); }
        this.changed();
    }
    Suspend(): void { this.active = false; }
    Stop(): void { this.active = false; this.pending = undefined; for (const draft of this.drafts.values()) draft.Token = 0; }
    Set(index: number, value: string): void {
        const state = this.State(), draft = this.Draft();
        if (!this.active || !state.CanEdit || state.Pending || !state.Ready || !draft.Available[index] || typeof value !== "string" || value.length > 128) return;
        draft.Values[index] = value; draft.Feedback = ""; this.changed();
    }
    private Begin(action: number): boolean {
        if (!this.active || !this.Allowed() || this.pending || CurTime() < this.next) return false;
        this.sequence = this.sequence % 2147483647 + 1;
        const draft = this.Draft();
        this.pending = { ID: this.sequence, Category: this.category, Deadline: CurTime() + 5 };
        this.next = CurTime() + 0.3; draft.Feedback = "zombieplague.weaponmenuwaiting";
        net.Start("ZPServerCvarsRequest"); net.WriteUInt(2, 8); net.WriteUInt(action, 2); net.WriteUInt(this.sequence, 31); net.WriteUInt(this.category, 8);
        return true;
    }
    Refresh(): void { if (this.Begin(0)) { net.SendToServer(); this.changed(); } }
    Save(): void {
        const state = this.State(), category = ZPServerCvars.Categories[this.category], draft = this.Draft();
        if (!state.CanEdit || !state.Ready || !state.Dirty || !category || this.pending) return;
        const changed: { Index: number; Value: string }[] = [];
        for (const [index, entry] of ZPServerCvars.ForCategory(category.ID).entries()) {
            const raw = draft.Values[index] ?? "", value = ZPServerCvars.Normalize(entry, raw);
            if ((value ?? raw) === (ZPServerCvars.Normalize(entry, draft.Saved[index] ?? "") ?? draft.Saved[index])) continue;
            if (value === undefined || !draft.Available[index]) { draft.Feedback = "zombieplague.adminerror"; this.changed(); return; }
            changed.push({ Index: index, Value: value });
        }
        if (!this.Begin(1)) return;
        net.WriteUInt(draft.Revision, 31); net.WriteUInt(changed.length, 8);
        for (const value of changed) { net.WriteUInt(value.Index, 8); net.WriteString(value.Value); }
        net.SendToServer(); this.changed();
    }
    Receive(length: number): void {
        if (length < 49 || length > 32768 || !this.pending || !this.Allowed()) return;
        const version = net.ReadUInt(8), id = net.ReadUInt(31), categoryIndex = net.ReadUInt(8), code = net.ReadUInt(2);
        if (version !== 2 || id !== this.pending.ID || categoryIndex !== this.pending.Category || code > 2) return;
        const draft = this.drafts.get(categoryIndex), category = ZPServerCvars.Categories[categoryIndex];
        if (!draft || !category) return;
        if (code < 2) {
            if (length < 88) return;
            const revision = net.ReadUInt(31), count = net.ReadUInt(8), entries = ZPServerCvars.ForCategory(category.ID);
            if (revision < 1 || count !== entries.length || length < 120 + count * 9) return;
            const values: string[] = [], available: boolean[] = [];
            for (let index = 0; index < count; index++) {
                available.push(net.ReadBool());
                const raw = net.ReadString();
                if (raw.length > 128) return;
                values.push(raw);
            }
            const reload = net.ReadBool(), token = net.ReadUInt(31);
            if ((code === 0 && token !== 0) || (!reload && token !== 0) || (reload && code === 1 && token < 1)) return;
            draft.Reload = reload; draft.Token = token;
            // A view of another category does not erase that category's unsaved draft.
            draft.Values = values; draft.Saved = [...values]; draft.Available = available; draft.Revision = revision;
            draft.Feedback = code === 1 ? "zombieplague.adminsaved" : "";
        } else { draft.Feedback = "zombieplague.adminerror"; draft.Token = 0; }
        this.pending = undefined; this.changed();
    }
    ReloadAction(): ZPAction | undefined {
        const state = this.State(), draft = this.Draft();
        if (!this.active || !state.CanEdit || !state.Ready || state.Dirty || state.Pending || !state.ReloadRequired || !state.CanReload) return;
        const category = this.category, revision = draft.Revision, token = draft.Token;
        return () => {
            const current = this.State();
            if (this.category !== category || this.Draft().Revision !== revision || this.Draft().Token !== token ||
                !current.CanEdit || current.Dirty || !current.ReloadRequired || !this.Begin(2)) return;
            net.WriteUInt(revision, 31); net.WriteUInt(token, 31); draft.Token = 0;
            net.SendToServer(); this.changed();
        };
    }
    Tick(): void {
        if (!this.Allowed()) { this.Stop(); return; }
        if (this.pending && CurTime() > this.pending.Deadline) {
            const draft = this.drafts.get(this.pending.Category);
            if (draft) { draft.Feedback = "zombieplague.weaponmenutimeout"; draft.Token = 0; }
            this.pending = undefined; this.changed();
        }
        if (this.active && !this.pending && this.Draft().Revision === 0 && CurTime() >= this.next && this.Draft().Feedback === "") this.Refresh();
    }
}
