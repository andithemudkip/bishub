!macro customInit
  ; Kill running instances so files aren't locked during install
  ExecWait 'taskkill /F /IM "BisHub.exe"'
  ExecWait 'taskkill /F /IM "ffmpeg.exe"'
  ExecWait 'taskkill /F /IM "ffprobe.exe"'
  ExecWait 'taskkill /F /IM "yt-dlp.exe"'
  ExecWait 'taskkill /F /IM "qjs.exe"'
  Sleep 1000
!macroend

!macro customUnInit
  ; Kill running instances before uninstall
  ExecWait 'taskkill /F /IM "BisHub.exe"'
  ExecWait 'taskkill /F /IM "ffmpeg.exe"'
  ExecWait 'taskkill /F /IM "ffprobe.exe"'
  ExecWait 'taskkill /F /IM "yt-dlp.exe"'
  ExecWait 'taskkill /F /IM "qjs.exe"'
  Sleep 1000
!macroend
