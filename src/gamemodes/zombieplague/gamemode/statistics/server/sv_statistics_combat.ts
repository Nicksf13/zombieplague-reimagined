import type { StatisticsTracking } from "./sv_statistics_tracking";
const source = include("sv_statistics_weapon_source.lua") as typeof import("./sv_statistics_weapon_source");
interface DamageSnapshot {
    Target: ZPServerPlayer; Attacker: GLuaEntity; Role: ZPStatisticsRole; AttackerRole?: ZPStatisticsRole | undefined;
    Health: number; Armor: number; Team: number; AttackerTeam?: number | undefined;
    Weapon: string;
}
interface Assist { Player: ZPServerPlayer; Role: ZPStatisticsRole; Time: number; }
interface CombatContract { Begin(target: ZPServerPlayer, damage: GLuaDamageInfo): void; Clear(): void; }
export class StatisticsCombat implements CombatContract {
    private damage = new Map<GLuaDamageInfo, DamageSnapshot>();
    private assists = new Map<ZPServerPlayer, Map<ZPServerPlayer, Assist>>();
    private conversions = new Map<ZPServerPlayer, { Role: ZPStatisticsRole; Weapon: string }>();
    private lethal = new Map<ZPServerPlayer, { Killer: GLuaEntity; Weapon: string }>();
    constructor(private tracking: StatisticsTracking) {}
    Begin(target: ZPServerPlayer, damage: GLuaDamageInfo): void {
        const role = this.tracking.Role(target), attacker = damage.GetAttacker();
        const trackedActor = this.tracking.Eligible(target) ||
            (IsValid(attacker) && attacker.IsPlayer() && this.tracking.Eligible(attacker));
        if (!this.tracking.Active || !this.tracking.Participating(target) || !role || !trackedActor) return;
        this.tracking.Update(target);
        if (IsValid(attacker) && attacker.IsPlayer()) this.tracking.Update(attacker);
        if (this.damage.size >= 256) this.damage.clear();
        this.damage.set(damage, { Target: target, Attacker: attacker, Role: role,
            ...(IsValid(attacker) && attacker.IsPlayer() ? { AttackerRole: this.tracking.Role(attacker), AttackerTeam: attacker.Team() } : {}),
            Health: Math.max(0, target.Health()), Armor: Math.max(0, target.Armor()), Team: target.Team(),
            Weapon: IsValid(attacker) && attacker.IsPlayer() ? source.identify(attacker, damage.GetInflictor()) : "unattributed" });
    }
    End(target: GLuaEntity, damage: GLuaDamageInfo, tookDamage: boolean): void {
        const before = this.damage.get(damage); this.damage.delete(damage);
        if (!before || target !== before.Target || !IsValid(target)) return;
        // Infection heals/replaces the victim. Its conversion is recorded separately.
        const converted = this.tracking.Role(before.Target) !== before.Role;
        const health = tookDamage && !converted ? Math.min(before.Health, Math.max(0, before.Health - target.Health())) : 0;
        const armor = Math.min(before.Armor, Math.max(0, before.Armor - before.Target.Armor()));
        const attacker = before.Attacker;
        if (IsValid(attacker) && attacker.IsPlayer() && attacker !== target && before.AttackerTeam === before.Team) return;
        this.tracking.Add(before.Target, "DamageTaken", health, before.Role);
        this.tracking.Add(before.Target, "ArmorDamageTaken", armor, before.Role);
        if (!IsValid(attacker) || !attacker.IsPlayer() || attacker === target || !before.AttackerRole || !this.tracking.Eligible(attacker)) return;
        this.tracking.Add(attacker, "DamageDealt", health, before.AttackerRole);
        this.tracking.Add(attacker, "ArmorDamageDealt", armor, before.AttackerRole);
        this.tracking.Weapon(attacker, "DamageDealt", before.Weapon, health, before.AttackerRole);
        this.tracking.Weapon(attacker, "ArmorDamageDealt", before.Weapon, armor, before.AttackerRole);
        if (!converted && before.Target.Alive() && health + armor > 0) {
            const entries = this.assists.get(before.Target) ?? new Map<ZPServerPlayer, Assist>();
            entries.set(attacker, { Player: attacker, Role: before.AttackerRole, Time: CurTime() }); this.assists.set(before.Target, entries);
        }
    }
    CaptureDeath(target: ZPServerPlayer, killer: GLuaEntity, damage: GLuaDamageInfo): void {
        if (this.tracking.Active && IsValid(killer) && killer.IsPlayer())
            this.lethal.set(target, { Killer: killer, Weapon: source.identify(killer, damage.GetInflictor()) });
    }
    Death(target: ZPServerPlayer, killer: GLuaEntity, inflictor?: GLuaEntity): void {
        const receipt = this.lethal.get(target); this.lethal.delete(target);
        const weapon = receipt?.Killer === killer ? receipt.Weapon :
            IsValid(killer) && killer.IsPlayer() ? source.identify(killer, inflictor) : "unattributed";
        this.tracking.Death(target, killer, weapon);
        if (this.tracking.Participating(target) && IsValid(killer) && killer.IsPlayer() && killer !== target &&
            this.tracking.Participating(killer) && killer.Team() !== target.Team()) {
            const entries = this.assists.get(target);
            if (entries) for (const assist of entries.values()) {
                if (assist.Player !== killer && IsValid(assist.Player) && CurTime() - assist.Time <= 10 && assist.Player.Team() !== target.Team())
                    this.tracking.Add(assist.Player, "Assists", 1, assist.Role);
            }
        }
        this.assists.delete(target);
    }
    BeforeConversion(target: ZPServerPlayer, attacker: ZPServerPlayer, inflictor?: GLuaEntity): void {
        this.tracking.Update(target); this.tracking.Update(attacker);
        const role = this.tracking.Role(target);
        if (role) this.conversions.set(target, { Role: role, Weapon: source.identify(attacker, inflictor) });
    }
    Conversion(target: ZPServerPlayer, attacker: ZPServerPlayer | undefined, kind: "infection" | "cure"): void {
        const receipt = this.conversions.get(target); this.conversions.delete(target); this.assists.delete(target);
        if (receipt && attacker) this.tracking.Conversion(target, attacker, kind, receipt.Role, receipt.Weapon);
    }
    Reset(ply: ZPServerPlayer, keepConversion = false): void {
        this.assists.delete(ply); if (!keepConversion) this.conversions.delete(ply);
        this.lethal.delete(ply);
        for (const entries of this.assists.values()) entries.delete(ply);
    }
    Clear(): void { this.damage.clear(); this.assists.clear(); this.conversions.clear(); this.lethal.clear(); }
}
