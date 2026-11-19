"""打包 dotnet publish 的 win-x64 成品，并生成网页展示的 SHA-256。"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

release = Path(sys.argv[1]).resolve(strict=True)
root = Path(__file__).resolve().parents[2]
output = root / "apps/web/public/downloads"
output.mkdir(parents=True, exist_ok=True)

version = "0.3.0"
name = f"JimiMaster-{version}-win-x64.zip"
files = ("JimiMaster.exe", "JimiMaster.dll", "JimiMaster.deps.json", "JimiMaster.runtimeconfig.json")
if not (release / files[0]).read_bytes().startswith(b"MZ"):
    raise SystemExit("输入目录中没有 Windows PE 程序")
with zipfile.ZipFile(output / name, "w", compression=zipfile.ZIP_DEFLATED) as package:
    for file in files:
        package.write(release / file, file)

digest = hashlib.sha256((output / name).read_bytes()).hexdigest()
manifest = {"version": version, "file": name, "sha256": digest, "size": (output / name).stat().st_size}
(output / "jimi-release.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
