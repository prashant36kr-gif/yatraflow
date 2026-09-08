#!/usr/bin/env python3
"""
Automated unit & integration tests for YatraFlow backend
Tests REST API endpoints, budget constraints, optimizer math, and AI intents.
"""

import urllib.request
import json
import subprocess
import time
import sys
import os

SERVER_CMD = [sys.executable, 'server.py', '8088']
CWD = os.path.dirname(os.path.abspath(__file__))

def run_tests():
    print("Starting test server on port 8088...")
    proc = subprocess.Popen(SERVER_CMD, cwd=CWD)
    time.sleep(1.5)

    base_url = "http://127.0.0.1:8088"

    try:
        # Test 1: Health Check
        print("\n[Test 1] Health Check GET /api/health")
        with urllib.request.urlopen(f"{base_url}/api/health") as resp:
            data = json.loads(resp.read().decode())
            assert data["status"] == "ok"
            print("  ✓ Passed: Health status ok")

        # Test 2: Destinations List
        print("\n[Test 2] Destinations GET /api/destinations")
        with urllib.request.urlopen(f"{base_url}/api/destinations") as resp:
            data = json.loads(resp.read().decode())
            assert len(data["destinations"]) >= 5
            print(f"  ✓ Passed: Loaded {len(data['destinations'])} destinations")

        # Test 3: Search Feasible Trips (Budget = 2000)
        print("\n[Test 3] Search Feasible Trips POST /api/trips/search")
        req_data = json.dumps({
            "budget": 2000,
            "origin": "patna",
            "days": 2,
            "group_size": 4,
            "preferences": ["all"]
        }).encode()
        req = urllib.request.Request(f"{base_url}/api/trips/search", data=req_data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            assert data["total_results"] > 0
            assert data["feasible_count"] >= 3
            print(f"  ✓ Passed: Found {data['feasible_count']} feasible trips out of {data['total_results']}")

        # Test 4: Budget Optimizer (Slide 07 Benchmark)
        print("\n[Test 4] Budget Optimizer POST /api/trips/optimize")
        req_data = json.dumps({
            "destination_id": "rajgir-nalanda",
            "target_budget": 2000,
            "days": 2,
            "group_size": 4
        }).encode()
        req = urllib.request.Request(f"{base_url}/api/trips/optimize", data=req_data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            assert data["before"]["total_cost_per_person"] == 2260
            assert data["after"]["total_cost_per_person"] == 1960
            assert data["after"]["is_feasible"] is True
            assert data["after"]["remaining_balance"] == 40
            print(f"  ✓ Passed: Slide 07 canonical optimizer verified! Before: ₹{data['before']['total_cost_per_person']} -> After: ₹{data['after']['total_cost_per_person']} (Remaining: ₹{data['after']['remaining_balance']})")

        # Test 5: Group Cost Split
        print("\n[Test 5] Group Split POST /api/trips/split")
        req_data = json.dumps({
            "destination_id": "rajgir-nalanda",
            "days": 2,
            "group_size": 4,
            "tier": "standard"
        }).encode()
        req = urllib.request.Request(f"{base_url}/api/trips/split", data=req_data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            assert data["group_size"] == 4
            assert data["cost_per_student"] * 4 == data["total_group_cost"]
            print(f"  ✓ Passed: Group math validated: ₹{data['cost_per_student']} x 4 = ₹{data['total_group_cost']}")

        # Test 6: AI Assistant Intent Handling ("We hate crowds")
        print("\n[Test 6] AI Assistant POST /api/ai/chat")
        req_data = json.dumps({
            "message": "We hate crowds",
            "context": {"budget": 2000, "days": 2, "group_size": 4}
        }).encode()
        req = urllib.request.Request(f"{base_url}/api/ai/chat", data=req_data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            assert data["intent"] == "AVOID_CROWDS"
            print(f"  ✓ Passed: AI recognized intent {data['intent']}")

        # Test 7: Demo 5-Step Endpoint
        print("\n[Test 7] Demo Step 1 to 5")
        for s in range(1, 6):
            with urllib.request.urlopen(f"{base_url}/api/demo/step?step={s}") as resp:
                data = json.loads(resp.read().decode())
                assert data["step"] == s
                print(f"  ✓ Passed: Step {s} verified ({data['title']})")

        # Test 8: Static HTML Serving
        print("\n[Test 8] Static HTML GET /")
        with urllib.request.urlopen(f"{base_url}/") as resp:
            html = resp.read().decode()
            assert "YatraFlow" in html
            assert "Smart India Hackathon" in html
            print("  ✓ Passed: Static files served correctly")

        print("\n🎉 ALL 8 INTEGRATION TESTS PASSED PERFECTLY!\n")
    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_tests()
