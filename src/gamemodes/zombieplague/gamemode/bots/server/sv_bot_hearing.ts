export interface SoundClue { ID: number; Position: GLuaVector; Time: number; Category: "gunshot" | "footstep"; Confidence: number; Expires: number; }
interface SoundEvent { ID: number; Position: GLuaVector; Time: number; Category: SoundClue["Category"]; Source: GLuaEntity; }
interface HearingContract { Emit(source: GLuaEntity, position: GLuaVector, category: SoundClue["Category"], now: number): void; Listen(ply: ZPServerPlayer, now: number): SoundClue | undefined; }
/** Events contain a snapshot. Identity is used only to discard the listener's own sound. */
export class BotHearing implements HearingContract {
    private events: SoundEvent[] = [];
    private sequence = 0;
    private budgetAt = -1;
    private budget = 0;
    Emit(source: GLuaEntity, position: GLuaVector, category: SoundClue["Category"], now: number): void {
        if (![position.x, position.y, position.z, now].every(value => Number.isFinite(value))) return;
        const bucket = Math.floor(now * 5);
        if (bucket !== this.budgetAt) { this.budgetAt = bucket; this.budget = 0; }
        if (this.budget++ >= 16) return;
        if (this.events.some(event => event.Source === source && event.Category === category && now - event.Time < 0.15)) return;
        this.events.push({ ID: ++this.sequence, Source: source, Position: Vector(position.x, position.y, position.z), Time: now, Category: category });
        this.events = this.events.filter(event => now - event.Time <= 6).slice(-32);
    }
    Listen(ply: ZPServerPlayer, now: number): SoundClue | undefined {
        let best: SoundClue | undefined;
        const eye = ply.EyePos();
        const audible = this.events.filter(event => event.Source !== ply && now >= event.Time && now - event.Time < (event.Category === "gunshot" ? 6 : 2) &&
            eye.DistToSqr(event.Position) <= (event.Category === "gunshot" ? 1400 : 380) ** 2);
        audible.sort((a, b) => b.Time - a.Time);
        for (const event of audible.slice(0, 2)) {
            const gun = event.Category === "gunshot", age = now - event.Time, life = gun ? 6 : 2;
            if (event.Source === ply || age < 0 || age >= life) continue;
            const distance = Math.sqrt(eye.DistToSqr(event.Position)), range = gun ? 1400 : 380;
            if (distance > range) continue;
            // One coarse geometry test is not an acoustic simulation. Walls shorten range and lower certainty.
            const occluded = util.TraceLine({ start: eye, endpos: event.Position, filter: player.GetAll() as ZPServerPlayer[], mask: MASK_SHOT }).Hit;
            if (occluded && distance > range * 0.45) continue;
            const confidence = (gun ? 0.9 : 0.65) * (1 - age / life) * (occluded ? 0.5 : 1) * (1 - distance / (range * 2));
            if (confidence < 0.12 || (best && best.Confidence >= confidence)) continue;
            const cell = occluded ? 160 : gun ? 96 : 48;
            best = { ID: event.ID, Time: event.Time, Category: event.Category, Confidence: confidence, Expires: event.Time + life,
                Position: Vector(Math.round(event.Position.x / cell) * cell, Math.round(event.Position.y / cell) * cell, Math.round(event.Position.z / 48) * 48) };
        }
        return best;
    }
    Reset(): void { this.events = []; }
}
