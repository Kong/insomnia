!macro customInit
  StrCpy $0 "$PROFILE\AppData\Local\insomnia\Update.exe"
  StrCpy $1 "$PROFILE\AppData\Local\insomnia\.dead"
  IfFileExists $1 0 +2
    Goto +4
  IfFileExists $0 0 +5
    MessageBox MB_YESNO "Existing Insomnia installation found, which must be uninstalled first.$\n$\nClick 'No' to exit this installer so you can uninstall yourself.$\n$\nClick 'Yes' to allow this installer to uninstall for you (your existing Insomnia data will be preserved)." IDYES 0 IDNO +3
    nsExec::Exec '"$0" --uninstall -s'
    Goto +2
    Quit
!macroend

!macro customInstall
  SetOutPath "$INSTDIR"
  DetailPrint "Creating installer-info.json..."

  FileOpen $0 "$INSTDIR\installer-info.json" w
  FileWrite $0 "{`"installer`": `"nsis`"}"
  FileClose $0
!macroend
