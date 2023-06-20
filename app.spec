# -*- mode: python ; coding: utf-8 -*-

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


a = Analysis(
    ['loopy/gui/app.py'],
    pathex=[],
    binaries=[(pyfolder / "gdal_translate", '.')],
    datas=[],
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
    name='samui-preprocessor',
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
    name='samui-preprocessor.app' if platform.system() == 'Darwin' else 'samui-preprocessor',
    icon=None,
    bundle_identifier=None,
)
