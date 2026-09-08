#!/usr/bin/env python3
"""
Unit tests for YatraFlow Engine, Optimizer and AI Copilot
Runs directly in-process without network socket overhead.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from engine.trip_engine import TripEngine
from engine.ai_assistant import YatraAIAssistant

def test_engine():
    engine = TripEngine()
    ai = YatraAIAssistant(engine)

    print("Test 1: Destinations data loaded")
    assert len(engine.destinations) >= 5, f"Expected >= 5 destinations, got {len(engine.destinations)}"
    print(f"  ✓ {len(engine.destinations)} Bihar destinations loaded.")

    print("\nTest 2: Search Feasible Trips for ₹2,000 (Patna, 2 days, 4 students)")
    trips = engine.search_feasible_trips(budget=2000, origin="patna", days=2, group_size=4)
    assert len(trips) >= 3, "Expected at least 3 trips"
    feasible = [t for t in trips if t["is_feasible"]]
    assert len(feasible) >= 3, f"Expected at least 3 feasible trips, got {len(feasible)}"
    print(f"  ✓ {len(feasible)} trips within ₹2,000 budget:")
    for t in feasible:
        print(f"     • {t['destination_name']} ({t['badge']}): ₹{t['total_cost_per_person']} [Remaining ₹{t['remaining_balance']}]")

    print("\nTest 3: Budget Constraint & Over-Budget Detection for ₹1,500")
    # Rajgir standard trip total is 1780
    rajgir_trip = engine.assemble_trip(engine.destinations[0], budget=1500, days=2, group_size=4, prefer_tier='standard')
    assert rajgir_trip["is_feasible"] is False
    assert rajgir_trip["total_cost_per_person"] > 1500
    print(f"  ✓ Over-budget accurately caught: Total ₹{rajgir_trip['total_cost_per_person']} vs Budget ₹1,500 ({rajgir_trip['status']})")

    print("\nTest 4: Slide 07 Optimizer Benchmark Test")
    opt = engine.optimize_trip('rajgir-nalanda', target_budget=2000, days=2, group_size=4)
    assert opt["before"]["total_cost_per_person"] == 2260
    assert opt["before"]["over_budget_amount"] == 260
    assert opt["after"]["total_cost_per_person"] == 1960
    assert opt["after"]["is_feasible"] is True
    assert opt["after"]["remaining_balance"] == 40
    print(f"  ✓ Slide 07 canonical optimizer verified:")
    print(f"     Before Total: ₹{opt['before']['total_cost_per_person']} (Over by ₹{opt['before']['over_budget_amount']})")
    for s in opt["swaps"]:
        print(f"     - Swap: {s['title']} (-₹{s['savings']}) -> {s['detail']}")
    print(f"     After Total: ₹{opt['after']['total_cost_per_person']} ({opt['after']['status']}, ₹{opt['after']['remaining_balance']} remaining)")

    print("\nTest 5: Group Cost Splitter (Slide 08 Module 6)")
    split = engine.calculate_group_split('rajgir-nalanda', days=2, group_size=4)
    assert split["group_size"] == 4
    assert split["cost_per_student"] * 4 == split["total_group_cost"]
    print(f"  ✓ Group math: 4 students x ₹{split['cost_per_student']} = ₹{split['total_group_cost']}")
    print(f"     Allocation: {split['room_allocation']['rooms_needed']} room ({split['room_allocation']['sharing_type']})")

    print("\nTest 6: AI Copilot Intent Handling ('We hate crowds')")
    r1 = ai.handle_message("We hate crowds.")
    assert r1["intent"] == "AVOID_CROWDS"
    print(f"  ✓ Handled 'We hate crowds': {r1['reply'][:80]}...")

    print("\nTest 7: AI Copilot Intent Handling ('Drop budget to ₹1,500')")
    r2 = ai.handle_message("Drop budget to 1500")
    assert r2["intent"] == "OPTIMIZE_BUDGET"
    assert r2["target_budget"] == 1500
    print(f"  ✓ Handled budget reduction intent: target = ₹{r2['target_budget']}")

    print("\nTest 8: AI Copilot Intent Handling ('Street food spots')")
    r3 = ai.handle_message("Show me local street food and dhabas")
    assert r3["intent"] == "FOOD_RECOMMENDATIONS"
    print(f"  ✓ Handled food explorer intent: {r3['reply'][:80]}...")

    print("\nTest 9: Static file validation")
    static_dir = os.path.join(BASE_DIR, 'static')
    for fname in ['index.html', 'styles.css', 'app.js']:
        fpath = os.path.join(static_dir, fname)
        assert os.path.exists(fpath) and os.path.getsize(fpath) > 100
        print(f"  ✓ {fname} exists ({os.path.getsize(fpath)} bytes)")

    print("\n=======================================================")
    print("🎯 ALL 9 IN-PROCESS UNIT & INTEGRATION TESTS PASSED 100%")
    print("=======================================================\n")

if __name__ == "__main__":
    test_engine()
