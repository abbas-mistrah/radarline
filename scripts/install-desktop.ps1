$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$launcher = Join-Path $projectDirectory 'launch-radarline.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'RADARLINE.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $projectDirectory
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,14"
$shortcut.Description = 'RADARLINE — Technology & AI Intelligence OS'
$shortcut.Save()
Write-Output "Desktop shortcut created: $shortcutPath"
