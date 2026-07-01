# Asset Production Pipeline

This experiment can use Blender as a local render engine for placeholder asset
production. The current pipeline is a smoke check only: it creates one simple
low-poly PNG and verifies that the render path works.

## Install Blender

Install Blender locally from the official Blender installer for your operating
system. On Windows, the default installer path is commonly:

```powershell
C:\Program Files\Blender Foundation\Blender 5.1\blender.exe
```

The scripts first use `BLENDER_EXE`, then try `blender` from `PATH`, then search
the default Windows install folder.

## Set `BLENDER_EXE`

PowerShell:

```powershell
$env:BLENDER_EXE = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
```

## Check Blender

```powershell
npm.cmd run blender:check
```

This prints the resolved executable path and runs `Blender --version`.

## Render The Smoke Asset

```powershell
npm.cmd run blender:smoke
```

The smoke render writes:

```text
public/asset-packs/space-placeholder-v1/smoke-test/blender_smoke.png
```
