import type { BotBoostManager } from "./sv_bot_boost";
const geometry = include("sv_bot_boost_geometry.lua") as typeof import("./sv_bot_boost_geometry");
const rules = include("sh_bot_boost_rules.lua") as typeof import("../shared/sh_bot_boost_rules");
const { BotBoostTool } = include("sv_bot_boost_tool.lua") as typeof import("./sv_bot_boost_tool");
interface EditorState { Draft: ZPBotBoostPoint; Selected: number; Editing: boolean; Dirty: boolean; Revision: number; Feedback: ZPBotBoostFeedback; Issue: ZPBotBoostIssue | undefined; }
interface EditorContract { Receive(length: number, ply: ZPServerPlayer): void; Remove(ply: ZPServerPlayer): void; Tick(): void; }
export class BotBoostEditorService implements EditorContract {
    private tool = new BotBoostTool();
    private revision = 1;
    private states = new Map<string, EditorState>();
    private requests = new Map<string, number>();
    constructor(private manager: BotBoostManager, private players: (this: void) => ZPServerPlayer[]) {}
    Remove(ply: ZPServerPlayer): void { this.tool.Release(ply); this.states.delete(ply.SteamID64()); this.requests.delete(ply.SteamID64()); }
    Tick(): void { this.tool.Tick(); }
    private Fail(state: EditorState, issue: ZPBotBoostIssue): void { state.Issue = issue; state.Feedback = issue.Code === "nav" ? "missing" : "invalid"; }
    private Capture(state: EditorState, ply: ZPServerPlayer, slot: number): void {
        if (!this.tool.Active(ply) || !state.Editing) { this.Fail(state, rules.issue("tool")); return; }
        const trace = ply.GetEyeTrace(), distance = Math.sqrt(trace.HitPos.DistToSqr(ply.EyePos()));
        if (!trace.Hit || trace.HitSky || !trace.HitNormal || trace.HitNormal.z < 0.7 || !["worldspawn", "prop_static"].includes(trace.Entity.GetClass())) {
            this.Fail(state, rules.issue("surface", slot)); return;
        }
        if (distance > 4096) { this.Fail(state, rules.issue("range", slot, distance, 0, 4096)); return; }
        const point = [trace.HitPos.x, trace.HitPos.y, trace.HitPos.z];
        if (!geometry.grounded(point)) { this.Fail(state, rules.issue("floor", slot)); return; }
        if (slot === 2) state.Draft.Base = point; else if (slot === 3) state.Draft.Approach = point; else state.Draft.Exit = point;
        const saved = this.manager.Store.Points().find(item => item.ID === state.Draft.ID);
        state.Dirty = !saved || rules.positions(state.Draft).some((position, index) => position.some((value, axis) => value !== rules.positions(saved)[index]?.[axis]));
    }
    private Apply(state: EditorState, ply: ZPServerPlayer, operation: number, id: number): void {
        if (operation === 10) {
            if (!ply.Alive()) this.Fail(state, rules.issue("alive"));
            else if (!this.tool.Equip(ply)) this.Fail(state, rules.issue("tool"));
            return;
        }
        if (operation === 0) return;
        if ([1, 9, 12, 6, 7].includes(operation) && state.Dirty) { this.Fail(state, rules.issue("unsaved")); return; }
        if (operation === 1 || operation === 8) {
            state.Draft = rules.empty(); state.Selected = 0; state.Dirty = false; state.Editing = operation === 1; state.Revision = this.revision; return;
        }
        if (operation >= 2 && operation <= 4) { this.Capture(state, ply, operation); return; }
        const saved = this.manager.Store.Points().find(point => point.ID === id);
        if ([6, 7, 9, 12].includes(operation) && !saved) { this.Fail(state, rules.issue("selection")); return; }
        if (operation === 9 && saved) {
            state.Draft = rules.copy(saved); state.Selected = id; state.Editing = true; state.Revision = this.revision;
        } else if (operation === 12) { state.Selected = id; state.Editing = false; state.Draft = rules.empty(); }
        else if (operation === 5) {
            const invalid = geometry.validate(state.Draft);
            if (!state.Editing) this.Fail(state, rules.issue("tool"));
            else if (invalid) this.Fail(state, invalid);
            else if (state.Draft.ID === 0 && this.manager.Store.Points().length >= 32) this.Fail(state, rules.issue("capacity"));
            else {
                const previous = this.manager.Store.Points().map(point => point.ID), oldID = state.Draft.ID;
                if (!this.manager.Store.Put(state.Draft)) { this.Fail(state, rules.issue("storage")); return; }
                const result = this.manager.Store.Points().find(point => oldID !== 0 ? point.ID === oldID : !previous.includes(point.ID));
                this.manager.Invalidate(oldID); this.revision++;
                state.Selected = result?.ID ?? 0; state.Draft = result ? rules.copy(result) : rules.empty();
                state.Dirty = false; state.Editing = false; state.Revision = this.revision; state.Feedback = "saved";
            }
        } else if (operation === 6) {
            if (!this.manager.Store.Remove(id)) this.Fail(state, rules.issue("storage"));
            else {
                this.manager.Invalidate(id); this.revision++; state.Feedback = "saved";
                if (state.Selected === id || state.Draft.ID === id) { state.Selected = 0; state.Draft = rules.empty(); state.Editing = false; }
            }
        } else if (operation === 7) {
            state.Feedback = this.manager.Test(id, this.players(), CurTime()) ? "testing" : "busy";
            state.Issue = this.manager.TestFailure;
        }
    }
    Receive(length: number, ply: ZPServerPlayer): void {
        if (length !== 90 || !IsValid(ply) || ply.IsBot()) return;
        const version = net.ReadUInt(8), request = net.ReadUInt(31), revision = net.ReadUInt(31), operation = net.ReadUInt(4), id = net.ReadUInt(16);
        if (version !== 1 || request < 1 || operation > 12) return;
        if (operation === 11) { this.tool.Release(ply); this.requests.delete(ply.SteamID64()); return; }
        if (!ply.IsAdmin()) { this.tool.Release(ply); return; }
        const identity = ply.SteamID64(), now = CurTime();
        if (now < (this.requests.get(identity) ?? 0)) return;
        this.requests.set(identity, now + 0.1); this.tool.Touch(ply);
        const state: EditorState = this.states.get(identity) ?? { Draft: rules.empty(), Selected: 0, Editing: false, Dirty: false, Revision: this.revision, Feedback: "ready", Issue: undefined };
        if (operation !== 0) { state.Feedback = "ready"; state.Issue = undefined; }
        // Polling may update the catalog revision, but cannot rebase an unsaved draft over somebody else's edit.
        if ([2, 3, 4, 5, 6, 7, 9, 12].includes(operation) && (revision !== this.revision || ([2, 3, 4, 5].includes(operation) && state.Editing && state.Revision !== this.revision))) {
            this.Fail(state, rules.issue("stale")); state.Feedback = "busy";
        } else this.Apply(state, ply, operation, id);
        if (!state.Editing) state.Revision = this.revision;
        if (!this.manager.Store.Points().some(point => point.ID === state.Selected)) state.Selected = 0;
        if (this.states.size >= 64 && !this.states.has(identity)) { const first = [...this.states.keys()][0]; if (first !== undefined) this.states.delete(first); }
        this.states.set(identity, state);
        const issue = state.Issue ?? (state.Editing ? geometry.validate(state.Draft) : undefined);
        const feedback = operation === 0 && state.Feedback === "testing" ? this.manager.Feedback : state.Feedback;
        net.Start("ZPBotBoostReply");
        net.WriteTable({ Version: 1, RequestID: request, Revision: this.revision, Points: this.manager.Store.Points(), Draft: state.Draft,
            Selected: state.Selected, Editing: state.Editing, Dirty: state.Dirty, Feedback: feedback,
            ...(issue ? { Issue: issue } : {}), Sessions: this.manager.Sessions(), Results: this.manager.Store.Results() }); net.Send(ply);
    }
}
