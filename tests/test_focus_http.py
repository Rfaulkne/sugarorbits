"""Real HTTP tests; all archives are temporary, all glucose is synthetic."""
import http.client
import json
import sys
import tempfile
import threading
import unittest
import uuid
from dataclasses import replace
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app
from glucose_store import GlucoseStore
from orbit_focus import FocusStore
from orbit_demo import demo_records


class FocusHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        store = GlucoseStore(Path(self.temp.name))
        records = demo_records()
        store.upsert([{**r, "displayTime": r["systemTime"], "valueMgDl": round(r["valueMmol"]*18)} for r in records])
        self.patches = [patch.object(app, 'GLUCOSE_STORE', store),
                        patch.object(app, 'FOCUS_STORE', FocusStore(Path(self.temp.name))),
                        patch.object(app, 'SETTINGS', replace(app.SETTINGS, app_access_code='', app_session_secret=''))]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), app.AppHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close)

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, path, payload=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        h = {'Content-Type':'application/json', **(headers or {})}
        connection.request('POST' if payload is not None else 'GET', path,
                           json.dumps(payload) if payload is not None else None, h)
        r = connection.getresponse()
        body = r.read()
        status = r.status
        connection.close()
        try:
            return status, json.loads(body)
        except ValueError:
            return status, body

    def test_new_and_original_pages_exist(self):
        for path in ['/', '/rhythm', '/phone', '/phone/', '/focus.css', '/phone.js', '/phone.webmanifest']:
            self.assertEqual(self.request(path)[0],200,path)

    def test_csrf_and_origin_protection(self):
        event={'id':str(uuid.uuid4()),'kind':'stress'}
        self.assertEqual(self.request('/api/v2/events',event)[0],403)
        headers={'X-Orbit-CSRF': app.FOCUS_CSRF,'Origin':'https://unrelated.example'}
        self.assertEqual(self.request('/api/v2/events',event,headers)[0],403)

    def test_tag_roundtrip_and_delete(self):
        status,state=self.request('/api/v2/state')
        self.assertEqual(status,200)
        headers={'X-Orbit-CSRF':state['csrf']}
        event={'id':str(uuid.uuid4()),'kind':'activity','note':'Walk'}
        self.assertEqual(self.request('/api/v2/events',event,headers)[0],200)
        self.assertEqual(self.request('/api/v2/events',event,headers)[0],200)
        self.assertEqual(len(self.request('/api/v2/state')[1]['events']),1)
        self.assertEqual(self.request('/api/v2/events/delete',{'id':event['id']},headers)[0],200)
        self.assertEqual(self.request('/api/v2/state')[1]['events'],[])

    def test_bad_payload_and_ai_off_are_clear(self):
        headers={'X-Orbit-CSRF':app.FOCUS_CSRF}
        self.assertEqual(self.request('/api/v2/events',{'kind':'nope'},headers)[0],400)
        self.assertEqual(self.request('/api/v2/coach',{'consent':True},headers)[0],503)
        self.assertEqual(self.request('/api/v2/coach',{'consent':False},headers)[0],400)

    def test_focus_start_checkin_finish(self):
        headers={'X-Orbit-CSRF':app.FOCUS_CSRF}
        status,data=self.request('/api/v2/focus',{'start':720,'end':900,'habit':'Observe lunch'},headers)
        self.assertEqual(status,200,data)
        state=self.request('/api/v2/state')[1]
        f=state['focus']
        self.assertEqual(f['habit'],'Observe lunch')
        self.assertEqual(self.request('/api/v2/checkin',{'focusId':f['id'],'day':state['today'],'status':'done'},headers)[0],200)
        self.assertEqual(self.request('/api/v2/state')[1]['focus']['doneDays'],1)
        self.assertEqual(self.request('/api/v2/focus/finish',{'id':f['id']},headers)[0],200)

    def test_demo_is_synthetic_and_does_not_reuse_private_tags(self):
        app.FOCUS_STORE.add_event({'id':str(uuid.uuid4()),'kind':'stress','note':'PRIVATE'})
        state=self.request('/api/v2/state?demo=1')[1]
        self.assertTrue(state['demo'])
        self.assertEqual(state['events'],[])
        self.assertFalse(state['aiEnabled'])

    def test_locked_api_while_public_phone_shell_remains_available(self):
        with patch.object(app,'SETTINGS',replace(app.SETTINGS,app_access_code='test-only',app_session_secret='temporary-only')):
            self.assertEqual(self.request('/phone')[0],200)
            self.assertEqual(self.request('/api/v2/state')[0],401)


if __name__=='__main__':
    unittest.main()
