# Inso Installer

A one-time, per-user installer (no admin/UAC prompt) that installs `inso.exe` + `inso-node.dll` into `%LOCALAPPDATA%\Kong\Inso`, adds that directory to the current user's `PATH` on first install only, and forwards its own arguments to the freshly-installed `inso.exe` so the first invocation still runs the command the caller wanted. Every invocation after that goes straight to `inso` on `PATH` — the installer is never touched again.

## Building Locally

1. Install [NSIS](https://nsis.sourceforge.io/Download) and ensure `makensis.exe` is on `PATH`.
2. Build the wrapper first (`build-secure-wrapper-inso.sh`) so `packages/insomnia-inso/binaries/inso.exe` and `inso-node.dll` both exist.
3. From the repo root:
   ```bash
   ./build-inso-installer.sh
   ```
4. Output: `packages/insomnia-inso/artifacts/inso-installer.exe`.

## Testing

```bash
./inso-installer.exe --help
```

First run should install into `%LOCALAPPDATA%\Kong\Inso`, print `inso`'s help output, and update `PATH` for the current user (visible in *new* terminal sessions — an already-open shell won't see it until restarted). Open a new terminal and confirm `inso --help` works directly via `PATH`.
