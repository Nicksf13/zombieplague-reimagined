export {};

// Configure these on the server before loading a map. See docs/map-environment.md.
const muteAmbient = CreateConVar("zp_map_mute_ambient", "1", FCVAR_ARCHIVE, "");
const lighting = include("sv_map_lighting.lua").lighting;

function isSoundscape(this: void, className: string): boolean {
    return className === "env_soundscape" || className === "env_soundscape_proxy" ||
        className === "env_soundscape_triggerable";
}

// Suppress map sounds before they start, including non-looping ambient_generic
// sounds that Source cannot reliably stop after playback has begun.
hook.Add("EntityKeyValue", "ZPMapEnvironment", (entity, key, value) => {
    const className = entity.GetClass();
    const normalized = key.toLowerCase();
    if (muteAmbient.GetBool()) {
        if (className === "ambient_generic" && normalized === "message")
            // An empty message makes Source remove the entity during Spawn.
            return "common/null.wav";
        if (isSoundscape(className)) {
            // Some BSPs omit StartDisabled entirely. Set the default as well as
            // overriding an explicit value; SetKeyValue does not recurse here.
            entity.SetKeyValue("StartDisabled", "1");
            if (normalized === "startdisabled")
                return "1";
        }
        // Triggerable soundscapes can bypass their own disabled flag in Source.
        // Remove only the audio target; keep the trigger and its other outputs.
        if (className === "trigger_soundscape" && normalized === "soundscape")
            return "";
    }
    if (className === "worldspawn" && normalized === "skyname") {
        const selected = lighting.GetSkybox(value);
        if (selected !== "" && selected !== value)
            return selected;
    }
    return undefined;
});

// Keep entities and their map outputs intact; block only inputs that reactivate
// the ambience or the sun. Other map I/O (doors, objectives, triggers) still runs.
hook.Add("AcceptInput", "ZPMapEnvironment", (entity, input) => {
    const className = entity.GetClass();
    const normalized = input.toLowerCase();
    if (muteAmbient.GetBool()) {
        if (isSoundscape(className) && (normalized === "enable" || normalized === "toggleenabled"))
            return true;
        if (className === "ambient_generic" && (normalized === "playsound" ||
            normalized === "togglesound" || normalized === "volume" || normalized === "fadein"))
            return true;
    }
    if (className === "env_sun" && normalized === "turnon" && lighting.IsNight())
        return true;
    return undefined;
});

function applyEnvironment(this: void): void {
    if (muteAmbient.GetBool()) {
        for (const entity of ents.FindByClass("ambient_generic"))
            entity.Fire("StopSound", "", 0);
        for (const className of ["env_soundscape", "env_soundscape_proxy", "env_soundscape_triggerable"])
            for (const entity of ents.FindByClass(className))
                entity.Fire("Disable", "", 0);
    }
    lighting.ApplyEnvironment();
}

hook.Add("InitPostEntity", "ZPMapEnvironment", applyEnvironment);
hook.Add("PostCleanupMap", "ZPMapEnvironment", applyEnvironment);
// The existing status handshake runs only after the client's entities are ready.
// It also covers players joining a map after the initial lighting broadcast.
hook.Add("ZPPlayerEnvironmentReady", "ZPMapEnvironment", (player) => lighting.SyncPlayer(player));
