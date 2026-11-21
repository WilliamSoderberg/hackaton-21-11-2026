# Emergency call co-pilot: test data

**Everything here is SYNTHETIC.** Written by Claude (AI) on 21 Nov 2026 for the Hacking Healthcare hackathon in Lund. No real patients, real calls or real people. Addresses are real Lund-area street names used only for realism. **Not clinically validated** – do not use for real triage.

## Files

| File | What it is |
|---|---|
| `classification_guide.md` | Human-readable guide: urgency levels A–E, 8 symptom categories, each with urgency criteria, red-flag phrases, key questions, ambulance rule, crew supplies and caller instructions. Good to paste into a Claude system prompt. |
| `classification_guide.json` | Same content as JSON (`urgency_levels`, `rules`, `categories[]`, `sources`). Category `id`s are the allowed values for `category`. |
| `calls/call_XX_*.json` | One synthetic call each: `transcript` (timestamped turns, `t` in seconds, `speaker` = operator/caller) + `gold_label`. |
| `calls/call_XX_*.txt` | Same transcript as plain text, for reading aloud / recording / feeding to speech-to-text. |
| `calls/all_calls.jsonl` | All calls, one JSON object per line, for batch evaluation. |
| `source/` | Python that generates all of the above (`python3 source/build.py`). **In the team repo only `README.md`, `classification_guide.md` and `source/` are committed. Run `python3 data/source/build.py` once to generate `classification_guide.json` and everything in `calls/`.** (Full set is also in data.zip.) It also checks that every red-flag quote appears verbatim in exactly one transcript turn. Edit `calls.py` / `guide.py` and re-run. |

## Evaluation: how good is the classifier?

`data/eval/eval_classifier.ts` sends every call to the backend (`POST /api/classify`) and compares the answer with `gold_label.dashboard` (same labels as the dashboard: Low/Medium/High/Critical, ambulance true/false, physical/mental/both). It works in both backend modes, so you get a "before" (keyword) and "after" (Claude) number.

```
python3 data/source/build.py                      # generates data/calls/*
cd backend && cargo run                           # keyword mode; set ANTHROPIC_API_KEY for Claude mode
node --experimental-strip-types data/eval/eval_classifier.ts   # from repo root, in another terminal
```

Results are written to `data/eval/results_keyword.md` or `data/eval/results_claude.md`.

Keyword mode (measured 21 Nov on calls 01-12): **urgency exact 1/13, under-triaged 11/13, ambulance 6/12, red flags matched ~8/59.** Keywords miss downplaying callers, agonal breathing, atypical heart attack, stroke described in broken English and hidden suicide risk.

## Calls (33 calls, 32 scenarios)

| Call | Scenario | Category | Urgency | Ambulance | Tricky part |
|---|---|---|---|---|---|
| 01 | Man 58, classic heart attack | chest_pain | A | yes | baseline |
| 02 | Woman 67, nausea + jaw pain ("flu") | chest_pain | A | yes | atypical MI, caller unsure |
| 03 | Wife "a bit sleepy", snoring breaths | unconscious_cardiac_arrest | A | yes | caller downplays, agonal breathing, telephone CPR |
| 04 | Teen, peanuts, lips swelling | allergic_reaction | A | yes | EpiPen not used yet |
| 05 | Father with face droop | stroke | A | yes | language barrier (English + Swedish words), onset unclear |
| 06 | 3-year-old seizing with fever | seizure | A | yes | panicking caller |
| 07a | Car vs cyclist, witness | traffic_trauma | A | yes | multi-caller incident (part 1) |
| 07b | Same collision, driver | traffic_trauma | A | yes | same `incident_id`, 2nd patient, status update |
| 08 | "Just want to talk", can't sleep | mental_health_suicide | A | yes | hidden suicide risk, overdose revealed late |
| 09 | COPD, speaks in single words | breathing_difficulty | A | yes | fragmented speech is the red flag |
| 10 | Itchy rash after new detergent | allergic_reaction | D | **no** | negative control (over-triage test) |
| 11 | Speech trouble that went away, AF | stroke | B | yes | TIA, symptoms resolved |
| 12 | Known epilepsy, typical seizure, awake | seizure | C | **unclear** | borderline, AI should ask, not guess |
| 13 | Grandma won't wake up, caller is 8 years old | unconscious_cardiac_arrest | A | yes | child caller alone, hypoglycaemia |
| 14 | Shrimp allergy, throat tight (**whole call in Swedish**) | allergic_reaction | A | yes | non-English transcript, no EpiPen |
| 15 | "He's not breathing" then line drops | unconscious_cardiac_arrest | A | yes | dropped call, partial address |
| 16 | Teenagers report fake bus accident | traffic_trauma | E | **no** | prank call, admits hoax |
| 17 | E-scooter fall, deformed wrist | traffic_trauma | C | **unclear** | obvious injury but stable, own transport |
| 18 | Boy 10, asthma, inhaler not helping | breathing_difficulty | B | yes | partial response, child |
| 19 | Woman 24, chest tight + tingling hands | chest_pain | C | **unclear** | panic attack mimics MI |
| 20 | Woman 84 on floor since night, leg turned out | traffic_trauma | B | yes | long lie, hip fracture, warfarin |
| 21 | Man seizing 7 min at gym | seizure | A | yes | status epilepticus, unknown history |
| 22 | Tearing chest pain to the back | chest_pain | A | yes | aortic dissection (no aspirin) |
| 23 | Woke up with weak left side | stroke | A | yes | wake-up stroke, last seen well |
| 24 | Man 38 at party, "just drunk" | stroke | A | yes | symptoms blamed on alcohol |
| 25 | Goodbye text, boyfriend not answering | mental_health_suicide | A | yes | third-party caller, firearm, police lead |
| 26 | Daughter 16 cut her forearm | mental_health_suicide | B | yes | self-harm, bleeding controlled |
| 27 | Car on roof on E22, driver trapped | traffic_trauma | A | yes | rescue + police, fuel leak |
| 28 | Low-speed rear-end, nobody hurt | traffic_trauma | E | **no** | negative control |
| 29 | Cough and cold 3 days | breathing_difficulty | D | **no** | negative control |
| 30 | Burning chest after curry, known reflux | chest_pain | D | **no** | negative control for chest pain |
| 31 | Lip swelling after new penicillin | allergic_reaction | C | **unclear** | borderline allergy |
| 32 | Friend barely breathing after heroin | unconscious_cardiac_arrest | A | yes | caller fears police, naloxone |

## Gold label fields

- `category`, `secondary_categories` – ids from the guide
- `urgency` (A–E) + `urgency_rationale`
- `urgency_timeline` – what urgency a good co-pilot should show at each point in the call (for live demo: urgency only goes **up** automatically)
- `ambulance`: yes / no / unclear; `other_resources` (police, interpreter, rescue service…)
- `red_flags[]` – `label`, exact `quote`, `turn_index`, `t` (seconds), `speaker`. Use the quote to highlight the call moment.
- `negative_findings[]` (some calls) – reassuring quotes that justify a lower urgency
- `missing_questions` – important questions the operator did **not** ask (the co-pilot should suggest these)
- `supplies` – what the crew should bring
- `handover` – reference ambulance handover summary
- `crew_briefing` – what the ambulance crew gets at dispatch: `crew`, `extra_units` (police, rescue, interpreter…), `lights_and_sirens`, `destination` (suggested Lund hospital), `pre_alert`, `prepare_en_route`, `bring` (supplies), `key_facts`, `scene_notes`, `open_questions`. `null` when no ambulance is sent. Templates per category + call-specific facts live in `source/crew.py`.
- `dashboard` – the same gold label mapped to the dashboard's fields: `urgency` (A→Critical, B→High, C→Medium, D/E→Low), `ambulance` (true/false/null = unclear), `type` (physical / mental / both)
- extras: `patients` (07b, two patients), `translations` (05)

Suggested scoring: category accuracy, urgency exact + within-one, ambulance accuracy, red-flag recall (does the model's quote overlap the gold quote), missing-question recall (judge with Claude).

## Sources and licenses

- **Our files:** created today by our team with Claude; use freely in the hackathon project.
- **Dansk Indeks for Akuthjælp 1.8** (Region Nordjylland / Laerdal Foundation) – we used only the *structure* (symptom group → criteria → urgency A–E). No text copied; the document may not be redistributed. https://dpv.rn.dk/-/media/Hospitaler/Den-Praehospitale-Virksomhed/Dansk-Indeks-1-8-Landsudgaven.ashx?la=da
- **RETTS vital parameters, Region Skåne** (© Predicare) – colour-level concept only; PDF could not be downloaded from our environment today, no numbers copied. https://vardgivare.skane.se:443/siteassets/1.-vardriktlinjer/traumamanual/retts-vitalparametrar.pdf
- **1177 Skåne** – Swedish three-level ambulance priority description.
- **HF `spikecodes/911-call-transcripts`** (MIT tag, empty README, provenance unknown, 518 calls, `messages` role/content, no timestamps) – looked at for conversational style only (disfluencies, "112/911, what's your emergency?" opening). Nothing copied, not included here.
- Medical content (FAST, telephone CPR, anaphylaxis signs etc.) is general first-aid knowledge written in our own words.

## Ambulance model (`model/`)

A small trained "ambulance or not" classifier over the whole responder + caller conversation: TF-IDF (word unigrams + bigrams) and logistic regression, plain Python, no dependencies.

```
python3 data/model/train_ambulance.py    # ~1 min; writes frontend/app/lib/ambulanceModel.json + data/model/results.md
```

- Trains on the calls above with `ambulance` yes/no ("unclear" is left out), including partial transcripts so it works mid-call, plus `model/extra_training_calls.py`: 24 extra SYNTHETIC calls, mostly no-ambulance, because the main set has only 5.
- Leave-one-call-out on the main set: **27/29** (ambulance 23/24, no ambulance 4/5). Misses: 07a (collision witness) and 16 (prank call). Full table in `model/results.md`.
- The frontend runs it in the browser (`frontend/app/lib/ambulanceModel.ts`, which must tokenise exactly like the Python). The dashboard's **Ambulance** tile re-scores the live conversation every 2 s; **Model testbench** (`/testbench`) lets you paste a conversation and see the verdict, the score turn by turn, and the words that drove it.
- Tiny synthetic dataset: it partly learns surface cues (e.g. third-person "he/she" calls lean ambulance). Not clinically validated.
