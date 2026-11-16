"""Run a disposable fixture and DOM QA in one process/network environment."""
import os
import subprocess
import sys
import time
from urllib.request import urlopen
from pathlib import Path

root = Path(__file__).resolve().parents[1]
server = subprocess.Popen([sys.executable, str(root / 'tests/serve_focus_fixture.py')], cwd=root,
                          stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for attempt in range(40):
        try:
            with urlopen('http://127.0.0.1:8879/healthz', timeout=1):
                break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Synthetic fixture did not start')
    result = subprocess.run(['node', str(root / 'tests/focus_dom.cjs')], cwd=root, env=os.environ)
    sys.exit(result.returncode)
finally:
    server.terminate()
    server.wait(timeout=5)
