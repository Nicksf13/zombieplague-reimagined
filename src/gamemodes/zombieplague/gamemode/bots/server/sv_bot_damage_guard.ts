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
            this.source = Vector(attacker.x, attacker.y, attacker.z); this.until = now + 0.65; this.next = now + 2; this.amount = 0;
        }
    }
    Look(ply: ZPServerPlayer, now: number): GLuaVector | undefined {
        if (!this.source || now >= this.until) return;
        const eye = ply.EyePos(), dx = this.source.x - eye.x, dy = this.source.y - eye.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const turn = (this.id % 2 === 0 ? 1 : -1) * Math.PI * 2 / 3, x = dx / length, y = dy / length;
        return Vector(eye.x + (x * Math.cos(turn) - y * Math.sin(turn)) * 128,
            eye.y + (x * Math.sin(turn) + y * Math.cos(turn)) * 128, eye.z - 64);
    }
}
