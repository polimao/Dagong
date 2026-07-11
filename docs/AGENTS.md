# Agent Runtime Notes

The MagicPocket desktop app has one live agent runtime: the bundled **MagicPocket** runtime.

Do not add a second live provider, provider switcher, runtime diagnostics panel,
or legacy CodeWhale/Reasonix process path. Code, Design, Write, and Connect
phone all enter the same MagicPocket HTTP/SSE boundary. Connect phone still uses the
internal `claw` name in code for compatibility.

## Allowed Extension Path

1. Add protocol fields in `magicpocket/src/contracts/`.
2. Add agent behavior in `magicpocket/src/loop/`, `magicpocket/src/services/`, or a
   new port/adapter under `magicpocket/src/ports/` and `magicpocket/src/adapters/`.
3. Add HTTP endpoints under `magicpocket/src/server/routes/`.
4. Map the endpoint/event in `src/renderer/src/agent/magicpocket-runtime.ts` and
   `src/renderer/src/agent/magicpocket-mapper.ts`.
5. Add settings only under `agents.magicpocket`.

## Forbidden Paths

- No `AgentSwitcher`.
- No `ConnectionStatusBar`.
- No `RuntimeDiagnosticsDialog` or runtime self-check UI.
- No CodeWhale/Reasonix adapter, process manager, RPC bridge, updater, or
  importer.
- No legacy drawing/painting starter card outside the current Design mode.
- No `/usage` or `/runtime` slash command that opens a runtime control panel.

## Legacy Data Rule

Old persisted keys may be read only inside settings migration:

- `agentProvider: codewhale | reasonix | deepseek-runtime` maps to `magicpocket`.
- `agents.codewhale`, `agents.reasonix`, and legacy `deepseek` values seed
  `agents.magicpocket` once.
- Saved settings must contain only `agents.magicpocket`.
- Old Connect phone (internal Claw) `agentThreadIds.codewhale/reasonix` fold into
  `agentThreadIds.magicpocket`.

## Verification

Run:

```bash
npm run typecheck
npm test
npm run build
```

Manual smoke:

- Code can create a MagicPocket thread, stream a reply, approve/deny tools, and
  interrupt a turn.
- CodeWhale parity endpoints still work through MagicPocket: thread search/archive
  filters, fork, session resume, request_user_input submit/cancel, and usage.
- Cache telemetry uses DeepSeek native `prompt_cache_hit_tokens` /
  `prompt_cache_miss_tokens`; hot MagicPocket turns should stay above 90% cache
  hit after the stable prefix is warm.
- Immutable prefix drift and malformed tool-call/tool-result history must be
  caught before a request reaches DeepSeek.
- Design can open the canvas, create or iterate an artifact, preview/export it,
  and hand the approved design to a fresh Code thread.
- Write can open the workspace, request inline completion, and use selected-text
  assistant actions.
- Connect phone can save settings and run a manual task through a MagicPocket thread.
- Settings -> Agents shows only MagicPocket.

The full plan is in
[`docs/magicpocket-architecture.md`](./magicpocket-architecture.md).
