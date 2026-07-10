; One-time, per-user installer for the inso CLI. Installs inso.exe (the secure wrapper)
; and inso-node.dll (the real CLI payload) into a per-user directory, registers that
; directory on the current user's PATH (first install only), then forwards this
; installer's own command-line arguments to the newly-installed inso.exe so the very
; first invocation still runs the command the caller actually wanted.
;
; Built via ../../../build-inso-installer.sh, which supplies VERSION/BINARIES_DIR/OUT_DIR.

!ifndef VERSION
  !error "VERSION must be defined, e.g. makensis -DVERSION=1.2.3 ..."
!endif
!ifndef BINARIES_DIR
  !error "BINARIES_DIR must be defined, e.g. makensis -DBINARIES_DIR=path ..."
!endif
!ifndef OUT_DIR
  !error "OUT_DIR must be defined, e.g. makensis -DOUT_DIR=path ..."
!endif

!include "FileFunc.nsh"
!include "WinMessages.nsh"

Name "Inso"
OutFile "${OUT_DIR}\inso-installer.exe"
Unicode true
SilentInstall silent
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Kong\Inso"

Section "Install"
  ReadRegStr $0 HKCU "Software\Kong\Inso" "Version"

  SetOutPath "$INSTDIR"
  File "${BINARIES_DIR}\inso.exe"
  File "${BINARIES_DIR}\inso-node.dll"
  WriteRegStr HKCU "Software\Kong\Inso" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\Kong\Inso" "InstallDir" "$INSTDIR"

  ; Only touch PATH on a genuinely first install — the directory never changes between
  ; versions, so a version upgrade never needs to touch it again.
  StrCmp $0 "" doPathUpdate skipPathUpdate
  doPathUpdate:
    ReadRegStr $1 HKCU "Environment" "Path"
    StrCmp $1 "" firstPathEntry appendPathEntry
    firstPathEntry:
      WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
      Goto pathUpdated
    appendPathEntry:
      WriteRegExpandStr HKCU "Environment" "Path" "$1;$INSTDIR"
    pathUpdated:
      SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  skipPathUpdate:

  ; This installer is itself a GUI-subsystem binary; reattach to the parent console so
  ; its own and the forwarded child's stdout/stderr reach the terminal, the same
  ; workaround the GUI's own secure wrapper needs for the same reason.
  System::Call 'kernel32::AttachConsole(i -1)'

  ${GetParameters} $2
  ExecWait '"$INSTDIR\inso.exe" $2' $3
  SetErrorLevel $3
SectionEnd
