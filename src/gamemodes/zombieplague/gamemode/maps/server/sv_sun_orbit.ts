interface SunSnapshot { entity: GLuaEntity; direction: GLuaVector; }
interface SkySnapshot { entity: ZPSkyPaint; values: Record<string, string>; }

function vectorKey(this: void, vector: GLuaVector): string {
    return `${vector.x} ${vector.y} ${vector.z}`;
}

// env_sun renders from the networked m_vDirection, not its entity position.
// env_skypaint's native Think also follows that direction (see documentation).
export class SunOrbitController implements ZPSunOrbit {
    private originals: SunSnapshot[] = [];
    private createdSun: GLuaEntity | undefined;
    private createdSky: GLuaEntity | undefined;
    private skies: SkySnapshot[] = [];

    private RestoreSkies(): void {
        for (const snapshot of this.skies)
            if (IsValid(snapshot.entity))
                for (const [key, value] of pairs(snapshot.values))
                    snapshot.entity.SetKeyValue(key, value);
        this.skies = [];
    }

    private PaintSky(direction: GLuaVector): void {
        this.skies = this.skies.filter(snapshot => IsValid(snapshot.entity));
        const daylight = Math.max(0, Math.min(1, (direction.z + 0.15) / 1.15));
        const twilight = Math.max(0, 1 - Math.abs(direction.z) / 0.35);
        for (const sky of ents.FindByClass("env_skypaint")) {
            if (!IsValid(sky)) continue;
            if (!this.skies.some(snapshot => snapshot.entity === sky))
                this.skies.push({ entity: sky, values: {
                    topcolor: vectorKey(sky.GetTopColor()), bottomcolor: vectorKey(sky.GetBottomColor()),
                    sunnormal: vectorKey(sky.GetSunNormal()), suncolor: vectorKey(sky.GetSunColor()),
                    duskintensity: tostring(sky.GetDuskIntensity()), starfade: tostring(sky.GetStarFade()) } });
            // Native KeyValue updates env_skypaint's replicated NetworkVars.
            sky.SetKeyValue("sunnormal", vectorKey(direction));
            sky.SetKeyValue("topcolor", vectorKey(Vector(0.005 + daylight * 0.195,
                0.008 + daylight * 0.492, 0.02 + daylight * 0.98)));
            sky.SetKeyValue("bottomcolor", vectorKey(Vector(0.015 + daylight * 0.785 + twilight * 0.25,
                0.02 + daylight * 0.98 + twilight * 0.08, 0.04 + daylight * 0.96)));
            sky.SetKeyValue("suncolor", vectorKey(Vector(daylight * 0.2 + twilight * 0.4,
                daylight * 0.1 + twilight * 0.08, 0)));
            sky.SetKeyValue("duskintensity", tostring(twilight));
            sky.SetKeyValue("starfade", tostring((1 - daylight) * 1.5));
        }
    }

    Update(seconds: number | undefined, proceduralSky: boolean): void {
        if (seconds === undefined) {
            this.Restore();
            return;
        }
        const suns = ents.FindByClass("env_sun").filter(entity => IsValid(entity));
        if (suns.length === 0) {
            const sun = ents.Create("env_sun");
            if (IsValid(sun)) {
                sun.SetKeyValue("rendercolor", "255 240 210");
                sun.Spawn();
                sun.Activate();
                this.createdSun = sun;
                suns.push(sun);
            }
        }
        this.originals = this.originals.filter(snapshot => IsValid(snapshot.entity));
        const phase = seconds / 86400 * Math.PI * 2 - Math.PI / 2;
        const direction = Vector(Math.cos(phase), 0, Math.sin(phase));
        for (const sun of suns) {
            if (sun !== this.createdSun && !this.originals.some(snapshot => snapshot.entity === sun)) {
                const original = sun.GetInternalVariable("m_vDirection");
                if (original)
                    this.originals.push({ entity: sun, direction: Vector(original.x, original.y, original.z) });
            }
            sun.SetSaveValue("m_vDirection", direction);
        }
        if (proceduralSky && ents.FindByClass("env_skypaint").length === 0) {
            const sky = ents.Create("env_skypaint");
            if (IsValid(sky)) {
                sky.Spawn();
                sky.Activate();
                this.createdSky = sky;
            }
        }
        if (proceduralSky) this.PaintSky(direction);
        else this.RestoreSkies();
    }

    Restore(): void {
        this.RestoreSkies();
        for (const snapshot of this.originals)
            if (IsValid(snapshot.entity))
                snapshot.entity.SetSaveValue("m_vDirection", snapshot.direction);
        this.originals = [];
        if (this.createdSun && IsValid(this.createdSun)) this.createdSun.Remove();
        if (this.createdSky && IsValid(this.createdSky)) this.createdSky.Remove();
        this.createdSun = undefined;
        this.createdSky = undefined;
    }
}

hook.Run("ZPResetSunOrbit");
export const orbit = new SunOrbitController();
hook.Add("ZPResetSunOrbit", "ZPMapEnvironment", () => orbit.Restore());
hook.Add("ShutDown", "ZPSunOrbit", () => orbit.Restore());
