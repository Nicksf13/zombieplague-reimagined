# Player key bindings

The main menu's **Settings** page contains a **Keys** section alongside themes
and **Always run**. Click an action's current key, then press a keyboard key or
mouse button (Mouse1–Mouse5, including the middle wheel click). Wheel scrolling
is not a supported binding.
Changes save immediately. Escape cancels capture; the restore button reinstates
F4 for the main menu, F3 for night vision, T for the class ability, and G for the
emote wheel. Hold the emote key, point at an entry, and release to perform it.
See [player emotes](dancing.md) for selection, camera, and cancellation rules.

Each key belongs to one gamemode action. Assigning a key already used by another
action swaps their keys. Capturing, switching themes, and closing a menu do not
activate an action. A newly assigned key must be released before it can activate
its action. Escape and the console key cannot be assigned.

## Runtime contract

- `KeyManager` owns bindings, validation, duplicate resolution, and persistence
  in `DATA/zombieplague/keybinding.json`. Existing valid settings and the legacy
  `WeaponMenu` preference are merged with registered defaults.
- Settings snapshots expose detached binding rows and the action awaiting input.
  The themed presentation owns keyboard focus only while capturing a key.
  A transparent capture layer consumes the assignment click, so binding a mouse
  button cannot also activate another menu control. Keyboard and physical mouse
  buttons use their respective input APIs for activation and command filtering.
- Actions fire once per press. The emote action opens a wheel that watches the
  initiating physical key until release, including Mouse1–Mouse5. Its stored
  action ID remains `Dance` so existing preferences keep their assigned key.
  Other gamemode actions are suppressed while selecting an emote.
  Chat, console, the game UI, and focused Derma
  editors retain normal text input. A key held while editing must be released
  before it can activate an action again.
- `PlayerBindPress` suppresses the selected key's ordinary console bind during
  gameplay. `cl_key_input` also filters matching buttons, movement axes, and
  impulses from `CreateMove`, including console aliases. Engine binds are never
  rewritten, so leaving the gamemode retains the player's normal configuration.
- Always run remains an independent preference; its synthetic sprint input is
  separate from the physical key assigned to a gamemode action.

Garry's Mod does not send function-key binds (F1–F12) through
[`PlayerBindPress`](https://wiki.facepunch.com/gmod/GM:PlayerBindPress).
An engine command attached to those keys, such as saving or taking a screenshot,
may therefore still run. Keyboard capture, native bind interception, and visual
layout must also be checked in the actual engine; simulated tests cannot verify
engine event ordering or rendering.

## Validation

`tests/key-settings.test.mjs` covers remapping, swapping, persistence, capture
cancellation, focus cleanup, all built-in themes and addon palettes, suppression
of native commands, and preservation of unrelated inputs. Mouse regressions
cover all five physical buttons, saved Mouse3 bindings, release before activation,
and preserving menu clicks while the cursor is visible.
`tests/localization-runtime.test.mjs` validates the settings labels in every
supported catalog. Run `npm run build` and `npm test` after source changes.
