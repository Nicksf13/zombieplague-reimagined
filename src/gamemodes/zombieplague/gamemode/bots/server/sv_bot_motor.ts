import type { BotSenses } from "./sv_bot_perception";
import type { BotSteering } from "./sv_bot_navigation";
import type { Intervention, MovementRequest } from "./sv_bot_experience_trace";
import type { MotorExecution } from "./sv_bot_execution";
const { drive } = include("sv_bot_precision_support.lua") as typeof import("./sv_bot_precision_support");
const { weapons } = include("sv_bot_weapons.lua") as typeof import("./sv_bot_weapons");
export function resetWeapons(ply: ZPServerPlayer): void { weapons.Reset(ply); }
export interface BotPlan {
    Senses: BotSenses; Steering: BotSteering; Action: ZPBotAction; ReadyAt: number; Updated: number;
    Goal?: GLuaVector;
    Look?: GLuaVector;
    Boost?: string;
    DefensiveLook?: GLuaVector;
    JumpIssued?: boolean; Wait?: boolean;
    WithdrawForAmmo?: boolean;
    LastVisibleAt?: number;
    DecisionID?: string; MotionID?: string; StageID?: string; Requested?: MovementRequest; Interventions?: Intervention[];
}
const ranges: Record<ZPBotProfile, number> = { aggressive: 240, cooperative: 430, defensive: 550, cautious: 700 };

export interface DestinationRequest { Goal: GLuaVector | undefined; Move: string; Interventions: Intervention[]; ArrivalTolerance?: number; Withdraw?: boolean; }
function meleeDistance(weapon: GLuaWeapon): number {
    const reach = IsValid(weapon) ? weapon.HitDistance : undefined;
    return typeof reach === "number" && Number.isFinite(reach) && reach >= 16 && reach <= 256 ? reach : 40;
}
export function request(ply: ZPServerPlayer, senses: BotSenses, action: ZPBotAction, profile: ZPBotProfile): DestinationRequest {
    const interventions: Intervention[] = [];
    const result = (goal: GLuaVector | undefined, move: string): DestinationRequest => ({ Goal: goal, Move: move, Interventions: interventions });
    const position = ply.GetPos(), enemy = senses.EnemyPosition;
    const ammunition = ply.IsHuman() ? weapons.Assess(ply, senses) : undefined;
    if (enemy && ammunition?.Withdraw) {
        const dx = enemy.x - position.x, dy = enemy.y - position.y, distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const ally = senses.AllyPosition;
        const goal = ally && position.DistToSqr(ally) > 160 * 160 && ally.DistToSqr(enemy) > position.DistToSqr(enemy) ? ally :
            Vector(position.x - dx / distance * 280, position.y - dy / distance * 280, position.z);
        interventions.push({ Controller: "weapons", Reason: "withdraw_without_loaded_firearm", Tactical: true, Motion: false });
        return { ...result(goal, "withdraw_for_ammo"), Withdraw: true };
    }
    if (enemy && !senses.Visible && ply.IsZombie() && action !== "retreat" && action !== "group") return result(enemy, "remembered_pursuit");
    if (action === "group" && senses.AllyPosition && position.DistToSqr(senses.AllyPosition) > 180 * 180) {
        const leaving = ply.IsZombie() && senses.Enemies <= senses.Allies + 1 && !senses.RecentDamage && ply.Health() / Math.max(1, ply.GetMaxHealth()) >= 0.65 && enemy && senses.Visible &&
            senses.AllyPosition.DistToSqr(enemy) > position.DistToSqr(enemy);
        if (!leaving) return result(senses.AllyPosition, "follow_ally");
    }
    if (!enemy) return result(undefined, "none");
    if (action === "group") interventions.push({ Controller: "cohesion", Reason: "group_destination_unavailable_or_satisfied", Tactical: true, Motion: false });
    const dx = enemy.x - position.x, dy = enemy.y - position.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy)), reach = Math.sqrt(position.DistToSqr(enemy));
    const weapon = ply.GetActiveWeapon();
    const melee = ply.IsZombie() || (ammunition ? !ammunition.Ranged : IsValid(weapon) && weapon.GetMaxClip1() <= 0);
    const desired = melee ? Math.max(34, meleeDistance(weapon) * 0.65) : ranges[profile];
    if (action === "retreat" || (!ply.IsZombie() && !senses.Visible) || (!melee && distance < desired * 0.65)) {
        if (action !== "retreat") interventions.push({ Controller: "range", Reason: "close_range_separation", Tactical: true, Motion: false });
        return result(Vector(position.x - dx / distance * 280, position.y - dy / distance * 280, position.z), "withdraw");
    }
    if (melee && (reach > desired || Math.abs(enemy.z - position.z) > 48)) {
        if (action !== "attack") interventions.push({ Controller: "melee", Reason: "melee_requires_approach", Tactical: true, Motion: false });
        return { ...result(enemy, "approach"), ArrivalTolerance: desired };
    }
    if (action === "attack" && reach > desired) return result(enemy, "pursue");
    // Defending still dodges; different bots alternate sides at different times.
    const side = (Math.floor(CurTime() / 2) + ply.EntIndex()) % 2 === 0 ? 1 : -1;
    const dodge = melee ? 20 : 100;
    return result(Vector(position.x - dy / distance * dodge * side, position.y + dx / distance * dodge * side, position.z), "dodge");
}
export function destination(ply: ZPServerPlayer, senses: BotSenses, action: ZPBotAction, profile: ZPBotProfile): GLuaVector | undefined {
    return request(ply, senses, action, profile).Goal;
}

function normalize(degrees: number): number { return ((degrees + 180) % 360 + 360) % 360 - 180; }
function approach(current: number, target: number, speed: number): number {
    return current + Math.max(-speed, Math.min(speed, normalize(target - current)));
}

export function apply(ply: ZPServerPlayer, command: GLuaUserCommand, plan: BotPlan, id: number, combat = true,
    observe?: (this: void, execution: MotorExecution) => void): number {
    const interventions = [...(plan.Interventions ?? [])];
    const defensive = !plan.Senses.Visible ? plan.DefensiveLook : undefined;
    if (defensive) interventions.push({ Controller: "damage_guard", Reason: "orient_to_observed_threat", Tactical: true, Motion: false });
    const origin = ply.EyePos();
    const pick = plan.Steering.Pick, moveTarget = plan.Steering.Position;
    const aim = pick?.Aim ?? (plan.Senses.Visible ? plan.Senses.AimPosition : undefined) ?? plan.Look ?? defensive ?? (moveTarget ? Vector(moveTarget.x, moveTarget.y, origin.z) : undefined);
    let angles = ply.EyeAngles();
    if (aim) {
        const dx = aim.x - origin.x, dy = aim.y - origin.y, dz = aim.z - origin.z;
        const desiredYaw = math.atan2(dy, dx) * 180 / Math.PI;
        const desiredPitch = -math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * 180 / Math.PI;
        const error = plan.Senses.Visible && !pick?.Aim && !plan.DefensiveLook ? Math.sin(CurTime() * 2 + id) * (1.5 + id % 3) : 0;
        const step = Math.min(0.1, engine.TickInterval()) * 220;
        angles = Angle(Math.max(-89, Math.min(89, approach(angles.p, desiredPitch, step))), approach(angles.y, desiredYaw + error, step), 0);
        command.SetViewAngles(angles); ply.SetEyeAngles(angles);
    }
    let buttons = 0;
    let attackGate = !combat ? "combat_disabled" : !plan.Senses.Visible ? "no_visible_target" :
        CurTime() < plan.ReadyAt ? "reaction_wait" : "missing_aim_or_target";
    let issuedForward = 0, issuedSide = 0;
    const finish = (): number => {
        command.SetButtons(buttons); if (pick) pick.Keys = buttons;
        const yaw = angles.y * Math.PI / 180;
        observe?.({ AttackGate: attackGate, Interventions: interventions, Commanded: { Forward: issuedForward, Side: issuedSide, Keys: buttons, Yaw: angles.y,
            WorldX: issuedForward * Math.cos(yaw) + issuedSide * Math.sin(yaw), WorldY: issuedForward * Math.sin(yaw) - issuedSide * Math.cos(yaw) } });
        return buttons;
    };
    if (pick) pick.Look = angles.p;
    const position = ply.GetPos(), move = plan.Steering.Position;
    const precision = plan.Steering.Precision === true || pick?.Precision === true;
    if (move) {
        const dx = move.x - position.x, dy = move.y - position.y, length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const yaw = angles.y * Math.PI / 180;
        const drain = ply.IsHuman() && RunShouldDrain(ply) && cvars.Number("zp_run_drain", 1) > 0;
        const sprint = !precision && (pick?.Sprint ?? (plan.WithdrawForAmmo || plan.Action === "retreat" || (ply.IsZombie() && plan.Action === "attack"))) &&
            (!drain || ply.GetBreath() >= Math.max(10, ply.GetMaxBreath() * 0.2));
        const speed = Math.min(sprint ? ply.GetRunSpeed() : ply.GetWalkSpeed(), pick?.SpeedLimit ?? Infinity);
        if (pick?.Sprint && !sprint) interventions.push({ Controller: "stamina", Reason: "sprint_not_eligible", Tactical: false, Motion: true });
        let forward = (dx * Math.cos(yaw) + dy * Math.sin(yaw)) / length * speed, side = (dx * Math.sin(yaw) - dy * Math.cos(yaw)) / length * speed;
        if (precision) {
            const input = ply.OnGround() ? drive(ply, move, speed, plan.Steering.Duck, pick?.EdgeRecovery) : Vector(0, 0, 0);
            forward = input.x * Math.cos(yaw) + input.y * Math.sin(yaw);
            side = input.x * Math.sin(yaw) - input.y * Math.cos(yaw);
            if (dx * input.x + dy * input.y <= 0 && length > 4) interventions.push({ Controller: "precision", Reason: "braking_or_unsafe_support", Tactical: false, Motion: true });
        }
        if (pick?.Action === "climb" && ply.GetMoveType() === MOVETYPE_LADDER && pick.Aim) {
            const desired = math.atan2(pick.Aim.y - origin.y, pick.Aim.x - origin.x) * 180 / Math.PI;
            forward = Math.abs(normalize(desired - angles.y)) <= 55 ? speed : 0; side = 0;
            if (forward === 0) interventions.push({ Controller: "ladder", Reason: "alignment_wait", Tactical: false, Motion: true });
        }
        command.SetForwardMove(forward); command.SetSideMove(side);
        issuedForward = forward; issuedSide = side;
        if (forward > 1) buttons += IN_FORWARD; else if (forward < -1) buttons += IN_BACK;
        if (side > 1) buttons += IN_MOVERIGHT; else if (side < -1) buttons += IN_MOVELEFT;
        if (sprint) buttons += IN_SPEED;
        if (plan.Steering.Jump && (ply.WaterLevel() >= 2 || (!plan.JumpIssued && ply.OnGround() && CurTime() - plan.Updated < 0.12))) { buttons += IN_JUMP; plan.JumpIssued = true; }
        else if (plan.Steering.Jump && !plan.JumpIssued && ply.OnGround()) interventions.push({ Controller: "motor", Reason: "jump_plan_expired", Tactical: false, Motion: true });
        if (plan.Steering.Duck) buttons += IN_DUCK;
    }
    if (!move && precision && ply.OnGround()) {
        const input = drive(ply, undefined, 0, plan.Steering.Duck), yaw = angles.y * Math.PI / 180;
        const forward = input.x * Math.cos(yaw) + input.y * Math.sin(yaw), side = input.x * Math.sin(yaw) - input.y * Math.cos(yaw);
        command.SetForwardMove(forward); command.SetSideMove(side);
        issuedForward = forward; issuedSide = side;
        if (forward > 1) buttons += IN_FORWARD; else if (forward < -1) buttons += IN_BACK;
        if (side > 1) buttons += IN_MOVERIGHT; else if (side < -1) buttons += IN_MOVELEFT;
    }
    if (plan.Steering.Use) buttons += IN_USE;
    if (!move && plan.Steering.Duck) buttons += IN_DUCK;
    if (!combat) { weapons.Reset(ply); return finish(); }
    const weapon = ply.GetActiveWeapon();
    let ranged = ply.IsHuman() && IsValid(weapon) && weapon.GetMaxClip1() > 0;
    if (ply.IsHuman()) {
        const control = weapons.Apply(ply, command, plan.Senses);
        if (control.Purchased) interventions.push({ Controller: "weapons", Reason: "ammo_purchase", Tactical: true, Motion: false });
        ranged = control.Decision.Ranged;
        if (control.Gate) {
            attackGate = control.Gate === "reload_pressed" ? "reload" : control.Gate;
            if (control.Gate === "reload_pressed") buttons += IN_RELOAD;
            interventions.push({ Controller: "weapons", Reason: attackGate, Tactical: true, Motion: false });
            return finish();
        }
    }
    if (!IsValid(weapon)) attackGate = "invalid_weapon";
    if (!ply.IsHuman() && IsValid(weapon) && weapon.GetMaxClip1() > 0 && weapon.Clip1() === 0) {
        buttons += IN_RELOAD; attackGate = "reload"; return finish();
    }
    if (IsValid(weapon) && plan.Senses.Visible && CurTime() >= plan.ReadyAt && plan.Senses.AimPosition && plan.Senses.Target) {
        const target = plan.Senses.Target;
        attackGate = "target_invalid_dead_or_friendly";
        if (IsValid(target) && target.Alive() && target.Team() !== ply.Team()) {
            const trace = util.TraceLine({ start: origin, endpos: plan.Senses.AimPosition, filter: ply, mask: MASK_SHOT });
            const direction = angles.Forward(), point = plan.Senses.AimPosition;
            const dx = point.x - origin.x, dy = point.y - origin.y, dz = point.z - origin.z;
            const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
            const aligned = (dx * direction.x + dy * direction.y + dz * direction.z) / distance > 0.985;
            // Alternate presses allow semi-automatic SWEPs to fire through their normal code.
            attackGate = trace.Hit && trace.Entity !== target ? "line_of_fire_blocked" : !aligned ? "aim_alignment" :
                !ranged && distance >= meleeDistance(weapon) + 32 ? "outside_melee_envelope" : Math.floor(CurTime() * 12) % 2 !== 0 ? "alternating_press" : "issued";
            if (attackGate === "issued") buttons += IN_ATTACK;
        }
    }
    return finish();
}
