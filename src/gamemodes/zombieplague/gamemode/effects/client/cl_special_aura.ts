export {};

function auraMaterial(this: void, name: string, sourcePath: string): GLuaMaterial | undefined {
    // A VMT name can differ from its VTF name (light_glow02_add uses light_glow02).
    // Resolve the source texture instead of treating a material path as a texture.
    const source = Material(sourcePath);
    if (source.IsError()) return;
    const texture = source.GetTexture("$basetexture");
    if (!texture || texture.IsError() || texture.IsErrorTexture()) return;
    // Unlit, additive rendering stays visible in dark maps; depth testing keeps
    // the aura behind geometry regardless of the source material's shader flags.
    const material = CreateMaterial(name, "UnlitGeneric", {
        "$basetexture": texture.GetName(), "$additive": 1, "$vertexcolor": 1,
        "$vertexalpha": 1, "$ignorez": 0, "$nocull": 1,
    });
    // CreateMaterial reuses named materials, including broken ones from before
    // a Lua refresh. Repair the cached texture as well as new material instances.
    material.SetTexture("$basetexture", texture);
    return material;
}

const ribbon = auraMaterial("zp_special_aura_ribbon", "sprites/laserbeam");
const glow = auraMaterial("zp_special_aura_glow", "sprites/light_glow02_add");
const maxDistance = 2560;

function roleColor(this: void, ply: ZPClientPlayer): GLuaColor | undefined {
    if (ply.IsNemesis() && ply.IsZombie()) return NEMESIS_COLOR;
    if (ply.IsSurvivor() && ply.IsHuman()) return SURVIVOR_COLOR;
    return undefined;
}

function drawAura(this: void, ply: ZPClientPlayer, tint: GLuaColor, time: number, opacity: number): void {
    const origin = ply.GetPos(), mins = ply.OBBMins(), maxs = ply.OBBMaxs();
    const height = Math.max(16, maxs.z - mins.z);
    const radius = Math.max(maxs.x - mins.x, maxs.y - mins.y) * 0.6 + 3;
    const centerX = origin.x + (mins.x + maxs.x) * 0.5;
    const centerY = origin.y + (mins.y + maxs.y) * 0.5;
    const phase = time * 2.8 + ply.EntIndex() * 0.73;
    const pulse = (0.8 + Math.sin(time * 5 + ply.EntIndex()) * 0.2) * opacity;
    const outer = Color(tint.r, tint.g, tint.b, 75 * pulse);
    const core = Color(tint.r * 0.7 + 76, tint.g * 0.7 + 76, tint.b * 0.7 + 76, 150 * pulse);

    function point(this: void, fraction: number, strand: number): GLuaVector {
        const angle = phase + fraction * Math.PI * 2.2 + strand * Math.PI * 2 / 3;
        const spread = radius * (0.65 + Math.sin(fraction * Math.PI) * 0.35) +
            Math.sin(time * 7 + fraction * 15 + strand) * 2;
        return Vector(centerX + Math.cos(angle) * spread, centerY + Math.sin(angle) * spread,
            origin.z + mins.z + height * fraction);
    }

    if (ribbon) {
        render.SetMaterial(ribbon);
        for (let strand = 0; strand < 3; strand++) {
            let previous = point(0, strand);
            for (let step = 1; step <= 16; step++) {
                const fraction = step / 16, position = point(fraction, strand);
                const envelope = Math.sin((fraction - 1 / 32) * Math.PI);
                outer.a = 75 * pulse * envelope;
                core.a = 150 * pulse * envelope;
                render.DrawBeam(previous, position, 7 * envelope, fraction - time, fraction + 0.15 - time, outer);
                render.DrawBeam(previous, position, 2 * envelope, fraction - time, fraction + 0.15 - time, core);
                previous = position;
            }
        }
    }

    if (!glow) return;
    render.SetMaterial(glow);
    const bloom = Color(tint.r, tint.g, tint.b, 22 * pulse);
    for (let layer = 1; layer <= 3; layer++) {
        render.DrawSprite(Vector(centerX, centerY, origin.z + mins.z + height * layer / 4),
            radius * 2.8, height * 0.65, bloom);
        const fraction = (time * 0.4 + layer / 3) % 1;
        bloom.a = 110 * pulse * Math.sin(fraction * Math.PI);
        render.DrawSprite(point(fraction, layer), 14, 14, bloom);
        bloom.a = 22 * pulse;
    }
}

hook.Add("PostDrawTranslucentRenderables", "ZPSpecialRoleAura", (depth, skybox) => {
    if (depth || skybox) return;
    const viewer = LocalPlayer();
    if (!IsValid(viewer)) return;
    const eye = EyePos(), time = CurTime();
    for (const entry of player.GetAll()) {
        const ply = entry as ZPClientPlayer;
        if (!IsValid(ply) || !ply.Alive() || ply.IsDormant() || ply.GetNoDraw()) continue;
        if (ply === viewer && !viewer.ShouldDrawLocalPlayer()) continue;
        if (viewer.GetObserverMode() === OBS_MODE_IN_EYE && viewer.GetObserverTarget() === ply) continue;
        const tint = roleColor(ply);
        if (!tint) continue;
        const origin = ply.GetPos();
        const distance = Math.sqrt((eye.x - origin.x) ** 2 + (eye.y - origin.y) ** 2 + (eye.z - origin.z) ** 2);
        if (distance >= maxDistance) continue;
        drawAura(ply, tint, time, Math.min(1, (maxDistance - distance) / 512));
    }
});
