import type { BotSenses } from "./sv_bot_perception";
const { inspect } = include("sv_bot_weapon_ammo.lua") as typeof import("./sv_bot_weapon_ammo");

export type AmmoPurchaseReason = "inactive" | "unavailable" | "not_needed" | "cannot_refill" | "insufficient" |
    "keep_fighting" | "save_packs" | "cooldown" | "ineffective" | "buy" | "bought" | "rejected";
export interface AmmoPurchaseDecision {
    Reason: AmmoPurchaseReason;
    Depleted: GLuaWeapon[];
    Item?: ZPRegisteredExtraItem;
}
interface PurchaseState { NextCheck: number; Unfilled?: GLuaWeapon[]; FailedItem?: ZPRegisteredExtraItem; }
interface AmmoBuyerContract {
    Decide(ply: ZPServerPlayer, senses: BotSenses): AmmoPurchaseDecision;
    Consider(ply: ZPServerPlayer, senses: BotSenses): AmmoPurchaseReason;
    Reset(ply: ZPServerPlayer): void;
}

/** Equipment utility and available funds drive a purchase through the normal server shop. */
export class BotAmmoBuyer implements AmmoBuyerContract {
    private states = new Map<ZPServerPlayer, PurchaseState>();
    Reset(ply: ZPServerPlayer): void { this.states.delete(ply); }

    Decide(ply: ZPServerPlayer, senses: BotSenses): AmmoPurchaseDecision {
        const result = (Reason: AmmoPurchaseReason): AmmoPurchaseDecision => ({ Reason, Depleted: [] });
        if (!IsValid(ply) || !ply.IsBot() || !ply.IsHuman() || !ply.Alive() || ply.IsFrozen() || RoundManager.GetRoundState() !== ROUND_PLAYING)
            return result("inactive");
        const state = this.states.get(ply);
        if (CurTime() < (state?.NextCheck ?? 0)) return result("cooldown");
        if (typeof ExtraItemsManager === "undefined" || typeof WeaponManager === "undefined" || typeof ZPExtraMenuProtocol === "undefined")
            return result("unavailable");
        const item = ExtraItemsManager.GetItemById(TEAM_HUMANS, "ZPExtraAmmo");
        if (!item || !item.ShouldBeEnabled() || !ZPExtraMenuProtocol.Amount(item.Price) || !item.CanBuy(ply)) return result("unavailable");
        const inventory = ply.GetWeapons().filter(weapon => IsValid(weapon)).map(weapon => inspect(ply, weapon));
        const empty = inventory.filter(entry => entry.Kind === "ranged" && !entry.Ready && !entry.Reloadable);
        if (empty.length === 0) return result("not_needed");
        // The existing item fills only choosable firearms with positive magazine sizes.
        // Buying it cannot rescue a clipless extra weapon, a grenade or a melee tool.
        const depleted = empty.filter(entry => entry.Weapon.GetMaxClip1() > 0 && entry.Weapon.GetPrimaryAmmoType() >= 0 &&
            WeaponManager.IsChoosableWeapon(entry.Weapon.GetClass())).map(entry => entry.Weapon);
        if (depleted.length === 0) return result("cannot_refill");
        if (state?.FailedItem === item && state.Unfilled?.length === depleted.length && depleted.every(weapon => state.Unfilled?.includes(weapon)))
            return result("ineffective");
        const balance = ply.GetAmmoPacks();
        if (!ZPExtraMenuProtocol.Amount(balance) || balance < item.Price) return result("insufficient");
        const alternative = inventory.some(entry => entry.Kind === "ranged" && (entry.Ready || entry.Reloadable));
        if (alternative) {
            const pressured = senses.RecentDamage === true || (senses.Visible && senses.EnemyPosition !== undefined &&
                ply.GetPos().DistToSqr(senses.EnemyPosition) <= 320 * 320);
            if (pressured) return result("keep_fighting");
            if (balance - item.Price < item.Price) return result("save_packs");
        }
        return { Reason: "buy", Depleted: depleted, Item: item };
    }

    Consider(ply: ZPServerPlayer, senses: BotSenses): AmmoPurchaseReason {
        const decision = this.Decide(ply, senses);
        if (decision.Reason === "inactive" || decision.Reason === "cooldown") return decision.Reason;
        let state = this.states.get(ply);
        if (!state) { state = { NextCheck: 0 }; this.states.set(ply, state); }
        state.NextCheck = CurTime() + 1;
        if (decision.Reason === "not_needed") { delete state.Unfilled; delete state.FailedItem; }
        if (decision.Reason !== "buy" || !decision.Item) return decision.Reason;
        state.NextCheck = CurTime() + 10;
        const before = decision.Depleted.map(weapon => ({ Weapon: weapon, Ammo: weapon.GetPrimaryAmmoType(),
            Count: ply.GetAmmoCount(weapon.GetPrimaryAmmoType()) }));
        if (ExtraItemsManager.BuyItem(ply, decision.Item) !== "bought") return "rejected";
        if (!before.some(entry => ply.GetAmmoCount(entry.Ammo) > entry.Count)) {
            state.Unfilled = decision.Depleted; state.FailedItem = decision.Item;
            return "ineffective";
        }
        delete state.Unfilled; delete state.FailedItem;
        return "bought";
    }
}

export const ammoBuyer = new BotAmmoBuyer();
