export interface SpawnBox { MinX: number; MinY: number; MinZ: number; MaxX: number; MaxY: number; MaxZ: number; }
interface Reservation { Point: GLuaEntity; Box: SpawnBox; }
interface SpawnOccupancyContract {
    BeginSelection(): void;
    Reset(): void;
    Current(ply: ZPServerPlayer): GLuaEntity | undefined;
    IsReserved(ply: ZPServerPlayer, point: GLuaEntity): boolean;
    IsFree(ply: ZPServerPlayer, point: GLuaEntity): boolean;
    HasPlayerOverlap(ply: ZPServerPlayer): boolean;
    Reserve(ply: ZPServerPlayer, point: GLuaEntity): GLuaEntity;
}

export function sameSpawnLocation(first: GLuaEntity, second: GLuaEntity): boolean {
    const a = first.GetPos(), b = second.GetPos();
    return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.z - b.z) < 1;
}

function boxAt(ply: ZPServerPlayer, position: GLuaVector): SpawnBox {
    const [mins, maxs] = ply.GetHull();
    return { MinX: position.x + mins.x, MinY: position.y + mins.y, MinZ: position.z + mins.z,
        MaxX: position.x + maxs.x, MaxY: position.y + maxs.y, MaxZ: position.z + maxs.z };
}

function overlaps(a: SpawnBox, b: SpawnBox): boolean {
    return a.MinX < b.MaxX && a.MaxX > b.MinX && a.MinY < b.MaxY && a.MaxY > b.MinY && a.MinZ < b.MaxZ && a.MaxZ > b.MinZ;
}

export class PlayerSpawnOccupancy implements SpawnOccupancyContract {
    private reservations = new Map<ZPServerPlayer, Reservation>();
    private tick: number | undefined;

    Reset(): void { this.reservations.clear(); this.tick = undefined; }

    BeginSelection(): void {
        const now = CurTime();
        // Engine positions are authoritative on the next tick. Until then,
        // selections must reserve space even before Spawn has moved the player.
        if (this.tick !== now) { this.reservations.clear(); this.tick = now; }
        for (const [owner, reservation] of this.reservations)
            if (!IsValid(owner) || !IsValid(reservation.Point)) this.reservations.delete(owner);
    }

    Current(ply: ZPServerPlayer): GLuaEntity | undefined {
        const point = this.reservations.get(ply)?.Point;
        return point && IsValid(point) && point.IsInWorld() && this.IsFree(ply, point) ? point : undefined;
    }

    IsReserved(ply: ZPServerPlayer, point: GLuaEntity): boolean {
        const candidate = boxAt(ply, point.GetPos());
        for (const [owner, reservation] of this.reservations)
            if (owner !== ply && (sameSpawnLocation(point, reservation.Point) || overlaps(candidate, reservation.Box))) return true;
        return false;
    }

    HasPlayerOverlap(ply: ZPServerPlayer): boolean {
        const actual = boxAt(ply, ply.GetPos());
        return (player.GetAll() as ZPServerPlayer[]).some(other =>
            other !== ply && IsValid(other) && other.Alive() && other.Team() !== TEAM_SPECTATOR &&
            overlaps(actual, boxAt(other, other.GetPos())));
    }

    IsFree(ply: ZPServerPlayer, point: GLuaEntity): boolean {
        if (this.IsReserved(ply, point)) return false;
        const candidate = boxAt(ply, point.GetPos());
        for (const other of player.GetAll() as ZPServerPlayer[]) {
            if (other === ply || !IsValid(other) || !other.Alive() || other.Team() === TEAM_SPECTATOR) continue;
            // A player selected earlier this tick may still report the previous
            // life's position. Their reservation already protects the new one.
            const actual = boxAt(other, other.GetPos()), pending = this.reservations.get(other);
            if (pending && !overlaps(actual, pending.Box)) continue;
            if (overlaps(candidate, actual)) return false;
        }
        return true;
    }

    Reserve(ply: ZPServerPlayer, point: GLuaEntity): GLuaEntity {
        this.reservations.set(ply, { Point: point, Box: boxAt(ply, point.GetPos()) });
        return point;
    }
}
