interface GuardContract { Reset(): void; Damage(amount: number, maxHealth: number, attacker: GLuaVector, now: number): void; Look(ply: ZPServerPlayer, now: number): GLuaVector | undefined; }
export class BotDamageGuard implements GuardContract {
    private started = 0;
    private amount = 0;
    private until = 0;
    private next = 0;
    private source: GLuaVector | undefined;
    constructor(private id: number) {}
    Reset(): void { this.started = 0; this.amount = 0; this.until = 0; this.next = 0; this.source = undefined; }
    Damage(amount: number, maxHealth: number, attacker: GLuaVector, now: number): void {
        if (!Number.isFinite(amount) || amount <= 0) return;
        if (now - this.started > 0.8 || now < this.started) { this.started = now; this.amount = 0; }
        this.amount += amount;
        if (now >= this.next && this.amount >= Math.max(20, Math.min(1000, maxHealth) * 0.08)) {
            this.source = Vector(attacker.x, attacker.y, attacker.z); this.until = now + 0.35; this.next = now + 3; this.amount = 0;
        }
    }
    Look(ply: ZPServerPlayer, now: number): GLuaVector | undefined {
        if (!this.source || now >= this.until) return;
        return Vector(this.source.x, this.source.y, this.source.z + 48);
    }
}
