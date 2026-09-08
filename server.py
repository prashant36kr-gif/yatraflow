#!/usr/bin/env python3
"""
YatraFlow - Full Stack Backend Server
Built with Python's high-performance standard library HTTP engine.
Provides RESTful APIs + Static Web Hosting.
"""

import http.server
import socketserver
import json
import urllib.parse
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.trip_engine import TripEngine
from engine.ai_assistant import YatraAIAssistant

engine = TripEngine()
ai = YatraAIAssistant(engine)

DEFAULT_PORT = 8000
STATIC_DIR = os.path.join(BASE_DIR, 'static')

class YatraFlowHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                raw = self.rfile.read(content_length).decode('utf-8')
                return json.loads(raw)
            return {}
        except Exception:
            return {}

    def _send_json(self, data, status=200):
        self._set_headers(status, 'application/json')
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API Endpoints
        if path == '/api/health':
            self._send_json({'status': 'ok', 'service': 'YatraFlow Engine', 'destinations_count': len(engine.destinations)})
            return

        if path == '/api/destinations':
            category = query.get('category', [None])[0]
            tag = query.get('tag', [None])[0]
            state = query.get('state', [None])[0]
            dests = engine.get_destinations(category, tag, state)
            self._send_json({
                'origins': engine.origins,
                'states': engine.states,
                'destinations': dests,
                'total': len(dests)
            })
            return

        if path.startswith('/api/destinations/'):
            dest_id = path.replace('/api/destinations/', '').strip()
            dest = next((d for d in engine.destinations if d['id'] == dest_id), None)
            if dest:
                self._send_json(dest)
            else:
                self._send_json({'error': 'Destination not found'}, status=404)
            return

        if path == '/api/demo/step':
            step = query.get('step', ['1'])[0]
            if step == '1':
                data = {
                    'step': 1,
                    'title': 'Enter Parameters',
                    'subtitle': '₹2,000 • Patna • 2 days • 4 students',
                    'params': {'budget': 2000, 'origin': 'patna', 'days': 2, 'group_size': 4}
                }
            elif step == '2':
                trips = engine.search_feasible_trips(budget=2000, origin='patna', days=2, group_size=4)
                data = {
                    'step': 2,
                    'title': 'Compare Feasible Trips',
                    'subtitle': 'Feasible trips appear with full cost breakdowns',
                    'trips': trips[:3]
                }
            elif step == '3':
                over_budget_trip = engine.assemble_trip(engine.destinations[0], budget=1500, days=2, group_size=4, prefer_tier='standard')
                data = {
                    'step': 3,
                    'title': 'Break it (Over Budget)',
                    'subtitle': 'Change budget to ₹1,500 → selected trip becomes too expensive',
                    'trip': over_budget_trip,
                    'over_budget_amount': 280
                }
            elif step == '4':
                opt = engine.optimize_trip('rajgir-nalanda', target_budget=2000, days=2, group_size=4)
                data = {
                    'step': 4,
                    'title': 'Constraint-Based Optimizer',
                    'subtitle': 'Engine swaps hotel / transport / activity → back under budget',
                    'optimizer': opt
                }
            elif step == '5':
                ai_resp = ai.handle_message('we hate crowds')
                data = {
                    'step': 5,
                    'title': 'Ask AI Assistant',
                    'subtitle': '“We hate crowds.” → itinerary adjusts to off-peak slots and peaceful trails',
                    'ai': ai_resp
                }
            else:
                data = {'error': 'Invalid step'}
            self._send_json(data)
            return

        # Fallback to serving static frontend
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path == '/api/trips/search':
            budget = int(body.get('budget', 2000))
            origin = body.get('origin', 'patna')
            days = int(body.get('days', 2))
            group_size = int(body.get('group_size', 4))
            preferences = body.get('preferences', ['all'])
            state_filter = body.get('state_filter', 'all')

            trips = engine.search_feasible_trips(budget, origin, days, group_size, preferences, state_filter)
            self._send_json({
                'budget': budget,
                'origin': origin,
                'days': days,
                'group_size': group_size,
                'preferences': preferences,
                'state_filter': state_filter,
                'total_results': len(trips),
                'feasible_count': sum(1 for t in trips if t['is_feasible']),
                'trips': trips
            })
            return

        if path == '/api/trips/optimize':
            dest_id = body.get('destination_id', 'rajgir-nalanda')
            budget = int(body.get('target_budget', 2000))
            days = int(body.get('days', 2))
            group_size = int(body.get('group_size', 4))

            result = engine.optimize_trip(dest_id, budget, days, group_size)
            if result:
                self._send_json(result)
            else:
                self._send_json({'error': 'Optimization failed'}, status=400)
            return

        if path == '/api/trips/split':
            dest_id = body.get('destination_id', 'rajgir-nalanda')
            days = int(body.get('days', 2))
            group_size = int(body.get('group_size', 4))
            tier = body.get('tier', 'standard')

            split_res = engine.calculate_group_split(dest_id, days, group_size, tier)
            if split_res:
                self._send_json(split_res)
            else:
                self._send_json({'error': 'Split calculation failed'}, status=400)
            return

        if path == '/api/ai/chat':
            user_msg = body.get('message', '')
            context = body.get('context', {})
            ai_resp = ai.handle_message(user_msg, context)
            self._send_json(ai_resp)
            return

        self._send_json({'error': f'Cannot POST to {path}'}, status=404)

def run_server(port=DEFAULT_PORT):
    socketserver.TCPServer.allow_reuse_address = True
    ports_to_try = [port, 8080, 8001, 5000, 3000]
    for p in ports_to_try:
        try:
            with socketserver.TCPServer(('0.0.0.0', p), YatraFlowHandler) as httpd:
                print(f"🚀 YatraFlow Full-Stack Server running at http://127.0.0.1:{p}")
                httpd.serve_forever()
                break
        except OSError as e:
            if "Address already in use" in str(e) or e.errno == 48:
                continue
            raise

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    run_server(port)
