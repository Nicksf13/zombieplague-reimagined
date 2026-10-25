interface ObstacleContract { Capture(players: ZPServerPlayer[]): { Rows: object[]; Limited: boolean }; }
/** Bounded nearby solid-entity context. Static world geometry remains in the map. */
export class BotRecordingObstacles implements ObstacleContract {
    private cursor = 0;
    Capture(players: ZPServerPlayer[]): { Rows: object[]; Limited: boolean } {
        const entities = ents.GetAll(), rows: object[] = [];
        const positions = players.filter(ply => IsValid(ply) && ply.Alive()).slice(0, 128).map(ply => ply.GetPos());
        const count = Math.min(2048, entities.length);
        let limited = entities.length > count;
        for (let i = 0; i < count; i++) {
            const entity = entities[(this.cursor + i) % entities.length];
            if (!entity || !IsValid(entity) || entity.EntIndex() === 0 || entity.IsPlayer() || entity.GetSolid() === 0) continue;
            const position = entity.GetPos(), center = entity.WorldSpaceCenter();
            if (!positions.some(p => center.DistToSqr(p) <= 512 ** 2 || position.DistToSqr(p) <= 512 ** 2)) continue;
            if (rows.length >= 128) { limited = true; break; }
            const angles = entity.GetAngles(), min = entity.OBBMins(), max = entity.OBBMaxs();
            rows.push({ Entity: entity.EntIndex(), Class: entity.GetClass(), Model: (entity.GetModel() ?? "").substring(0, 256),
                Position: [position.x, position.y, position.z], Angles: [angles.p, angles.y, angles.r],
                Mins: [min.x, min.y, min.z], Maxs: [max.x, max.y, max.z], Solid: entity.GetSolid(), Group: entity.GetCollisionGroup() });
        }
        this.cursor = entities.length > 0 ? (this.cursor + count) % entities.length : 0;
        return { Rows: rows, Limited: limited };
    }
}
