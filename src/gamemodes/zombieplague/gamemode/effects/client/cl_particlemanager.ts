export class ClientParticleEffectManager implements ZPClientParticleManager {
    EmitParticleEffect(explosion: ZPClientExplosion): void {
        const emitter = ParticleEmitter(explosion.Pos);
        if (!emitter)
            return;
        for (const info of explosion.ParticleInformations) {
            const particle = emitter.Add(info.File, explosion.Pos);
            if (!particle)
                continue;
            particle.SetVelocity(info.Velocity);
            particle.SetDieTime(info.DieTime);
            particle.SetStartAlpha(info.StartAlpha);
            particle.SetEndAlpha(info.EndAlpha);
            particle.SetStartSize(info.StartSize);
            particle.SetEndSize(info.EndSize);
            particle.SetColor(info.Color.r, info.Color.g, info.Color.b);
            particle.SetAirResistance(100);
            particle.SetCollide(true);
        }
        emitter.Finish();
    }
}
const particleEffectManager = new ClientParticleEffectManager();
_G.ParticleEffectManager = particleEffectManager;
net.Receive("SendParticleEffectInformation", () => {
    const packet = ZPClientData.Record(net.ReadTable());
    if (!packet || !isvector(packet.Pos))
        return;
    const rawParticles = ZPClientData.Record(packet.ParticleInformations);
    if (!rawParticles)
        return;
    const particles: ZPClientParticleInfo[] = [];
    for (const [, raw] of pairs(rawParticles)) {
        const info = ZPClientData.Record(raw);
        if (!info)
            continue;
        const color = ZPClientData.Record(info.Color);
        if (typeof info.File !== "string" || !isvector(info.Velocity) || !isvector(info.Gravity) ||
            typeof info.DieTime !== "number" || typeof info.StartAlpha !== "number" || typeof info.EndAlpha !== "number" ||
            typeof info.StartSize !== "number" || typeof info.EndSize !== "number" || !color ||
            typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number")
            continue;
        particles.push({ File: info.File, Velocity: info.Velocity, Gravity: info.Gravity, DieTime: info.DieTime,
            StartAlpha: info.StartAlpha, EndAlpha: info.EndAlpha, StartSize: info.StartSize, EndSize: info.EndSize,
            Color: Color(color.r, color.g, color.b) });
    }
    particleEffectManager.EmitParticleEffect({ Pos: packet.Pos, ParticleInformations: particles });
});
