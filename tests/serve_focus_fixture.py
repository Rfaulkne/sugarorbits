"""Disposable browser QA server, synthetic readings, no Dexcom or cloud calls."""
import os
import sys
import tempfile
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
temporary = tempfile.TemporaryDirectory(prefix='orbit-browser-qa-')
os.environ.update(DATA_DIR=temporary.name, HOST='127.0.0.1', PORT='8879',
                  DEXCOM_SHARE_USERNAME='', DEXCOM_SHARE_PASSWORD='',
                  DEXCOM_SHARE_ACCOUNT_ID='', APP_ACCESS_CODE='',
                  APP_SESSION_SECRET='', ORBIT_AI_ENABLED='false')
import app
from orbit_demo import demo_records
app.GLUCOSE_STORE.upsert([{**r, 'displayTime':r['systemTime'], 'valueMgDl':round(r['valueMmol']*18)} for r in demo_records()])
print('SYNTHETIC QA SERVER · http://127.0.0.1:8879', flush=True)
try:
    ThreadingHTTPServer(('127.0.0.1',8879),app.AppHandler).serve_forever()
finally:
    temporary.cleanup()
