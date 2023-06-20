# -*- mode: python ; coding: utf-8 -*-

import glob
import sys

import pkgutil
import platform
import rasterio

from pathlib import Path

# list all rasterio and fiona submodules, to include them in the package
additional_packages = ["imagecodecs._shared", "imagecodecs._imcd"]
for package in pkgutil.iter_modules(rasterio.__path__, prefix="rasterio."):
    additional_packages.append(package.name)

pyfolder = Path(sys.executable).parent

block_cipher = None

more_dlls = []
files = []
if platform.system == "win32":
    for p in os.environ["PATH"].split(os.pathsep):
        if p:
            for p in glob.glob(os.path.join(p, "gdal*.dll")):
                more_dlls.append((p, "."))
    for p in (pyfolder / "Library/share/gdal").iterdir():
        files.append((p, "gdaldata"))
    for p in (pyfolder / "Library/share/proj").iterdir():
        files.append((p, "projdata"))

a = Analysis(
    ["loopy/gui/app.py"],
    pathex=[],
    binaries=[
        (pyfolder / "Library/bin/gdal_translate.exe", ".")
        if platform.system == "win32"
        else (pyfolder / "gdal_translate", "."),
        *more_dlls,
    ],
    datas=files,
    hiddenimports=additional_packages,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="samui-preprocessor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
app = BUNDLE(
    exe,
    name="samui-preprocessor.app" if platform.system() == "Darwin" else "samui-preprocessor",
    icon=None,
    bundle_identifier=None,
)
