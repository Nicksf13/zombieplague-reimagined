import type { NavStep } from "./sv_bot_pathfinding";

interface GroundPassage { From: number; To: number; Align: GLuaVector; Enter: GLuaVector; Crossing: boolean; }
export interface GroundControl { Target: GLuaVector; SpeedLimit: number; Phase: "align" | "cross"; }
interface GroundContract {
    Reset(): void;
    Control(ply: ZPServerPlayer, step: NavStep, width: number, speed: number, activate: boolean, tolerance?: number): GroundControl | undefined;
}

// Used when center-to-center steering loses the floor on a narrow connected surface.
// The local hull and ground probes still validate every offered movement action.
export class BotGroundTraversal implements GroundContract {
    private passage: GroundPassage | undefined;

    Reset(): void { this.passage = undefined; }

    private Passage(ply: ZPServerPlayer, step: NavStep, width: number): GroundPassage | undefined {
        const source = step.Source, area = step.Area;
        if (!source || !area || step.Ladder) return;
        const low = source.GetClosestPointOnArea(Vector(-1e7, -1e7, 0)), high = source.GetClosestPointOnArea(Vector(1e7, 1e7, 0));
        const otherLow = area.GetClosestPointOnArea(Vector(-1e7, -1e7, 0)), otherHigh = area.GetClosestPointOnArea(Vector(1e7, 1e7, 0));
        const position = ply.GetPos(), margin = width / 2 + 8;
        const sides = [
            { X: true, Direction: 1, Exit: high.x, Entry: otherLow.x },
            { X: true, Direction: -1, Exit: low.x, Entry: otherHigh.x },
            { X: false, Direction: 1, Exit: high.y, Entry: otherLow.y },
            { X: false, Direction: -1, Exit: low.y, Entry: otherHigh.y },
        ];
        for (const side of sides) {
            if (Math.abs(side.Entry - side.Exit) > 4) continue;
            const start = Math.max(side.X ? low.y : low.x, side.X ? otherLow.y : otherLow.x);
            const end = Math.min(side.X ? high.y : high.x, side.X ? otherHigh.y : otherHigh.x);
            if (end - start <= 1) continue;
            const inset = Math.min(margin, (end - start) / 2);
            const across = end - start <= width * 2 ? (start + end) / 2 : Math.max(start + inset, Math.min(end - inset, side.X ? position.y : position.x));
            const sourceDepth = side.X ? high.x - low.x : high.y - low.y, targetDepth = side.X ? otherHigh.x - otherLow.x : otherHigh.y - otherLow.y;
            const departure = side.Exit - side.Direction * Math.min(margin, sourceDepth / 2);
            const arrival = side.Entry + side.Direction * Math.min(margin, targetDepth / 2);
            const align = source.GetClosestPointOnArea(side.X ? Vector(departure, across, position.z) : Vector(across, departure, position.z));
            const enter = area.GetClosestPointOnArea(side.X ? Vector(arrival, across, position.z) : Vector(across, arrival, position.z));
            if (enter.z - align.z > 18 || enter.z - align.z < -24) continue;
            return { From: step.From, To: step.To, Align: align, Enter: enter, Crossing: false };
        }
    }

    Control(ply: ZPServerPlayer, step: NavStep, width: number, speed: number, activate: boolean, tolerance = 12): GroundControl | undefined {
        if (this.passage?.From !== step.From || this.passage.To !== step.To) this.Reset();
        if (!this.passage && activate) this.passage = this.Passage(ply, step, width);
        const passage = this.passage;
        if (!passage) return;
        const position = ply.GetPos();
        const dx = position.x - passage.Align.x, dy = position.y - passage.Align.y;
        // Nav surfaces can sit slightly below the actual floor; planar alignment must remain reachable.
        if (!passage.Crossing && dx * dx + dy * dy <= tolerance * tolerance && Math.abs(position.z - passage.Align.z) <= 24) passage.Crossing = true;
        const target = passage.Crossing ? passage.Enter : passage.Align;
        return { Target: target, SpeedLimit: Math.min(speed, Math.max(8, Math.sqrt(position.DistToSqr(target)) / 0.25)),
            Phase: passage.Crossing ? "cross" : "align" };
    }
}
