# Instructions for agents

## Context and references

- This is a Garry's Mod gamemode undergoing a gradual migration from GLua to TypeScriptToLua.
- Respond to the user in Portuguese and explain behavior changes clearly.
- Write all new documentation and documentation updates in English.
- Consult `docs/typescript-migration.md` for the development workflow and
  `docs/project-diagnosis.md` for findings and the proposed migration sequence.
- Preserve existing workspace changes that are unrelated to the current task.

## Small files and efficient context

- Write small, cohesive files with a clear responsibility so that an AI can
  understand and modify a system by reading few files and tokens.
- Treat roughly 150-250 lines as a signal to consider splitting a file,
  not as a mandatory limit. Separate responsibilities rather than arbitrary blocks.
- Prefer descriptive names and explicit contracts. Keep related rules together;
  avoid fragmentation that requires opening many files for a simple task.
- Group related sources into domain folders (`player/`, `events/`, `rounds/`,
  `weapons/`, etc.). Reserve the gamemode root for entry points.
  Within each domain, use `shared/`, `server/`, and `client/` according to the realm;
  create only folders that contain code. Content registrations belong on the server.
  Keep the `sv_`, `cl_`, and `sh_` prefixes used by compilation for each realm.
- Extract components when there is a real boundary: persistence, network validation,
  domain rules, content registration, or presentation.
- Do not restructure unrelated large files merely to reduce line counts.
  Do not compress code or remove useful explanations to save tokens.
- Use `rg` to locate symbols and read relevant sections first.
  Avoid dumping large files, generated Lua, lockfiles, or dependencies into context.
- Document decisions and contracts; avoid comments that merely repeat the code.
- Prefer classes with typed fields and `implements` for stateful managers.
  Create one instance per realm in the responsible module and expose it through `_G`
  only to maintain the existing public API. Methods must operate on `this` without
  capturing the global instance. Callbacks without `self` may use arrow fields.
  Preserve tables/metatables required by GMod and data registrations;
  stateless utilities do not need to become classes.

## Migration and compatibility

- `migration.json` identifies migrated files. For these files, edit the `.ts` in
  `src/` and regenerate the `.lua`; never manually fix only the generated output.
- `files` lists runtime Lua paths; `sourcePaths` maps those paths to sources
  organized in folders. When moving TS files, update this mapping to preserve
  paths used by GMod, registration loaders, and addons.
- Edit GLua that has not yet been migrated normally. Commit TS sources and handwritten
  Lua, but do not commit generated Lua. The build synchronizes `gamemodes/.gitignore`
  with the exact outputs in `migration.json`; keep that ignore file versioned.
  Build before installing or distributing the gamemode, since a fresh checkout
  does not contain the generated runtime Lua.
- Separate bug fixes from conversion work, keeping each change identifiable.
- Preserve paths, `include` order, `AddCSLuaFile`, public globals, hooks, IDs,
  and protocols used by legacy code and addons. When splitting files, update
  their loading and distribution to clients in the same set of changes.
- Every TypeScript file must resolve its imports, dependencies, and type declarations
  without errors both in the editor and during type checking. Ensure each file belongs
  to the appropriate TypeScript project, with the required dependencies, ambient types,
  and TypeScriptToLua language extensions configured. A successful command-line build
  alone is insufficient if opening the file still produces dependency or import errors.
  Fix project configuration or declarations rather than suppressing diagnostics,
  adding `any`, or introducing unnecessary runtime imports.
- Do not introduce runtime imports without resolving how the emitted `require`
  will be loaded in GMod. Type-only imports do not have this effect.
- Respect server, client, and shared realms. Do not assume methods with the same
  name have the same signature in both realms. Preserve `self`/`this` and `:`/`.`.
- Keep types strict. Avoid `any` and casts that hide incomplete contracts.
  Handle missing values explicitly and keep SteamID64 as a string.
- Typing does not validate external data: validate network messages, files, and JSON
  at runtime. Permissions and gameplay rules must be checked on the server.
- Preserve assets and persisted data. The build must not clean `gamemodes/`.

## UI consistency

- Always style new or changed player-facing controls with the active theme palette
  and geometry (Classic, HL2, CS 1.6, and addon palettes). This includes text inputs,
  combo boxes, dropdown popups and options, placeholders, focus/hover indicators,
  and disabled states. Do not leave default Derma styling inside themed menus.
- Reuse `ZPMenuControls.TextEntry` and `ZPMenuControls.ComboBox` for native menu
  inputs. Extend shared presentation helpers when needed instead of duplicating
  styling between menus. Preserve native editing, caret/selection, keyboard focus,
  option callbacks and popup cleanup while customizing appearance.

## Localization

- Always translate new or changed player-facing text into every supported language
  in `gamemodes/zombieplague/content/resource/localization/` (currently 32 catalogs).
  This includes warnings, notifications, menu labels, and help text. Update all
  catalogs in the same change; do not leave English placeholders in other languages.
- Use native localization keys instead of hardcoded player-facing text. Preserve
  UTF-8 encoding and keep format parameters consistent across all translations.
- Validate catalog completeness and format parameters with
  `tests/localization-runtime.test.mjs` when changing localized text.

## Validation

- After changing migrated sources, run `npm run build` and `npm test`.
- In PowerShell without Node on PATH, use `scripts/npm.ps1`; if script execution
  policy blocks it, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\npm.ps1 test`
  (to build, replace `test` with `run build`).
- For behavior bugs, add relevant regression tests when feasible.
  Documentation-only changes do not require runtime tests.
- Local tests simulate GMod. Report what was validated and what still depends
  on the game; do not claim a match was validated without running it in the engine.
