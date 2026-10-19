// PlayerBindPress cannot suppress Source movement/attack buttons. Filter the user
// command too, without changing the player's engine binds or other gamemodes.
export function IsBindingDown(this: void, key: number): boolean {
    return key <= KEY_LAST ? input.IsKeyDown(key) : input.IsMouseDown(key);
}

export function FilterKeyInput(this: void, command: ZPClientUserCommand, bindings: readonly ZPKeyBinding[]): void {
    const held = bindings.filter(binding => binding.Key !== KEY_NONE && IsBindingDown(binding.Key));
    if (held.length === 0) return;
    const buttons: Record<string, number | undefined> = {
        "+attack": IN_ATTACK, "+attack2": IN_ATTACK2, "+jump": IN_JUMP, "+duck": IN_DUCK,
        "+use": IN_USE, "+reload": IN_RELOAD, "+speed": IN_SPEED, "+walk": IN_WALK,
        "+zoom": IN_ZOOM, "+forward": IN_FORWARD, "+back": IN_BACK,
        "+moveleft": IN_MOVELEFT, "+moveright": IN_MOVERIGHT,
        "+showscores": IN_SCORE, "+left": IN_LEFT, "+right": IN_RIGHT,
    };
    for (const { Key: key } of held) {
        const bind = input.LookupKeyBinding(key);
        if (!bind) continue;
        // A bind may contain several commands. Only remove the inputs it owns.
        for (const part of (input.TranslateAlias(bind) ?? bind).toLowerCase().split(";")) {
            const action = part.trim().split(" ")[0] ?? "";
            const button = buttons[action];
            if (button !== undefined) command.RemoveKey(button);
            if ((action === "+forward" && command.GetForwardMove() > 0) || (action === "+back" && command.GetForwardMove() < 0))
                command.SetForwardMove(0);
            if ((action === "+moveright" && command.GetSideMove() > 0) || (action === "+moveleft" && command.GetSideMove() < 0))
                command.SetSideMove(0);
            if ((action === "+moveup" && command.GetUpMove() > 0) || (action === "+movedown" && command.GetUpMove() < 0))
                command.SetUpMove(0);
            if (action === "impulse") command.SetImpulse(0);
        }
    }
}
