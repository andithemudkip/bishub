!macro customInit
  ; Close running instances of BisHub before installing
  nsExec::ExecToLog 'taskkill /F /IM "BisHub.exe"'
  Sleep 1000
!macroend
