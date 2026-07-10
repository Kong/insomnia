# Secure Wrapper

Mitigates the same [local search path vulnerability](https://vuldb.com/?id.295961) as `packages/insomnia/src/cpp` (CVE-2025-1353), adapted for a console CLI: `inso.exe` is a pure-C, `-nostdlib` binary (only KERNEL32.dll is a static import — no CRT init that could load a DLL before the mitigation is set) that sets `PROCESS_MITIGATION_IMAGE_LOAD_POLICY.PreferSystem32Images` before verifying and launching the real `inso-node.dll` payload as a child process, forwarding stdin/stdout/stderr and the child's real exit code.

## Building Locally

See `packages/insomnia/src/cpp/README.md` for the MSYS2/ucrt64/`windres`/`g++` toolchain setup — it's identical here. Once installed, run `./build-secure-wrapper-inso.sh` from the repo root.
