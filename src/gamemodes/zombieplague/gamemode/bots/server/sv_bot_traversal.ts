import type { MotionPhysics } from "./sv_bot_motion_physics";
export interface FallRisk { Damage: number; Allowed: boolean; }
export function fallRisk(ply: ZPServerPlayer, drop: number, physics: MotionPhysics): FallRisk {
    // Match the gamemode's current fall-damage formula and the player's live class/convar rule.
    const speed = Math.sqrt(2 * physics.Gravity * Math.max(0, drop));
    const damage = ply.ShouldTakeFallDamage() ? Math.max(0, Math.ceil(0.2418 * speed - 141.75)) : 0;
    const budget = Math.min(100, ply.Health() * 0.15, ply.GetMaxHealth() * 0.1);
    return { Damage: damage, Allowed: drop <= 768 && damage <= budget && damage < ply.Health() };
}
export function diagnostic(reason: ZPBotNavReason, from: number, to: number, height = 0, damage = 0): ZPBotNavigationDiagnostic {
    return { Reason: reason, Phase: "route", From: from, To: to, Height: height, Damage: damage, Path: [] };
}
