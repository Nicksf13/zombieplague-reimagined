import type { BotSenses } from "./sv_bot_perception";
const { enemy, role } = include("sv_bot_perception.lua") as typeof import("./sv_bot_perception");
export interface AlliedContact { ID: number; Reporter: number; Position: GLuaVector; Time: number; Expires: number; }
interface Report { Clue: AlliedContact; Target: ZPServerPlayer; Role: ZPBotRole; Origin: GLuaVector; }
interface ContactsContract {
    Report(ply: ZPServerPlayer, senses: BotSenses, now: number): void;
    Listen(ply: ZPServerPlayer, participants: ZPServerPlayer[], now: number): AlliedContact | undefined;
    Remove(ply: ZPServerPlayer): void;
    Reset(): void;
}
/** Only firsthand visual observations can create a report; receiving one never relays it. */
export class BotContacts implements ContactsContract {
    private reports = new Map<ZPServerPlayer, Report>();
    private sequence = 0;
    private Radius(): number {
        const value = cvars.Number("zp_bot_contact_radius", 900);
        return Number.isFinite(value) ? Math.max(0, Math.min(32768, value)) : 900;
    }
    Report(ply: ZPServerPlayer, senses: BotSenses, now: number): void {
        if (this.Radius() === 0) { this.Reset(); return; }
        const currentRole = role(ply), target = senses.Target, position = senses.EnemyPosition;
        if (!IsValid(ply) || !ply.Alive() || !currentRole || !senses.Visible || !target || !enemy(ply, target) || !position ||
            ![position.x, position.y, position.z, now].every(value => Number.isFinite(value))) return;
        const previous = this.reports.get(ply);
        if (previous?.Target === target && now >= previous.Clue.Time && now - previous.Clue.Time < 0.5) return;
        if (this.reports.size >= 64 && !this.reports.has(ply)) {
            const first = [...this.reports.keys()][0]; if (first !== undefined) this.reports.delete(first);
        }
        const origin = ply.GetPos();
        this.reports.set(ply, { Target: target, Role: currentRole, Origin: Vector(origin.x, origin.y, origin.z),
            Clue: { ID: ++this.sequence, Reporter: ply.EntIndex(), Position: Vector(position.x, position.y, position.z), Time: now, Expires: now + 6 } });
    }
    Listen(ply: ZPServerPlayer, participants: ZPServerPlayer[], now: number): AlliedContact | undefined {
        const radius = this.Radius();
        if (radius === 0) { this.Reset(); return; }
        const active = new Set(participants);
        if (!IsValid(ply) || !ply.Alive() || !active.has(ply)) return;
        const currentRole = role(ply), position = ply.GetPos();
        let best: Report | undefined, nearest = Infinity;
        for (const [source, report] of this.reports) {
            if (now < report.Clue.Time || now >= report.Clue.Expires || !IsValid(source) || !source.Alive() || role(source) !== report.Role ||
                !active.has(source) || !active.has(report.Target) || !enemy(source, report.Target)) {
                this.reports.delete(source); continue;
            }
            const distance = position.DistToSqr(report.Origin);
            if (source === ply || report.Role !== currentRole || distance > radius * radius) continue;
            if (!best || report.Clue.Time > best.Clue.Time || (report.Clue.Time === best.Clue.Time && distance < nearest)) { best = report; nearest = distance; }
        }
        const clue = best?.Clue;
        return clue ? { ...clue, Position: Vector(clue.Position.x, clue.Position.y, clue.Position.z) } : undefined;
    }
    Remove(ply: ZPServerPlayer): void {
        for (const [source, report] of this.reports) if (source === ply || report.Target === ply) this.reports.delete(source);
    }
    Reset(): void { this.reports.clear(); }
}
