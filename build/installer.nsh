; ---------------------------------------------------------------------------
; BisHub NSIS customisations
;
; Why this file is more than a couple of taskkills:
;
; Installs up to and including 0.1.9 were produced with electron-builder 24,
; whose uninstaller only ever looks for BisHub.exe when it checks "is the app
; running?". (0.1.10 was the first build on electron-builder 26, which checks
; every process running out of the install directory.) Stray ffmpeg / ffprobe /
; yt-dlp / qjs children keep files in the install directory locked, so the old
; uninstaller's atomic rename aborts and exits non-zero. electron-builder's installer reacts to that by showing
; "Failed to uninstall old application files" and quitting - the new version
; never gets installed.
;
; The uninstaller that runs is the one already sitting on the user's disk, so
; fixing the app or the uninstaller template can never help those machines.
; The only place a retroactive fix can live is the *new* installer:
;
;   1. customInit                    - kill everything running out of any
;                                      recorded install dir (not just
;                                      BisHub.exe) before the old uninstaller
;                                      is invoked, so it usually succeeds.
;   2. customUnInstallCheck /        - if it still fails, remove the previous
;      customUnInstallCheckCurrentUser  installation ourselves and carry on
;                                      instead of aborting the install.
;
; Both hooks are inserted by electron-builder >= 25 (installUtil.nsh,
; Function handleUninstallResult). Keep the app data untouched here - only the
; program directory, its shortcuts and its registry entries are removed.
; ---------------------------------------------------------------------------

!include LogicLib.nsh

; This file is compiled into the uninstaller as well, where none of the macros
; below are ever inserted - declaring the variables there trips NSIS' "not
; referenced" warning, which electron-builder treats as an error.
!ifndef BUILD_UNINSTALLER
  Var bhPwsh
  Var bhOldDir
  Var bhFailReason
  ; Scratch only ever holds a discarded nsExec return code - never keep
  ; anything in it across an !insertmacro.
  Var bhScratch
!endif

; Kill anything whose image path sits under DIR (covers the bundled binaries in
; resources\bin, which the legacy uninstallers never noticed).
;
; DIR is handed over in an environment variable rather than interpolated into
; the PowerShell source: install paths come from the registry and a per-user
; one carries the account name, so an apostrophe (C:\Users\O'Brien\...) would
; otherwise break the script literal and silently sweep nothing. PowerShell
; appends the trailing separator itself so that "...\BisHub" cannot prefix-match
; a sibling "...\BisHubViewer".
;
; DIR must be non-empty - an empty prefix matches every process on the machine.
!macro bhKillProcessesIn DIR
  ${If} ${DIR} != ""
    System::Call 'kernel32::SetEnvironmentVariable(t "BH_SWEEP_DIR", t "${DIR}")i.n'
    nsExec::ExecToLog `"$bhPwsh" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d = $$env:BH_SWEEP_DIR; if ($$d) { if (-not $$d.EndsWith('\')) { $$d += '\' }; Get-CimInstance -ClassName Win32_Process | Where-Object { $$_.Path -and $$_.Path.StartsWith($$d, 'CurrentCultureIgnoreCase') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue } }"`
    Pop $bhScratch
    System::Call 'kernel32::SetEnvironmentVariable(t "BH_SWEEP_DIR", i 0)i.n'
  ${EndIf}
!macroend

; Fallback for machines where PowerShell is restricted.
!macro bhKillKnownProcesses
  ; No /T here: during an OTA update the installer is spawned by BisHub.exe, so
  ; killing the process tree could take the installer down with it.
  nsExec::ExecToLog 'taskkill /F /IM "BisHub.exe"'
  Pop $bhScratch
  nsExec::ExecToLog 'taskkill /F /IM "ffmpeg.exe"'
  Pop $bhScratch
  nsExec::ExecToLog 'taskkill /F /IM "ffprobe.exe"'
  Pop $bhScratch
  nsExec::ExecToLog 'taskkill /F /IM "yt-dlp.exe"'
  Pop $bhScratch
  nsExec::ExecToLog 'taskkill /F /IM "qjs.exe"'
  Pop $bhScratch
!macroend

; Remove a previous installation whose own uninstaller refused to do it.
; ROOT_KEY is a literal registry root (SHELL_CONTEXT or HKCU).
!macro bhRecoverFailedUninstall ROOT_KEY
  ; $R0 holds the old uninstaller's exit code; the error flag means it could
  ; not be launched at all.
  ${If} ${Errors}
    ClearErrors
    StrCpy $bhFailReason "could not be launched"
  ${ElseIf} $R0 != 0
    StrCpy $bhFailReason "exited with code $R0"
  ${Else}
    StrCpy $bhFailReason ""
  ${EndIf}

  ${If} $bhFailReason != ""
    DetailPrint "Previous BisHub uninstaller $bhFailReason - removing the old installation directly."

    ; Re-read rather than reusing the template's $installationDir: that var is
    ; declared inside Function uninstallOldVersion, further down installUtil.nsh
    ; than the hook we are expanded into, so referencing it here is
    ; "warning 6000: unknown variable" - fatal under electron-builder's -WX.
    ; The only thing lost is the template's fallback of deriving the directory
    ; from UninstallString, and registryAddInstallInfo has always written
    ; InstallLocation, so no BisHub install can reach that fallback.
    ReadRegStr $bhOldDir ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" InstallLocation
    ClearErrors

    ${If} $bhOldDir == ""
      ; Nothing locatable to clean up, so leave the registry alone too -
      ; dropping the uninstall entry here would strand the old files with no
      ; way back. Unreachable for a real BisHub install (see above).
      DetailPrint "No install location recorded; leaving the previous installation in place."
    ${Else}
      ; Only ever delete a directory that actually looks like a BisHub install.
      ; Nested rather than one condition: LogicLib does not give ${AndIf} and
      ; ${OrIf} any precedence over each other in a single statement.
      ${If} ${FileExists} "$bhOldDir\*.*"
        ${If} ${FileExists} "$bhOldDir\${UNINSTALL_FILENAME}"
        ${OrIf} ${FileExists} "$bhOldDir\${APP_EXECUTABLE_FILENAME}"
          !insertmacro bhKillProcessesIn $bhOldDir
          !insertmacro bhKillKnownProcesses
          Sleep 1000
          ; Must not be the current directory or it cannot be removed.
          SetOutPath $TEMP
          ; Deliberately NOT /REBOOTOK. We only get here because files are
          ; locked, and /REBOOTOK would queue those paths into
          ; PendingFileRenameOperations - which deletes by path, so the next
          ; boot would delete the files this installer is about to write to
          ; those very paths. A locked leftover is the safer failure.
          RMDir /r "$bhOldDir"
          ${If} ${Errors}
            DetailPrint "Could not fully remove $bhOldDir - continuing anyway."
            ClearErrors
          ${EndIf}
        ${EndIf}
      ${EndIf}

      ; Shortcuts of the old install. setLinkVars resolved these under the
      ; shell-var context active at the top of the section, which with
      ; perMachine is always all-users - so the per-user branch cleans the
      ; all-users links (harmless, customInstall recreates both paths) and
      ; leaves a pre-0.1.7 per-user install's own links behind. Accepted:
      ; switching context here would risk registryAddInstallInfo writing the
      ; uninstall entry into the wrong hive, and under elevation $DESKTOP is
      ; the elevating admin's profile anyway, so the cleanup would often target
      ; the wrong user. Worst case is a dead .lnk, on installs older than 0.1.7.
      Delete "$oldDesktopLink"
      Delete "$oldStartMenuLink"

      ; Drop the old entries so Add/Remove Programs keeps no phantom entry and
      ; the next install does not try this uninstaller again.
      DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
      !ifdef UNINSTALL_REGISTRY_KEY_2
        DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY_2}"
      !endif
      DeleteRegKey ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}"
      ClearErrors
    ${EndIf}
  ${EndIf}
!macroend

!macro customInit
  StrCpy $bhPwsh "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"

  ; Kill running instances so files aren't locked during install.
  !insertmacro bhKillKnownProcesses

  ; Legacy uninstallers only close BisHub.exe, so anything else still running
  ; out of the old install directory keeps its files locked. electron-builder
  ; 26's own CHECK_APP_RUNNING already sweeps $INSTDIR (which initMultiUser
  ; resolved from the per-machine InstallLocation) before it invokes the old
  ; uninstaller, so only the per-user root needs covering here - installs
  ; before 0.1.7 were per-user and live somewhere $INSTDIR never points.
  ReadRegStr $bhOldDir HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  !insertmacro bhKillProcessesIn $bhOldDir
  ClearErrors

  Sleep 1000
!macroend

; Called instead of electron-builder's "give up and quit" handling.
!macro customUnInstallCheck
  !insertmacro bhRecoverFailedUninstall SHELL_CONTEXT
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro bhRecoverFailedUninstall HKCU
!macroend

!macro customInstall
  ; Ensure shortcuts are created during silent installs (OTA updates)
  CreateShortCut "$DESKTOP\BisHub.lnk" "$INSTDIR\BisHub.exe"
  CreateShortCut "$SMPROGRAMS\BisHub.lnk" "$INSTDIR\BisHub.exe"
!macroend
