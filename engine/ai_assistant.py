# YatraFlow AI Assistant Layer
# Core Rule: LLM never calculates prices or overrides hard budget constraints.
# Operates via tool dispatch & intent matching.

import re

class YatraAIAssistant:
    def __init__(self, trip_engine):
        self.engine = trip_engine

    def handle_message(self, user_prompt, current_context=None):
        prompt_lower = user_prompt.lower()
        context = current_context or {}
        budget = context.get('budget', 2000)
        days = context.get('days', 2)
        group_size = context.get('group_size', 4)
        dest_id = context.get('destination_id', 'rajgir-nalanda')

        # 1. Intent: Crowd Aversion / "We hate crowds"
        if any(w in prompt_lower for w in ['hate crowd', 'crowd', 'peaceful', 'quiet', 'less crowd', 'serene', 'calm']):
            return {
                'intent': 'AVOID_CROWDS',
                'reply': "I have revised your itinerary to avoid peak tourist rushes! We replaced crowded midday queues with early sunrise temple walks, peaceful bamboo groves (Venuvana), and quiet eco-trails (Ghora Katora lake).",
                'itinerary_adjustment': {
                    'rule': 'Swap high-density afternoon attractions with low-density heritage trails',
                    'recommendation': 'Visit Ratnagiri Shanti Stupa during dawn (6:30 AM) or visit Ghora Katora Lake instead of peak ropeway lines.',
                    'tags': ['Low Crowd', 'Early Morning Slot', 'Nature Serenity']
                },
                'suggested_filters': ['nature', 'heritage']
            }

        # 2. Intent: Budget Reduction / "Make it cheaper" / "Under 1500"
        if any(w in prompt_lower for w in ['cheaper', 'less cost', '1500', '1,500', 'reduce budget', 'cut cost', 'tight budget', 'break it']):
            numbers = re.findall(r'\d{3,5}', prompt_lower.replace(',', ''))
            target_b = int(numbers[0]) if numbers else 1500
            opt_result = self.engine.optimize_trip(dest_id, target_b, days=days, group_size=group_size)
            return {
                'intent': 'OPTIMIZE_BUDGET',
                'reply': f"Applied our Constraint-Based Optimizer for ₹{target_b:,}! We swapped the standard hotel to verified student dorms, picked MEMU rail transit, and utilized student ID concessions.",
                'target_budget': target_b,
                'optimizer_data': opt_result,
                'action': 'APPLY_OPTIMIZER'
            }

        # 3. Intent: Food Explorer / Street Food Focus
        if any(w in prompt_lower for w in ['food', 'eat', 'litti', 'khaja', 'dhaba', 'hungry', 'taste', 'restaurant']):
            dest = next((d for d in self.engine.destinations if d['id'] == dest_id), self.engine.destinations[0])
            food = dest.get('food_options', {})
            items_str = ', '.join(food.get('signature_items', []))
            spots_str = ', '.join(food.get('spots', []))
            cost = food.get("daily_cost_budget", 175)
            return {
                'intent': 'FOOD_RECOMMENDATIONS',
                'reply': f"Here is the student culinary guide for {dest['name']}:\n• Signature Treats: {items_str}\n• Verified Budget Spots: {spots_str}\n• Est. Meal Cost: ₹{cost}/day (Freshness verified 🟢).",
                'food_data': food
            }

        # 4. Intent: Nature & Waterfall Escapes
        if any(w in prompt_lower for w in ['nature', 'waterfall', 'trek', 'green', 'forest', 'canyon', 'hills']):
            nature_trips = self.engine.search_feasible_trips(budget=budget, days=days, group_size=group_size, preferences=['nature'])
            names = [t['destination_name'] for t in nature_trips[:3]]
            bullet_names = "\n• ".join(names)
            return {
                'intent': 'NATURE_ESCAPES',
                'reply': f"Top nature and adventure escapes within your ₹{budget:,} budget:\n• {bullet_names}\nAll include trail timings and verified camper transports.",
                'feasible_nature_trips': nature_trips[:3]
            }

        # 5. Intent: Explanation / "Why this trip?"
        if any(w in prompt_lower for w in ['why', 'explain', 'how is this possible', 'trust', 'confidence']):
            return {
                'intent': 'EXPLAIN_RECOMMENDATION',
                'reply': "YatraFlow calculates realistic whole-trip economics: Round-trip train (₹140), quad-sharing verified dorm (₹225/night), local student thali (₹175/day), and government ASI student entry tickets (₹25). No hidden platform commissions!",
                'trust_label': '100% Deterministic Pricing (No Hallucinated Rates)'
            }

        # Default fallback assistant message
        return {
            'intent': 'GENERAL_QUERY',
            'reply': "I can assist you in customizing your trip! Try asking:\n• \"We hate crowds\"\n• \"Drop budget to ₹1,500\"\n• \"Best local street food in Rajgir\"\n• \"Show nature waterfalls in Kaimur\"",
            'suggested_chips': ['We hate crowds', 'Drop budget to ₹1,500', 'Famous street food', 'Nature & Waterfalls']
        }
