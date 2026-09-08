"""
YatraFlow - FastAPI Production API Gateway
Matches Slide 10 Architecture: Python • FastAPI • REST APIs
"""

import sys
import os
from typing import List, Optional
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.trip_engine import TripEngine
from engine.ai_assistant import YatraAIAssistant

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
except ImportError:
    FastAPI = None

engine = TripEngine()
ai = YatraAIAssistant(engine)

if FastAPI:
    app = FastAPI(title="YatraFlow API", description="Budget-First Smart Tourism for Students", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class TripSearchParams(BaseModel):
        budget: int = 2000
        origin: str = "patna"
        days: int = 2
        group_size: int = 4
        preferences: Optional[List[str]] = ["all"]

    class OptimizeParams(BaseModel):
        destination_id: str = "rajgir-nalanda"
        target_budget: int = 2000
        days: int = 2
        group_size: int = 4

    class GroupSplitParams(BaseModel):
        destination_id: str = "rajgir-nalanda"
        days: int = 2
        group_size: int = 4
        tier: str = "standard"

    class ChatMessage(BaseModel):
        message: str
        context: Optional[dict] = None

    @app.get("/api/health")
    def health_check():
        return {"status": "ok", "service": "YatraFlow FastAPI", "version": "1.0.0"}

    @app.get("/api/destinations")
    def get_destinations(category: Optional[str] = None, tag: Optional[str] = None):
        dests = engine.get_destinations(category, tag)
        return {"origins": engine.origins, "destinations": dests, "total": len(dests)}

    @app.post("/api/trips/search")
    def search_trips(params: TripSearchParams):
        trips = engine.search_feasible_trips(params.budget, params.origin, params.days, params.group_size, params.preferences)
        return {
            "budget": params.budget,
            "origin": params.origin,
            "days": params.days,
            "group_size": params.group_size,
            "preferences": params.preferences,
            "total_results": len(trips),
            "feasible_count": sum(1 for t in trips if t['is_feasible']),
            "trips": trips
        }

    @app.post("/api/trips/optimize")
    def optimize_trip(params: OptimizeParams):
        result = engine.optimize_trip(params.destination_id, params.target_budget, params.days, params.group_size)
        if not result:
            raise HTTPException(status_code=400, detail="Optimization failed")
        return result

    @app.post("/api/trips/split")
    def split_group_costs(params: GroupSplitParams):
        split = engine.calculate_group_split(params.destination_id, params.days, params.group_size, params.tier)
        if not split:
            raise HTTPException(status_code=400, detail="Split calculation failed")
        return split

    @app.post("/api/ai/chat")
    def ai_chat(payload: ChatMessage):
        return ai.handle_message(payload.message, payload.context)

    # Mount static frontend
    static_dir = os.path.join(BASE_DIR, "static")
    if os.path.exists(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fastapi_app:app", host="0.0.0.0", port=8000, reload=True)
