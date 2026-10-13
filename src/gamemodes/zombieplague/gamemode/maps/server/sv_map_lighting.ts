interface LightingState {
    readonly pattern: string;
    readonly exposure: number;
    readonly night: boolean;
    readonly seconds?: number;
}

const sunOrbit = include("sv_sun_orbit.lua").orbit;

export class MapLightingServer implements ZPMapLightingServer {
    private readonly night = CreateConVar("zp_map_night", "1", FCVAR_ARCHIVE, "");
    private readonly skybox = CreateConVar("zp_map_skybox", "", FCVAR_ARCHIVE, "");
    private readonly brightness = CreateConVar("zp_map_night_brightness", "c", FCVAR_ARCHIVE, "");
    private readonly exposure = CreateConVar("zp_map_night_exposure", "100", FCVAR_ARCHIVE, "");
    private readonly cycle = CreateConVar("zp_map_day_cycle", "0", FCVAR_ARCHIVE, "");
    private originalSkybox: string | undefined;
    private appliedSkybox: string | undefined;
    private appliedNight: boolean | undefined;
    private appliedPattern: string | undefined;
    private appliedExposure: number | undefined;
    private ready = false;

    constructor() {
        util.AddNetworkString("ZPRefreshMapLighting");
        for (const name of ["zp_map_night", "zp_map_day_cycle"])
            cvars.AddChangeCallback(name, () => this.Schedule(true), "ZPMapEnvironment");
        cvars.AddChangeCallback("zp_map_night_brightness", () => {
            if (this.IsEnabled()) this.Schedule(true);
        }, "ZPMapEnvironment");
        cvars.AddChangeCallback("zp_map_night_exposure", () => {
            if (this.IsEnabled()) this.Schedule(false);
        }, "ZPMapEnvironment");
        cvars.AddChangeCallback("zp_map_skybox", () => this.Schedule(false), "ZPMapEnvironment");
        timer.Create("ZPMapDayCycle", 30, 0, () => {
            if (this.ready && this.cycle.GetBool()) this.Apply(false);
        });
        timer.Create("ZPMapSunOrbit", 1, 0, () => {
            if (this.ready && this.cycle.GetBool()) this.ApplySkyAndSun(this.State());
        });
    }

    private IsEnabled(): boolean { return this.night.GetBool() || this.cycle.GetBool(); }

    private NightPattern(): string {
        // Keep DynamicLight compatible; never use the engine's broken "a" style.
        const configured = this.brightness.GetString();
        return configured.length === 1 && configured >= "b" && configured <= "m" ? configured : "c";
    }

    private NightExposure(): number {
        const configured = tonumber(this.exposure.GetString());
        return configured !== undefined && configured === configured ?
            Math.max(0, Math.min(100, configured)) / 100 : 1;
    }

    private State(): LightingState {
        if (!this.cycle.GetBool())
            return this.night.GetBool() ?
                { pattern: this.NightPattern(), exposure: this.NightExposure(), night: true } :
                { pattern: "m", exposure: 1, night: false };
        // Read wall-clock time on every update, including after empty-server
        // hibernation. Client clocks and game speed never drive this cycle.
        const clock = os.date("*t");
        const seconds = clock.hour * 3600 + clock.min * 60 + clock.sec;
        const solarDaylight = (1 - Math.cos(seconds / 86400 * Math.PI * 2)) / 2;
        // Twilight should already feel dark. Preserve smooth midnight/noon
        // endpoints while reducing the daylight contribution near sunset.
        const daylight = solarDaylight * solarDaylight;
        const index = "bcdefghijklm".indexOf(this.NightPattern());
        const minimum = (0.25 + index / 11 * 0.75) * this.NightExposure();
        // Keep the client multiplier continuous; the engine style is quantized
        // separately when updating static-prop lighting.
        return { pattern: "m", exposure: minimum + (1 - minimum) * daylight,
            night: seconds < 6 * 3600 || seconds >= 18 * 3600, seconds };
    }

    IsNight(): boolean { return this.State().night; }

    GetSkybox(original?: string): string {
        if (original !== undefined && this.originalSkybox === undefined) {
            this.originalSkybox = original;
            // The unmodified sky is already present; do not touch disabled maps.
            this.appliedSkybox = original;
        }
        return this.SelectedSkybox(this.State());
    }

    private SelectedSkybox(state: LightingState): string {
        const configured = this.skybox.GetString();
        return configured !== "" ? configured : this.cycle.GetBool() ? "painted" :
            state.night ? "sky_borealis01" : this.originalSkybox ?? "";
    }

    private ApplySkyAndSun(state: LightingState): void {
        // Creation must wait for InitPostEntity; convar callbacks may run earlier.
        if (this.ready) sunOrbit.Update(state.seconds, this.skybox.GetString() === "");
        const selected = this.SelectedSkybox(state);
        if (selected !== "" && selected !== this.appliedSkybox) {
            RunConsoleCommand("sv_skyname", selected);
            this.appliedSkybox = selected;
        }
        if (state.night !== this.appliedNight) {
            if (state.night || this.cycle.GetBool() || this.appliedNight !== undefined)
                for (const entity of ents.FindByClass("env_sun"))
                    entity.Fire(state.night ? "TurnOff" : "TurnOn", "", 0);
            this.appliedNight = state.night;
        }
    }

    private Send(state: LightingState, refresh: boolean, player?: ZPPlayer): void {
        // Preserve the existing 49-bit protocol for fixed and clock-driven modes.
        net.Start("ZPRefreshMapLighting");
        net.WriteString(state.pattern);
        net.WriteFloat(state.exposure);
        net.WriteBool(refresh);
        if (player) net.Send(player);
        else net.Broadcast();
    }

    private Apply(refresh: boolean): void {
        const state = this.State();
        this.ApplySkyAndSun(state);
        // Static props retain baked vertex lighting. Material/model overrides
        // alone cannot update that cache. Quantize only the engine style, keeping
        // the continuous multiplier in the existing client packet.
        const enginePattern = this.cycle.GetBool() ?
            "bcdefghijklm".charAt(Math.floor(state.exposure * 11)) : state.pattern;
        const rebuild = refresh || enginePattern !== this.appliedPattern;
        if (rebuild) engine.LightStyle(0, enginePattern);
        if (rebuild || state.exposure !== this.appliedExposure)
            this.Send(state, rebuild);
        this.appliedPattern = enginePattern;
        this.appliedExposure = state.exposure;
    }

    private Schedule(refresh: boolean): void {
        timer.Create(refresh ? "ZPApplyMapLighting" : "ZPMapNightExposure", 0.2, 1,
            () => this.Apply(refresh));
    }

    ApplyEnvironment(): void {
        this.ready = true;
        // Cleanup respawns the sun, so reapply its current state even at the same hour.
        this.appliedNight = undefined;
        this.ApplySkyAndSun(this.State());
        if (this.IsEnabled() || this.appliedPattern !== undefined) this.Apply(true);
    }

    SyncPlayer(player: ZPPlayer): void {
        if (this.ready && this.cycle.GetBool()) this.Apply(false);
        this.Send(this.State(), true, player);
    }
}

export const lighting = new MapLightingServer();
