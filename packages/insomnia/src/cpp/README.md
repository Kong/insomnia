# Secure Wrapper

The purpose of this secure wrapper is to mitigate a [local search path vulnerability](https://vuldb.com/?id.295961).

It utilizes Windows' `PROCESS_MITIGATION_POLICY` to prefer the system paths so that the Electron application does not load hijacked DLLs that are placed in the installation directory (writable by underprivileged users).

## Building Locally

On Windows, install MSYS2 with the base self-extracting installer: [https://github.com/msys2/msys2-installer/releases](https://github.com/msys2/msys2-installer/releases)

Move that `.sfx.exe` file to wherever you'd like the MSYS2 installation to be, and run it. It will extract the install folder to that location. (i.e. `C:\msys2-base-x86_64-NNNNNNNN.sfx.exe` to install to `C:\msys64`).

Then, open the MSYS2 terminal to finish the installation (`C:\msys64\msys2.exe`).

Close that terminal, and open the `ucrt64` terminal (`C:\msys64\ucrt64.exe`).
Install the build system:

```bash
pacman -S mingw-w64-ucrt-x86_64-gcc
```

If you don't already have them, install git and node:

```bash
pacman -S git
pacman -S nodejs
```

Once that's done, ensure `windres` and `g++` are in your path:

```bash
$ which windres
/ucrt64/bin/windres

$ which g++
/ucrt64/bin/g++
```

Navigate to the top-level directory of this repository and run:

```bash
npm install
./build-secure-wrapper.sh
```

Once built, the Squirrel Installer can be launched from `dist/win-unpacked`.
