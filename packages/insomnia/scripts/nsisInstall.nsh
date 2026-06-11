!macro customInit
  ${ifNot} ${isUpdated}
    StrCpy $0 "$PROFILE\AppData\Local\insomnia\Update.exe"
    StrCpy $1 "$PROFILE\AppData\Local\insomnia\.dead"
    IfFileExists $1 skip_uninstall
    IfFileExists $0 0 skip_uninstall
    MessageBox MB_YESNO "Existing Insomnia installation found, which must be uninstalled first.$\n$\nClick 'No' to exit this installer so you can uninstall yourself.$\n$\nClick 'Yes' to allow this installer to uninstall for you (your existing Insomnia data will be preserved)." IDYES do_uninstall IDNO exit_installer
    do_uninstall:
      nsExec::Exec '"$0" --uninstall -s'
      Goto skip_uninstall
    exit_installer:
      Quit
    skip_uninstall:
  ${endIf}
!macroend

!macro customInstall
  SetOutPath "$INSTDIR"
  DetailPrint "Creating installer-info.json..."

  FileOpen $0 "$INSTDIR\installer-info.json" w
  FileWrite $0 '{"installer": "nsis"}'
  FileClose $0
!macroend
