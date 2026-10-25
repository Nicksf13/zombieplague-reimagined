import type { BotSenses } from "./sv_bot_perception";
import type { WeaponAmmo } from "./sv_bot_weapon_ammo";
const { inspect } = include("sv_bot_weapon_ammo.lua") as typeof import("./sv_bot_weapon_ammo");
const { ammoBuyer } = include("sv_bot_ammo_purchase.lua") as typeof import("./sv_bot_ammo_purchase");

export interface WeaponDecision {
    Weapon?: GLuaWeapon;
    Ready: boolean;
    Ranged: boolean;
    Reload: boolean;
    Withdraw: boolean;
}
interface PendingSwitch { Weapon: GLuaWeapon; Started: number; RetryAt: number; }
interface WeaponControlState {
    Pending?: PendingSwitch;
    ReturnTo?: GLuaWeapon;
    HoldUntil: number;
    ReloadAt: number;
    Failed: Map<GLuaWeapon, number>;
}
interface WeaponControllerContract {
    Assess(ply: ZPServerPlayer, senses: BotSenses): WeaponDecision;
    Apply(ply: ZPServerPlayer, command: GLuaUserCommand, senses: BotSenses): WeaponExecution;
    Reset(ply: ZPServerPlayer): void;
}
interface WeaponExecution { Decision: WeaponDecision; Gate?: string; Purchased: boolean; }

/** Only requests normal player input. Never creates ammunition, weapons or completed reloads. */
export class BotWeaponController implements WeaponControllerContract {
    private states = new Map<ZPServerPlayer, WeaponControlState>();
    Reset(ply: ZPServerPlayer): void { this.states.delete(ply); ammoBuyer.Reset(ply); }

    private Inventory(ply: ZPServerPlayer, state?: WeaponControlState): WeaponAmmo[] {
        const now = CurTime();
        return ply.GetWeapons().filter(weapon => IsValid(weapon) && (state?.Failed.get(weapon) ?? 0) <= now).map(weapon => inspect(ply, weapon));
    }
    private Danger(ply: ZPServerPlayer, senses: BotSenses): boolean {
        return senses.RecentDamage === true || (senses.Visible && senses.EnemyPosition !== undefined &&
            ply.GetPos().DistToSqr(senses.EnemyPosition) <= 320 * 320);
    }
    Assess(ply: ZPServerPlayer, senses: BotSenses): WeaponDecision {
        const state = this.states.get(ply), inventory = this.Inventory(ply, state), active = ply.GetActiveWeapon();
        const current = inventory.find(entry => entry.Weapon === active), danger = this.Danger(ply, senses);
        const loaded = inventory.find(entry => entry.Kind === "ranged" && entry.Ready);
        const reloadable = inventory.find(entry => entry.Reloadable);
        const withdraw = senses.EnemyPosition !== undefined && !loaded && (danger || !reloadable);
        let chosen: WeaponAmmo | undefined;
        const pending = inventory.find(entry => entry.Weapon === state?.Pending?.Weapon);
        if (pending && (pending.Ready || pending.Reloadable)) chosen = pending;
        const returning = inventory.find(entry => entry.Weapon === state?.ReturnTo && (entry.Ready || entry.Reloadable));
        if (!chosen && returning && !danger && CurTime() >= (state?.HoldUntil ?? 0)) chosen = returning;
        if (!chosen && current?.Kind === "ranged" && (current.Ready || (current.Reloadable && !danger))) chosen = current;
        chosen ??= loaded ?? (current?.Reloadable ? current : reloadable) ??
            (current?.Kind === "melee" ? current : inventory.find(entry => entry.Kind === "melee"));
        return { ...(chosen ? { Weapon: chosen.Weapon } : {}), Ready: chosen?.Ready === true,
            Ranged: chosen?.Kind === "ranged", Reload: chosen?.Reloadable === true && !chosen.Ready, Withdraw: withdraw };
    }

    Apply(ply: ZPServerPlayer, command: GLuaUserCommand, senses: BotSenses): WeaponExecution {
        const now = CurTime();
        const purchased = ammoBuyer.Consider(ply, senses) === "bought";
        let state = this.states.get(ply);
        if (!state) { state = { HoldUntil: 0, ReloadAt: 0, Failed: new Map() }; this.states.set(ply, state); }
        const active = ply.GetActiveWeapon();
        for (const [weapon, until] of state.Failed) if (!IsValid(weapon) || now >= until) state.Failed.delete(weapon);
        if (state.ReturnTo && (!IsValid(state.ReturnTo) || !ply.GetWeapons().includes(state.ReturnTo))) delete state.ReturnTo;
        if (state.Pending) {
            const pending = state.Pending, ammo = inspect(ply, pending.Weapon);
            if (active === pending.Weapon) {
                delete state.Pending; state.HoldUntil = now + 0.6;
            } else if (!ply.GetWeapons().includes(pending.Weapon) || (!ammo.Ready && !ammo.Reloadable) || now - pending.Started >= 1.5) {
                state.Failed.set(pending.Weapon, now + 3); delete state.Pending;
            }
        }
        if (!state.Pending && state.ReturnTo === active) delete state.ReturnTo;
        const decision = this.Assess(ply, senses), desired = decision.Weapon;
        const finish = (Gate?: string): WeaponExecution => ({ Decision: decision, Purchased: purchased, ...(Gate ? { Gate } : {}) });
        if (!desired) return finish("no_usable_weapon");
        if (desired !== active) {
            if (!state.Pending || state.Pending.Weapon !== desired) {
                const current = inspect(ply, active);
                if (!state.ReturnTo && current.Kind === "ranged" && current.Reloadable) state.ReturnTo = active;
                state.Pending = { Weapon: desired, Started: now, RetryAt: now };
            }
            if (now >= state.Pending.RetryAt) { command.SelectWeapon(desired); state.Pending.RetryAt = now + 0.4; }
            return finish("weapon_switch");
        }
        if (decision.Reload) {
            // A short pulse preserves normal reload handling without holding reload every engine tick.
            if (now >= state.ReloadAt) { state.ReloadAt = now + 0.8; return finish("reload_pressed"); }
            return finish("reload");
        }
        return finish(!decision.Ready ? "no_ammunition" : undefined);
    }
}

export const weapons = new BotWeaponController();
