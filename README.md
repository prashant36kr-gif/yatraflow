# YatraFlow — Budget-First Smart Tourism Platform

> *"Don't search for a trip. Start with your budget."*

A platform that turns a fixed budget into a complete trip — destination, transport, stay, food, activities and itinerary. Originally designed to help students and budget travelers explore India (starting with Bihar and neighboring states) affordably.

---

## Key Features

1. **Budget-First Trip Assembly**:
   - Input your fixed budget (e.g., ₹1,500 – ₹3,000), starting city, duration, and group size.
   - Instantly generates all feasible complete trips with transparent itemized cost breakdown.

2. **Constraint-Based Budget Optimizer**:
   - When a trip exceeds limits (e.g. Total ₹2,260 vs Budget ₹2,000 → Over by ₹260):
   - Optimizer suggests and swaps components:
     - Hotel Swap: Private AC Room → Verified Student Quad Dorm (-₹200)
     - Transport Swap: Private Cab → MEMU / Express Train (-₹180)
     - Activity Swap: Commercial Tour → Student Pass (-₹100)
   - Result: ₹1,960 (WITHIN BUDGET ✅, ₹40 remaining).

3. **Smart Explorer**:
   - Curated destinations covering famous UNESCO sites (Rajgir, Nalanda, Bodh Gaya) and hidden gems (Tutla Bhawani Waterfall, Rohtasgarh Fort, Valmiki Tiger Reserve, Kakolat Falls, Vaishali, and neighboring states).
   - Real, verified photography from Wikimedia Commons.
   - Smart Tips, Transit Hacks, and Food recommendations for each location.

4. **Group Cost Splitter**:
   - Quad-sharing room allocation math.
   - Division of shared fixed costs (hotels, cabs) vs individual variable costs (food, entry tickets).
   - 1-click WhatsApp split share.

5. **AI Travel Copilot**:
   - Natural language itinerary editor with strict architectural guardrail: *The LLM never calculates prices or overrides hard budget constraints.*
   - Supports: "We hate crowds", "Budget under ₹1,500", "Local street food guide".

6. **1-Click Interactive Live Demo**:
   - A built-in guided 5-step pitch script right in the top navigation!

---

## Quick Start & Running the Website

The platform runs out-of-the-box with **zero third-party dependencies** using Python's built-in engine:

```bash
git clone https://github.com/yourusername/yatraflow.git
cd yatraflow
python3 server.py 8080
```

Open your browser at:
👉 **[http://localhost:8080](http://localhost:8080)**

Alternatively, just open `static/index.html` directly in your browser. The embedded data works fully offline!

### Enterprise FastAPI Alternative
```bash
pip install -r requirements.txt
uvicorn fastapi_app:app --host 0.0.0.0 --port 8000 --reload
```

---

## Directory Structure

```
yatraflow/
├── server.py              # Zero-dependency multi-threaded Python HTTP/REST API server
├── fastapi_app.py         # FastAPI production API gateway
├── requirements.txt       # Production dependencies
├── data/
│   └── destinations.json  # Comprehensive tourism database with verified prices
├── engine/
│   ├── trip_engine.py     # Deterministic cost matrix assembler & budget optimizer
│   └── ai_assistant.py    # Intent interpreter & itinerary modifier (guardrailed)
├── static/
│   ├── index.html         # Responsive modern PWA frontend
│   ├── styles.css         # UI design system
│   ├── destinations_embedded.js # Data embedded for offline static execution
│   └── app.js             # Interactive client logic, modals, and demo runner
└── test_inmemory.py       # Comprehensive unit test suite
```

## Licensing & Assets
Destination photography is sourced from [Wikimedia Commons](https://commons.wikimedia.org/) under Creative Commons or Public Domain licenses. Ensure adherence to respective attribution requirements if hosting publicly.
