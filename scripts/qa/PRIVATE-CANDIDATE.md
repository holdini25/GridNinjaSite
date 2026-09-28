# Private visual candidate

Use only after the source and both final asset bundles are frozen. This creates a
new local qualification snapshot; it does not approve or publish either asset.

```sh
node scripts/qa/prepare-private-candidate.mjs --source /absolute/worktree --out /absolute/new-candidate --facility facility-v12 --cinematic cinematic-v1
node scripts/qa/run-private-candidate.mjs build /absolute/new-candidate
node scripts/qa/run-private-candidate.mjs serve /absolute/new-candidate 3005
```

Use the repository's Node 22 and npm 10 runtime. The launcher explicitly selects
webpack (`npm run build -- --webpack`), recorded in the private marker, matching
the established qualification baseline and shared dependency arrangement.
The output parent must already
exist; the candidate directory must not exist and must be outside the source.
An unsuccessful preparation leaves an incomplete directory for inspection, never
a runnable completion marker. Use a fresh path for another attempt.

Preparation hashes an explicit inventory including dirty and untracked source,
excludes generated caches, outputs, credentials and dependencies, and confirms the
source did not change during copying. It adds the selected staged facility's
complete hash-pinned release and registry entry **only to the new snapshot**.
The original source registry and immutable publications are unchanged. The staged
cinematic bundle remains a local preview under `build/cinematic/`. The marker
records original and derived file inventories, both release digests, the exact
registry change and a shared dependency path/installed-lock digest. Dependencies
are reused through a link and must not be installed or edited through it; this is
a local reproducible snapshot, not a self-contained deployment package.

The launcher verifies the inventory and dependency lock before build or serving,
passes only local test settings with no inherited provider/database credentials,
rejects `.env` files, and binds serving to `127.0.0.1`. The normal prebuild and
postbuild validators still run. Build identity includes the private marker digest.
The outer npm build lifecycle leaves `NODE_ENV` unset so Vitest's prebuild checks
use their test environment; Next establishes production mode for the actual
build. Serving explicitly sets `NODE_ENV=production`.
Vercel builds reject a private marker, and production qualification explicitly
fails private candidates even if other production settings are supplied.
Do not expose this server through a public proxy or tunnel.

Run visual/performance evidence from the prepared directory with its recorded
settings: `FACILITY_ASSET_RELEASE`, `FACILITY_3D_MODE=auto-adaptive`,
`CINEMATIC_ASSET_RELEASE`, `CINEMATIC_PREVIEW=1`, `CINEMATIC_MODE=auto`,
`GRIDNINJA_CSP_MODE=enforce`, and the public Turnstile test key used by the launcher.
The ordinary verified build identity rejects different settings or source bytes.
Evidence describes a private candidate and is never a public release approval.
