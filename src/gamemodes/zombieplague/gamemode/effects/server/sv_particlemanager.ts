export class ServerParticleEffectManager implements ZPServerParticleManager {
    EmitExplosion(amount: number, color: GLuaColor, position: GLuaVector): void {
        const explosion: ZPExplosion = { Pos: position, ParticleInformations: [] };
        for (let i = 0; i < amount; i++)
            explosion.ParticleInformations.push(this.CreateExplosionParticleEffect(color));
        this.EmitParticleEffect(explosion);
    }
    CreateExplosionParticleEffect(color: GLuaColor): ZPParticleInfo {
        const x = math.random(-250, 250), y = math.random(-250, 250);
        return { File: "particle/smokesprites_000" + math.random(1, 9), Gravity: Vector(0, 0, -250),
            Velocity: Vector(x, y, 0), DieTime: math.Rand(5, 10), StartAlpha: 40, EndAlpha: 0,
            StartSize: 100, EndSize: 20, Color: color };
    }
    EmitParticleEffect(explosion: ZPExplosion): void {
        net.Start("SendParticleEffectInformation");
        net.WriteTable(explosion);
        net.Broadcast();
    }
}
const particleEffectManager = new ServerParticleEffectManager();
_G.ParticleEffectManager = particleEffectManager;
util.AddNetworkString("SendParticleEffectInformation");
