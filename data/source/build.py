import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from guide import URGENCY_LEVELS, RULES, CATEGORIES, SOURCES
from calls import CALLS
from crew import CATEGORY_BRIEFING, CALL_BRIEFING
from locations import HOSPITALS, CALL_LOCATIONS

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..") + "/"
os.makedirs(OUT + "calls", exist_ok=True)
NOTE = "SYNTHETIC - written by AI for a hackathon demo. Not real patient data. Not clinically validated."

DASH_URGENCY = {"A": "Critical", "B": "High", "C": "Medium", "D": "Low", "E": "Low"}

def mmss(s): return f"{s//60:02d}:{s%60:02d}"

# ---- guide
guide = {"_note": NOTE.replace("written by AI", "classification guide written by AI in our own words"),
         "urgency_levels": URGENCY_LEVELS, "rules": RULES, "categories": CATEGORIES, "sources": SOURCES}
json.dump(guide, open(OUT + "classification_guide.json", "w"), indent=2, ensure_ascii=False)

md = ["# Emergency call classification guide", "",
      f"> {guide['_note']} Structure inspired by Dansk Indeks (symptom group -> criteria -> A-E) and RETTS colour levels; all text is our own.", "",
      "## Urgency levels", "", "| Level | Colour | Meaning | Response |", "|---|---|---|---|"]
for k, v in URGENCY_LEVELS.items():
    md.append(f"| **{k}** | {v['color']} | {v['name']} | {v['response']} |")
md += ["", "## Rules for the co-pilot", ""] + [f"- {r}" for r in RULES] + [""]
for c in CATEGORIES:
    md += [f"## {c['name']} (`{c['id']}`)", "", "**Urgency criteria**", ""]
    for lvl, crit in c["urgency"].items():
        if crit: md.append(f"- **{lvl}:** " + "; ".join(crit))
    md += ["", "**Red-flag phrases:** " + ", ".join(f"\"{p}\"" for p in c["red_flags"]), "",
           "**Key questions the operator must ask**", ""] + [f"1. {q}" for q in c["key_questions"]]
    md += ["", f"**Ambulance:** {c['ambulance']}", "", "**Supplies for the crew:** " + ", ".join(c["supplies"]), "",
           "**Operator instructions to caller:** " + "; ".join(c["operator_instructions"]), ""]
md += ["## Sources", ""] + [f"- {s['name']}" + (f" ({s['url']})" if s["url"] else "") + f": {s['use']}" for s in SOURCES]
open(OUT + "classification_guide.md", "w").write("\n".join(md) + "\n")

# ---- calls
cat_ids = {c["id"] for c in CATEGORIES}
errors, index = [], []

def locate(cid, turns, label, quote):
    hits = [i for i, t in enumerate(turns) if quote in t["text"]]
    if len(hits) != 1:
        errors.append(f"{cid}: quote {quote!r} found in {len(hits)} turns")
        return None
    i = hits[0]
    return {"label": label, "quote": quote, "turn_index": i, "t": turns[i]["t"], "speaker": turns[i]["speaker"]}

all_jsonl = []
for call in CALLS:
    cid = call["call_id"]
    turns = [{"t": s, "time": mmss(s), "speaker": sp, "text": tx} for s, sp, tx in call["turns"]]
    g = dict(call["gold"])
    assert g["category"] in cat_ids, cid
    for sc in g["secondary_categories"]: assert sc in cat_ids, (cid, sc)
    assert g["urgency"] in "ABCDE" and g["ambulance"] in ("yes", "no", "unclear")
    g["red_flags"] = [locate(cid, turns, l, q) for l, q in g["red_flags"]]
    if "negative_findings" in g:
        g["negative_findings"] = [locate(cid, turns, l, q) for l, q in g["negative_findings"]]
    g["urgency_timeline"] = [{"t": t, "time": mmss(t), "urgency": u} for t, u in g["urgency_timeline"]]
    cats = [g["category"]] + g["secondary_categories"]
    mental = "mental_health_suicide" in cats
    # Same labels as the dashboard (frontend/app/lib/calls.ts): Low/Medium/High/Critical, ambulance bool, physical vs mental
    g["dashboard"] = {"urgency": DASH_URGENCY[g["urgency"]],
                      "ambulance": {"yes": True, "no": False}.get(g["ambulance"]),
                      "type": ("both" if len(cats) > 1 else "mental") if mental else "physical"}
    # Crew briefing: what the ambulance crew gets at dispatch (category template + call-specific facts)
    if g["ambulance"] == "no":
        g["crew_briefing"] = None
    else:
        cb = dict(CATEGORY_BRIEFING[g["category"]])
        cb.update(CALL_BRIEFING[cid])
        cb["urgency"] = g["urgency"]
        cb["bring"] = g["supplies"]
        cb["extra_units"] = cb["extra_units"] + [r for r in g["other_resources"] if r not in cb["extra_units"]]
        cb["open_questions"] = g["missing_questions"]
        if g["ambulance"] == "unclear":
            cb["note"] = "Dispatch not decided - briefing applies if an ambulance is sent."
        loc = CALL_LOCATIONS.get(cid)
        if loc:
            cb["unit"] = loc["unit"]
            cb["ambulance_position"] = {"lat": loc["amb_lat"], "lng": loc["amb_lng"]}
            cb["destination_hospital"] = HOSPITALS[loc["hospital"]]
        g["crew_briefing"] = cb
    loc = CALL_LOCATIONS.get(cid)
    if not loc:
        errors.append(f"{cid}: no synthetic location in locations.py")
    rec = {"call_id": cid, "synthetic": True, "_note": NOTE, "title": call["title"],
           "incident_id": call.get("incident_id", cid), "language": call.get("language", "en"),
           "location": {"address": loc["address"], "lat": loc["lat"], "lng": loc["lng"]} if loc else None,
           "tricky_aspects": call["tricky"], "duration_s": turns[-1]["t"], "transcript": turns, "gold_label": g}
    json.dump(rec, open(f"{OUT}calls/{cid}.json", "w"), indent=2, ensure_ascii=False)
    txt = [f"# {NOTE}", f"# {cid}: {call['title']}", ""] + [f"[{t['time']}] {t['speaker'].upper()}: {t['text']}" for t in turns]
    open(f"{OUT}calls/{cid}.txt", "w").write("\n".join(txt) + "\n")
    all_jsonl.append(json.dumps(rec, ensure_ascii=False))
    index.append((cid, call["title"], g["category"], g["urgency"], g["ambulance"], rec["incident_id"]))

open(OUT + "calls/all_calls.jsonl", "w").write("\n".join(all_jsonl) + "\n")

# ---- ambulance crew page (frontend/app/crew): one entry per dispatched incident.
# Written into the frontend and committed, so the Docker build (context ./frontend) can bundle it.
# Calls sharing an incident_id (07a/07b) are merged; the later call is the newest update.
def uniq(items): return list(dict.fromkeys(items))

cat_names = {c["id"]: c["name"] for c in CATEGORIES}
incidents = {}
for line in all_jsonl:
    rec = json.loads(line)
    g = rec["gold_label"]
    cb = g["crew_briefing"]
    if not cb or not rec["location"] or not cb.get("unit"):
        continue
    inc = incidents.get(rec["incident_id"])
    if inc is None:
        inc = incidents[rec["incident_id"]] = {
            "incident_id": rec["incident_id"], "title": rec["title"], "calls": [],
            "category": g["category"], "category_name": cat_names[g["category"]],
            "address": rec["location"]["address"], "scene": {"lat": rec["location"]["lat"], "lng": rec["location"]["lng"]},
            "urgency": cb["urgency"], "handover": [],
            **{k: [] for k in ("extra_units", "prepare_en_route", "bring", "key_facts", "scene_notes", "open_questions", "red_flags")}}
    inc["calls"].append({"call_id": rec["call_id"], "title": rec["title"]})
    if len(inc["calls"]) > 1:
        inc["title"] = inc["calls"][0]["title"].split(", call ")[0] + f" ({len(inc['calls'])} calls)"
    inc["urgency"] = min(inc["urgency"], cb["urgency"])
    inc["urgency_name"] = URGENCY_LEVELS[inc["urgency"]]["name"]
    inc["dashboard_urgency"] = DASH_URGENCY[inc["urgency"]]
    for k in ("crew", "lights_and_sirens", "destination", "pre_alert", "unit", "ambulance_position", "destination_hospital", "note"):
        if k in cb: inc[k] = cb[k]
    for k in ("extra_units", "prepare_en_route", "bring", "key_facts", "scene_notes", "open_questions"):
        inc[k] = uniq(inc[k] + cb[k])
    inc["red_flags"] += [dict(f, time=mmss(f["t"]), call_id=rec["call_id"]) for f in g["red_flags"]]
    inc["handover"].append(g["handover"])

CREW_OUT = OUT + "../frontend/app/crew/incidents.json"
os.makedirs(os.path.dirname(CREW_OUT), exist_ok=True)
json.dump({"_note": NOTE + " Generated by data/source/build.py - do not edit by hand.", "incidents": list(incidents.values())},
          open(CREW_OUT, "w", encoding="utf-8", newline="\n"), indent=2, ensure_ascii=False)

print("\n".join(errors) or "all quotes verified")
for r in index: print(" | ".join(r))
print(f"{len(incidents)} crew incidents -> frontend/app/crew/incidents.json")
