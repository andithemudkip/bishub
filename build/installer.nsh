!macro customInit
  ; Kill running instances so files aren't locked during install
  nsExec::ExecToLog 'taskkill /F /IM "BisHub.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "ffmpeg.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "ffprobe.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "yt-dlp.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "qjs.exe"'
  Sleep 1000
!macroend

!macro customInstall
  ; Ensure shortcuts are created during silent installs (OTA updates)
  CreateShortCut "$DESKTOP\BisHub.lnk" "$INSTDIR\BisHub.exe"
  CreateShortCut "$SMPROGRAMS\BisHub.lnk" "$INSTDIR\BisHub.exe"
!macroend
