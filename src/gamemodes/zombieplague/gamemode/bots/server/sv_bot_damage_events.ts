interface DamageReceipt { ID: string; Claims: Set<string>; }
/** Authored fall pits use ordinary trigger damage, so their explicit name is part of the map contract. */
export function fallDamage(damage: GLuaDamageInfo): boolean {
    if (damage.IsDamageType(DMG_FALL)) return true;
    const inflictor = damage.GetInflictor();
    return IsValid(inflictor) && inflictor.GetClass() === "trigger_hurt" && inflictor.GetName() === "zp_fall_hurt";
}
/** The death and post-damage hooks may observe the same engine damage object. */
export class BotDamageEvents {
    private events = new Map<GLuaDamageInfo, DamageReceipt>();
    private sequence = 0;
    constructor(private session: string) {}
    Claim(damage: GLuaDamageInfo, bot: number, channel: string): string | undefined {
        let receipt = this.events.get(damage);
        if (!receipt) {
            if (this.events.size >= 128) { const first = [...this.events.keys()][0]; if (first !== undefined) this.events.delete(first); }
            receipt = { ID: this.session + ":damage:" + ++this.sequence, Claims: new Set() }; this.events.set(damage, receipt);
        }
        const key = bot + ":" + channel;
        if (receipt.Claims.has(key)) return;
        receipt.Claims.add(key); return receipt.ID;
    }
}
