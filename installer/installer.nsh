; TSTVN installer customisation (electron-builder `nsis.include`).
; Two simple pages:
;   1. "TSTVN — Install TSTVN" with [x] Desktop shortcut, [x] Start Menu icon and an Install button
;   2. "TSTVN — ✓ Installed successfully" with a Launch TSTVN button
; Per-user install (no admin) into %LOCALAPPDATA%\Programs\TSTVN; the install-mode and folder pages are
; skipped. electron-builder still creates/removes shortcuts, registry and uninstaller as usual — unticked
; shortcuts are removed right after they are created.

!include MUI2.nsh
!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh

; 1033 = English, 1054 = Thai (the installer's languages)
LangString tstvnTitle 1033 "TSTVN"
LangString tstvnTitle 1054 "TSTVN"
LangString tstvnInstallHeading 1033 "Install TSTVN"
LangString tstvnInstallHeading 1054 "ติดตั้ง TSTVN"
LangString tstvnDesktopLabel 1033 "Create Desktop shortcut"
LangString tstvnDesktopLabel 1054 "สร้างทางลัดบนเดสก์ท็อป"
LangString tstvnStartMenuLabel 1033 "Create Start Menu icon"
LangString tstvnStartMenuLabel 1054 "สร้างไอคอนในเมนู Start"
LangString tstvnInstallButton 1033 "Install"
LangString tstvnInstallButton 1054 "ติดตั้ง"
LangString tstvnInstallPath 1033 "Installs to: $INSTDIR"
LangString tstvnInstallPath 1054 "ติดตั้งที่: $INSTDIR"
LangString tstvnSuccess 1033 "✓ Installed successfully"
LangString tstvnSuccess 1054 "✓ ติดตั้งเรียบร้อยแล้ว"
LangString tstvnLaunch 1033 "Launch TSTVN"
LangString tstvnLaunch 1054 "เปิด TSTVN"
LangString tstvnClose 1033 "Close"
LangString tstvnClose 1054 "ปิด"

!ifndef BUILD_UNINSTALLER

Var tstvnDesktop
Var tstvnStartMenu
Var tstvnDesktopBox
Var tstvnStartMenuBox
Var tstvnFont

!macro customInit
  ; Defaults (also used by silent installs: /S creates both shortcuts).
  StrCpy $tstvnDesktop ${BST_CHECKED}
  StrCpy $tstvnStartMenu ${BST_CHECKED}
  CreateFont $tstvnFont "Segoe UI" 18 700
!macroend

; Always install for the current user only (no admin rights, no "for all users?" page).
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; ---------- page 1: options + Install ----------
; Functions are defined inside the page macros so they are parsed where electron-builder inserts the
; pages (after it declares $appExe, $launchLink, …).
!macro customPageAfterChangeDir
Page custom tstvnOptionsPage tstvnOptionsLeave

Function tstvnOptionsPage
  !insertmacro MUI_HEADER_TEXT "$(tstvnTitle)" "$(tstvnInstallHeading)"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 26u "$(tstvnInstallHeading)"
  Pop $1
  SendMessage $1 ${WM_SETFONT} $tstvnFont 1
  ${NSD_CreateCheckbox} 4u 40u 100% 14u "$(tstvnDesktopLabel)"
  Pop $tstvnDesktopBox
  ${NSD_SetState} $tstvnDesktopBox $tstvnDesktop
  ${NSD_CreateCheckbox} 4u 60u 100% 14u "$(tstvnStartMenuLabel)"
  Pop $tstvnStartMenuBox
  ${NSD_SetState} $tstvnStartMenuBox $tstvnStartMenu
  ${NSD_CreateLabel} 0 -14u 100% 12u "$(tstvnInstallPath)"
  Pop $1
  SetCtlColors $1 808080 transparent
  GetDlgItem $2 $HWNDPARENT 1
  SendMessage $2 ${WM_SETTEXT} 0 "STR:$(tstvnInstallButton)"
  ; First page: nothing to go back to.
  GetDlgItem $2 $HWNDPARENT 3
  ShowWindow $2 ${SW_HIDE}
  nsDialogs::Show
FunctionEnd

Function tstvnOptionsLeave
  ${NSD_GetState} $tstvnDesktopBox $tstvnDesktop
  ${NSD_GetState} $tstvnStartMenuBox $tstvnStartMenu
FunctionEnd
!macroend

; Remove the shortcuts that were not wanted (electron-builder created both a moment ago).
!macro customInstall
  ${if} $tstvnDesktop != ${BST_CHECKED}
  ${andIf} ${FileExists} "$newDesktopLink"
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${endIf}
  ${if} $tstvnStartMenu != ${BST_CHECKED}
  ${andIf} ${FileExists} "$newStartMenuLink"
    WinShell::UninstShortcut "$newStartMenuLink"
    Delete "$newStartMenuLink"
    StrCpy $launchLink "$appExe"
  ${endIf}
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ; Go straight to the success page (the MUI finish page that normally does this is replaced).
  SetAutoClose true
!macroend

; ---------- page 2: success + Launch ----------
!macro customFinishPage
Page custom tstvnFinishPage

Function tstvnFinishPage
  !insertmacro MUI_HEADER_TEXT "$(tstvnTitle)" "$(tstvnSuccess)"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 26u "$(tstvnSuccess)"
  Pop $1
  SendMessage $1 ${WM_SETFONT} $tstvnFont 1
  SetCtlColors $1 1E8A4C transparent
  ${NSD_CreateButton} 0 44u 120u 24u "$(tstvnLaunch)"
  Pop $1
  ${NSD_OnClick} $1 tstvnLaunchApp
  ; Only "Close" remains: no Back, no Cancel after a successful install.
  GetDlgItem $2 $HWNDPARENT 1
  SendMessage $2 ${WM_SETTEXT} 0 "STR:$(tstvnClose)"
  GetDlgItem $2 $HWNDPARENT 3
  ShowWindow $2 ${SW_HIDE}
  GetDlgItem $2 $HWNDPARENT 2
  ShowWindow $2 ${SW_HIDE}
  nsDialogs::Show
FunctionEnd

Function tstvnLaunchApp
  ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  ; Same as pressing Close.
  SendMessage $HWNDPARENT 0x408 1 0
FunctionEnd
!macroend

!endif
