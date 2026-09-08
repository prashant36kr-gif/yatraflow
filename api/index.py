"""
YatraFlow Vercel Serverless API Gateway
Zero-dependency, high-speed WSGI & HTTP Handler.
Works natively on Vercel Python runtime without build failures.
"""
import sys
import os
import json
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.trip_engine import TripEngine
from engine.ai_assistant import YatraAIAssistant

engine = TripEngine()
ai = YatraAIAssistant(engine)

def route_request(method, path, query_params, body_dict):
    """Core routing logic matching all YatraFlow API specifications."""
    # CORS preflight
    if method == 'OPTIONS':
        return 200, {'status': 'ok'}

    # Health check
    if path in ['/api/health', '/api/health/']:
        return 200, {
            'status': 'ok',
            'service': 'YatraFlow Serverless API',
            'destinations_loaded': len(engine.destinations),
            'version': '2.0.0'
        }

    # Destinations explorer
    if path in ['/api/destinations', '/api/destinations/']:
        category = query_params.get('category', [None])[0]
        tag = query_params.get('tag', [None])[0]
        state = query_params.get('state', ['all'])[0]
        dests = engine.get_destinations(category=category, tag=tag, state=state)
        return 200, {
            'origins': engine.origins,
            'destinations': dests,
            'total': len(dests)
        }

    # Trip search
    if path in ['/api/trips/search', '/api/trips/search/']:
        budget = int(body_dict.get('budget', 2000))
        origin = body_dict.get('origin', 'patna')
        days = int(body_dict.get('days', 2))
        group_size = int(body_dict.get('group_size', 4))
        preferences = body_dict.get('preferences', ['all'])
        state_scope = body_dict.get('state_scope') or body_dict.get('state_filter') or 'all'

        trips = engine.search_feasible_trips(
            budget=budget,
            origin=origin,
            days=days,
            group_size=group_size,
            preferences=preferences,
            state_filter=state_scope
        )
        return 200, {
            'budget': budget,
            'origin': origin,
            'days': days,
            'group_size': group_size,
            'preferences': preferences,
            'total': len(trips),
            'feasible': sum(1 for t in trips if t.get('is_feasible')),
            'trips': trips
        }

    # Budget Optimizer
    if path in ['/api/trips/optimize', '/api/trips/optimize/']:
        dest_id = body_dict.get('destination_id', 'rajgir-nalanda')
        budget = int(body_dict.get('budget') or body_dict.get('target_budget') or 2000)
        days = int(body_dict.get('days', 2))
        group_size = int(body_dict.get('group_size', 4))

        result = engine.optimize_trip(dest_id, target_budget=budget, days=days, group_size=group_size)
        return 200, result

    # Group Splitter
    if path in ['/api/trips/split', '/api/trips/split/']:
        dest_id = body_dict.get('destination_id', 'rajgir-nalanda')
        days = int(body_dict.get('days', 2))
        group_size = int(body_dict.get('group_size', 4))
        tier = body_dict.get('tier', 'standard')
        transport_type = body_dict.get('transport_type', 'auto')

        result = engine.calculate_group_split(
            dest_id,
            days=days,
            group_size=group_size,
            tier=tier,
            transport_type=transport_type
        )
        return 200, result

    # AI Chat Copilot
    if path in ['/api/ai/chat', '/api/ai/chat/']:
        message = body_dict.get('message', '')
        context = body_dict.get('context', {})
        result = ai.handle_message(message, context)
        return 200, result

    # Demo Script Runner
    if path in ['/api/demo/step', '/api/demo/step/']:
        step_str = query_params.get('step', ['1'])[0]
        step = int(step_str) if step_str.isdigit() else 1
        if step == 1:
            return 200, {
                'step': 1,
                'title': 'Enter Parameters',
                'subtitle': '₹2,000 • Patna • 2 days • 4 students',
                'params': {'budget': 2000, 'origin': 'patna', 'days': 2, 'group_size': 4}
            }
        elif step == 2:
            trips = engine.search_feasible_trips(budget=2000, origin='patna', days=2, group_size=4)
            return 200, {
                'step': 2,
                'title': 'Rank Feasible Packages',
                'subtitle': f'{sum(1 for t in trips if t["is_feasible"])} trips within ₹2,000 budget',
                'trips': trips[:3]
            }
        elif step == 3:
            opt = engine.optimize_trip('rajgir-nalanda', target_budget=2000)
            return 200, {
                'step': 3,
                'title': 'Over Budget? Run Optimizer',
                'subtitle': f'Before: ₹{opt["before"]["total_cost_per_person"]} → After: ₹{opt["after"]["total_cost_per_person"]} (Saved ₹{opt["total_savings"]})',
                'optimization': opt
            }
        elif step == 4:
            split = engine.calculate_group_split('rajgir-nalanda', days=2, group_size=4)
            return 200, {
                'step': 4,
                'title': 'Split Group Costs',
                'subtitle': f'₹{split["cost_per_student"]:,}/student • Quad-sharing',
                'split': split
            }
        elif step == 5:
            ai_resp = ai.handle_message("We hate crowds, suggest quieter timing", {'destination_id': 'rajgir-nalanda'})
            return 200, {
                'step': 5,
                'title': 'AI Travel Copilot',
                'subtitle': 'Rule-governed intent routing',
                'copilot': ai_resp
            }
        return 400, {'error': 'Invalid step'}

    return 404, {'error': f'Route not found: {path}'}


# ============================================================================
# 1. WSGI Interface (Standard across Vercel Python runtime)
# ============================================================================
def app(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET').upper()
    query_string = environ.get('QUERY_STRING', '')
    query_params = parse_qs(query_string)

    body_dict = {}
    if method in ['POST', 'PUT', 'PATCH']:
        try:
            content_length = int(environ.get('CONTENT_LENGTH', 0) or 0)
        except (ValueError, TypeError):
            content_length = 0

        if content_length > 0:
            body_bytes = environ['wsgi.input'].read(content_length)
            try:
                body_dict = json.loads(body_bytes.decode('utf-8'))
            except Exception:
                body_dict = {}

    status_code, resp_data = route_request(method, path, query_params, body_dict)
    resp_bytes = json.dumps(resp_data).encode('utf-8')

    status_str = f"{status_code} OK" if status_code == 200 else f"{status_code} Error"
    headers = [
        ('Content-Type', 'application/json; charset=utf-8'),
        ('Content-Length', str(len(resp_bytes))),
        ('Access-Control-Allow-Origin', '*'),
        ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    ]

    start_response(status_str, headers)
    return [resp_bytes]


# ============================================================================
# 2. BaseHTTPRequestHandler Interface (Fallback for Vercel functions)
# ============================================================================
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send_response(200, {'status': 'ok'})

    def do_GET(self):
        parsed = urlparse(self.path)
        query_params = parse_qs(parsed.query)
        status_code, data = route_request('GET', parsed.path, query_params, {})
        self._send_response(status_code, data)

    def do_POST(self):
        parsed = urlparse(self.path)
        query_params = parse_qs(parsed.query)
        length = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(length).decode('utf-8') if length else '{}'
        try:
            body_dict = json.loads(body)
        except Exception:
            body_dict = {}

        status_code, data = route_request('POST', parsed.path, query_params, body_dict)
        self._send_response(status_code, data)

    def _send_response(self, code, data):
        resp_bytes = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(resp_bytes)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(resp_bytes)

    def log_message(self, *args):
        pass
