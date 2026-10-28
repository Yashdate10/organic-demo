import json
import os
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
IS_VERCEL = bool(os.environ.get("VERCEL"))
# Vercel's filesystem is read-only except /tmp (temporary, resets often)
LOG_FILE = Path("/tmp/logs.json") if IS_VERCEL else ROOT / "logs.json"
app = FastAPI(title="Organic Farming Demo API", version="1.0")

COMPOST = [
    {"title": "Lay the brown base", "text": "Spread 15 cm of dry straw, sugarcane trash or dry leaves. This carbon layer lets air in and soaks up extra water.", "caption": "Layer 1: Straw (carbon)"},
    {"title": "Add green waste", "text": "Pile on fresh weeds, vegetable waste and crop residue. This is the nitrogen that feeds the microbes.", "caption": "Layer 2: Green waste (nitrogen)"},
    {"title": "Sprinkle dung slurry", "text": "Pour cow dung slurry (or jeevamrut) over the pile. It brings billions of helpful microbes.", "caption": "Layer 3: Microbes arrive"},
    {"title": "Keep it damp and covered", "text": "Water until moist like a squeezed sponge, not dripping. Cover with sacks or straw to hold heat and moisture.", "caption": "Layer 4: Moisture + cover"},
    {"title": "Turn and wait", "text": "Turn the heap every 15 days. In about 90 days it turns dark, crumbly and smells like forest soil. Ready to use!", "caption": "Ready: dark, crumbly compost"},
]

PESTS = [
    {"name": "Neem spray", "icon": "🌿", "how": "Mix 3–5 ml neem oil and a few drops of mild soap in 1 litre of water. Spray in the evening, on the underside of leaves too. Repeat every 7–10 days.", "targets": "aphids, whitefly, mealybugs"},
    {"name": "Trap crops", "icon": "🌼", "how": "Plant a border of marigold around the plot. Pests go for it first, so the main crop is protected and you can remove infested plants easily.", "targets": "fruit borers, nematodes"},
    {"name": "Sticky traps", "icon": "🪤", "how": "Hang yellow sticky traps just above crop height, about 10 per acre. Add pheromone traps to spot moths early before they spread.", "targets": "whitefly, leaf miners, moths"},
    {"name": "Friendly insects", "icon": "🐞", "how": "Grow coriander and fennel near the edges. Their flowers attract ladybirds and lacewings. Put T-shaped bird perches so birds eat caterpillars.", "targets": "aphids, caterpillars"},
]

ROTATION = [
    {"name": "Legume", "crops": "Green gram, soybean, groundnut", "benefit": "Fixes nitrogen from the air: free fertiliser for the next crop.", "color": "#788c5d"},
    {"name": "Leafy & fruit", "crops": "Tomato, brinjal, spinach", "benefit": "Heavy feeders. They use the nitrogen the legumes left behind.", "color": "#d97757"},
    {"name": "Root", "crops": "Onion, carrot, radish", "benefit": "Loosens deep soil and breaks the pest cycle of the previous crop.", "color": "#6a9bcc"},
    {"name": "Cereal", "crops": "Wheat, jowar, maize", "benefit": "Roots hold soil together and use leftover nutrients.", "color": "#b58a4a"},
]

# SAMPLE DATA: replace with your real measurements from the demo plot.
# Units: yield kg/acre, cost INR/acre, price INR/kg
TRIALS = [
    {"crop": "Tomato", "yield_org": 9000, "yield_conv": 11000, "cost_org": 38000, "cost_conv": 55000, "price_org": 14, "price_conv": 10},
    {"crop": "Wheat", "yield_org": 1600, "yield_conv": 2000, "cost_org": 14000, "cost_conv": 20000, "price_org": 30, "price_conv": 25},
    {"crop": "Onion", "yield_org": 8000, "yield_conv": 9500, "cost_org": 40000, "cost_conv": 52000, "price_org": 18, "price_conv": 14},
]


def with_profit(t):
    return {**t,
            "profit_org": t["yield_org"] * t["price_org"] - t["cost_org"],
            "profit_conv": t["yield_conv"] * t["price_conv"] - t["cost_conv"]}


def read_logs():
    try:
        return json.loads(LOG_FILE.read_text()) if LOG_FILE.exists() else []
    except Exception:
        return []


class LogIn(BaseModel):
    activity: Literal["compost", "pest", "rotation", "harvest", "other"]
    note: str = Field(min_length=1, max_length=300)
    cost_inr: float = Field(0, ge=0)
    yield_kg: float = Field(0, ge=0)


@app.get("/api/compost")
def compost(): return COMPOST

@app.get("/api/pests")
def pests(): return PESTS

@app.get("/api/rotation")
def rotation(): return ROTATION

@app.get("/api/comparison")
def comparison(): return [with_profit(t) for t in TRIALS]


@app.get("/api/estimate")
def estimate(crop: str, acres: float = Query(1, gt=0)):
    t = next((x for x in TRIALS if x["crop"].lower() == crop.lower()), None)
    if not t:
        raise HTTPException(404, "Unknown crop")
    r = with_profit(t)
    return {
        "crop": t["crop"], "acres": acres,
        "compost_tonnes": round(acres * 4, 1),
        "neem_oil_ml_per_spray": round(acres * 150 * 4),
        "extra_profit_inr": round((r["profit_org"] - r["profit_conv"]) * acres),
        "cost_saving_inr": round((t["cost_conv"] - t["cost_org"]) * acres),
    }


@app.get("/api/logs")
def get_logs():
    logs = read_logs()
    return {"logs": logs[::-1], "totals": {
        "entries": len(logs),
        "cost_inr": sum(l["cost_inr"] for l in logs),
        "yield_kg": sum(l["yield_kg"] for l in logs)}}


@app.post("/api/logs", status_code=201)
def add_log(entry: LogIn):
    logs = read_logs()
    logs.append({**entry.model_dump(), "date": datetime.now().strftime("%d %b %Y")})
    LOG_FILE.write_text(json.dumps(logs, indent=2))
    return {"ok": True}


# Local dev only: on Vercel, the CDN serves /public automatically
if not IS_VERCEL:
    PUBLIC = ROOT / "public"

    @app.get("/")
    def home(): return FileResponse(PUBLIC / "index.html")

    app.mount("/static", StaticFiles(directory=PUBLIC / "static"), name="static")