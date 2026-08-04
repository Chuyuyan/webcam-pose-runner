#!/usr/bin/env python3
"""Install a capture from the browser's download folder into the test suite.

The recorder can only hand the file to the browser, which drops it wherever
downloads go. This moves the newest one into tests/recordings/ and adds it to
the manifest the test page reads, so the round trip is one command instead of
three fiddly manual steps.

    python3 tests/add-recording.py                # newest download, auto-named
    python3 tests/add-recording.py chuyu-skirt    # newest download, named
    python3 tests/add-recording.py name ~/some/other/pose-capture.json
"""
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
RECORDINGS = HERE / "recordings"
INDEX = RECORDINGS / "index.json"
DOWNLOADS = Path.home() / "Downloads"


def newest_capture():
    hits = sorted(DOWNLOADS.glob("pose-capture*.json"), key=lambda p: p.stat().st_mtime)
    if not hits:
        sys.exit(f"No pose-capture*.json in {DOWNLOADS}. Record one first: camera "
                 "mode, then the 'Record test data' button under the preview.")
    return hits[-1]


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("capture-%Y%m%d-%H%M")
    src = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else newest_capture()

    data = json.loads(src.read_text())
    steps = [s["id"] for s in data.get("steps", [])]
    if not data.get("frames") or not steps:
        sys.exit(f"{src} does not look like a capture (no frames or no steps).")

    RECORDINGS.mkdir(exist_ok=True)
    dest = RECORDINGS / f"{name}.json"
    shutil.move(str(src), dest)

    index = json.loads(INDEX.read_text()) if INDEX.exists() else []
    if dest.name not in index:
        index.append(dest.name)
    INDEX.write_text(json.dumps(index, indent=2) + "\n")

    kb = dest.stat().st_size / 1024
    print(f"{dest.relative_to(HERE.parent)}  —  {len(data['frames'])} frames, {kb:.0f} KB")
    print(f"segments: {', '.join(steps)}")
    print("Now reload http://localhost:5175/tests/ and press 'Replay recordings only'.")


if __name__ == "__main__":
    main()
