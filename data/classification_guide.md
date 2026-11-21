# Emergency call classification guide

> SYNTHETIC - classification guide written by AI in our own words for a hackathon demo. Not real patient data. Not clinically validated. Structure inspired by Dansk Indeks (symptom group -> criteria -> A-E) and RETTS colour levels; all text is our own.

## Urgency levels

| Level | Colour | Meaning | Response |
|---|---|---|---|
| **A** | red | Life-threatening | Nearest ambulance now, lights and sirens. Operator gives first aid instructions (CPR, EpiPen, recovery position) while waiting. |
| **B** | orange | Urgent, potentially serious | Ambulance as soon as possible, sirens at crew's discretion. Re-check symptoms every few minutes and raise to A if they worsen. |
| **C** | yellow | Needs assessment, stable now | Ambulance without lights, or other transport to emergency care. Caller told to call back if worse. |
| **D** | green | Not urgent | No ambulance. Advice and referral to 1177 / health centre / own transport. |
| **E** | blue | Other help | No medical response needed now. Police, social services, poison info or other agency. |

## Rules for the co-pilot

- AI suggests, the human operator decides. AI may RAISE urgency on its own; only a human can LOWER it.
- Every red flag shown to the operator must carry the exact quote from the call that triggered it.
- When information is missing, the category is uncertain: show the missing question instead of guessing low.
- If several categories fit, the most urgent one sets the urgency.

## Chest pain / suspected heart attack (`chest_pain`)

**Urgency criteria**

- **A:** chest pain or pressure with sweating, nausea, shortness of breath, pallor or fainting; pain spreading to arm, jaw, neck or back; known heart disease and pain not like usual / not helped by own nitro; atypical presentation in women, elderly or diabetics: nausea, jaw/upper back pain, unusual fatigue, 'feels like flu'
- **B:** chest pain now gone (< 12 h) in someone over 30; chest pain with palpitations but otherwise stable
- **C:** pain clearly linked to movement or pressing on the chest, young and otherwise healthy
- **D:** long-standing, known, unchanged pain with a clear non-cardiac cause

**Red-flag phrases:** "pressure", "crushing", "like an elephant on my chest", "sweating", "cold and clammy", "pain going down my arm", "jaw hurts", "feel sick / threw up", "short of breath", "grey / pale", "fainted", "nitro isn't helping"

**Key questions the operator must ask**

1. Is the person awake and breathing normally?
1. When did the pain start?
1. Where is the pain and does it spread (arm, jaw, back)?
1. Sweating, nausea, short of breath?
1. Any heart disease, previous heart attack, diabetes?
1. Age?
1. Do they have nitroglycerin or aspirin, and are they allergic to aspirin?

**Ambulance:** Yes for A and B.

**Supplies for the crew:** 12-lead ECG, defibrillator (AED), oxygen, aspirin, nitroglycerin, IV access kit

**Operator instructions to caller:** Sit the person down, loosen clothing; Aspirin 300 mg chewed if not allergic (per local protocol); Have someone fetch nearest AED; Call back immediately if they collapse

## Breathing difficulty (`breathing_difficulty`)

**Urgency criteria**

- **A:** can only say a few words between breaths; blue or grey lips/face; drowsy, confused or exhausted; noisy breathing / stridor, choking; breathing difficulty with chest pain
- **B:** clearly short of breath but can talk in sentences; known asthma/COPD, own medication not helping; fever plus breathing difficulty in elderly
- **C:** mild breathlessness on exertion only, stable, normal colour
- **D:** long-standing, unchanged symptoms, no distress

**Red-flag phrases:** "can't breathe", "can't talk", "lips are blue", "gasping", "whistling / wheezing", "falling asleep", "inhaler isn't working", "sitting bent forward"

**Key questions the operator must ask**

1. Can they speak full sentences?
1. What colour are lips and face?
1. Awake and alert?
1. Known asthma, COPD, heart failure?
1. Have they used their inhaler/home oxygen, did it help?
1. Did it start suddenly (choking, allergy)?
1. Chest pain or fever?

**Ambulance:** Yes for A and B.

**Supplies for the crew:** oxygen, nebulizer with salbutamol, pulse oximeter, bag-valve mask, suction

**Operator instructions to caller:** Let them sit upright, leaning forward; Use own inhaler / home oxygen as prescribed; Open windows, calm the person

## Allergic reaction / anaphylaxis (`allergic_reaction`)

**Urgency criteria**

- **A:** swelling of lips, tongue or throat; breathing difficulty, wheezing, hoarse voice; faintness, collapse, pale and clammy; known severe allergy plus exposure plus any symptom beyond skin
- **B:** widespread hives with vomiting or stomach pain; rapidly spreading rash after known allergen
- **C:** local swelling (e.g. insect sting) without general symptoms
- **D:** mild itchy rash, hours old, no other symptoms, stable

**Red-flag phrases:** "lips are swelling", "throat feels tight", "voice sounds funny", "can't swallow", "wheezing", "peanut / nuts / bee sting + known allergy", "feels faint", "has an EpiPen"

**Key questions the operator must ask**

1. What were they exposed to and when?
1. Swelling of lips, tongue or throat?
1. Any breathing difficulty or change in voice?
1. Known allergy? Do they carry an EpiPen?
1. Has the EpiPen been used, and when?
1. Feeling faint or dizzy?

**Ambulance:** Yes for A and B.

**Supplies for the crew:** epinephrine (adrenaline), oxygen, nebulizer with salbutamol, IV fluids, antihistamine, corticosteroid, airway kit

**Operator instructions to caller:** Use the EpiPen now in outer thigh if available; Lie down with legs raised, or sit if breathing is hard; Second EpiPen after 5-15 min if no improvement

## Unconscious / not breathing normally (possible cardiac arrest) (`unconscious_cardiac_arrest`)

**Urgency criteria**

- **A:** does not respond and is not breathing normally (gasping, snoring, irregular = NOT normal); unconscious, breathing status unknown; unconscious after trauma or with suspected overdose
- **B:** was unconscious briefly, now awake but not fully alert; fainted and still pale/unwell
- **C:** short faint, now fully recovered, young, clear cause (e.g. blood test)

**Red-flag phrases:** "won't wake up", "not responding", "breathing funny", "snoring / gasping", "turned blue / grey", "just collapsed", "eyes rolled back", "a bit sleepy (when caller cannot wake them)"

**Key questions the operator must ask**

1. Is the person awake? Shout and shake their shoulders.
1. Are they breathing normally? Look for 10 seconds.
1. Is there an AED nearby?
1. What happened just before?
1. Exact address and door code?

**Ambulance:** Yes, A. Start telephone CPR immediately if not breathing normally.

**Supplies for the crew:** defibrillator (AED), bag-valve mask, airway kit / suction, adrenaline for CPR, mechanical CPR device, naloxone if opioids suspected, glucometer

**Operator instructions to caller:** Telephone CPR: 30 compressions, hard and fast, middle of chest; Send someone for the nearest AED; If breathing normally: recovery position, keep checking

## Stroke symptoms (`stroke`)

**Urgency criteria**

- **A:** sudden face drooping, arm weakness or speech difficulty with onset < 24 h or unknown; sudden severe headache ('worst ever'); stroke symptoms plus reduced consciousness
- **B:** symptoms that came and went within the last 24 h (TIA)
- **C:** symptoms > 24 h old, stable

**Red-flag phrases:** "face is hanging / drooping", "can't lift arm", "talking strange / slurred", "can't find words", "suddenly can't see", "worst headache of my life", "fell and can't get up, one side weak"

**Key questions the operator must ask**

1. When exactly were they last seen well? (time is brain)
1. Face: does one side droop when they smile?
1. Arms: can they lift both and hold them up?
1. Speech: can they repeat a simple sentence?
1. Blood thinners? Diabetes (check sugar)?
1. Awake?

**Ambulance:** Yes, A. Pre-alert stroke unit.

**Supplies for the crew:** glucometer, oxygen, 12-lead ECG, stroke scale card (e.g. FAST/NIHSS), pre-alert to stroke unit

**Operator instructions to caller:** Note the time last seen well; Do not give food, drink or medicine; Gather list of medications

## Seizure / convulsions (`seizure`)

**Urgency criteria**

- **A:** seizure still going on (> 5 min) or repeated without waking between; not breathing normally after seizure; seizure in pregnancy, after head injury, or in diabetic; first-ever seizure in adult with headache/fever
- **B:** first seizure, now stopped, child with fever; known epilepsy but seizure unlike usual or injury
- **C:** known epilepsy, typical short seizure, now fully awake

**Red-flag phrases:** "still shaking", "won't stop", "turning blue", "not waking up after", "hit head", "has a fever", "never had this before", "pregnant"

**Key questions the operator must ask**

1. Is the seizure still going on? When did it start?
1. Breathing and colour?
1. First ever? Known epilepsy?
1. Fever, head injury, diabetes, pregnancy, drugs?
1. Age? Child's weight?
1. Has rescue medicine been given?

**Ambulance:** Yes for A and B.

**Supplies for the crew:** midazolam / benzodiazepine (buccal or IV), oxygen, suction, glucometer, thermometer / antipyretic for child

**Operator instructions to caller:** Do not hold them down, nothing in mouth; Move hard objects away, protect head; Time the seizure; Recovery position when it stops

## Traffic collision / trauma (`traffic_trauma`)

**Urgency criteria**

- **A:** anyone unconscious, not breathing normally, or major bleeding; trapped in vehicle; pedestrian/cyclist hit by car at speed, thrown or run over; high-energy: rollover, ejection, fatality in same vehicle
- **B:** neck/back pain after collision, chest or abdominal pain; head injury with vomiting or confusion; suspected fracture of thigh or pelvis
- **C:** minor injuries, walking, low speed
- **E:** no injuries, vehicle damage only (police/towing)

**Red-flag phrases:** "not moving", "not responding", "lots of blood", "stuck in the car", "flew over the car", "head is bleeding", "can't feel legs", "airbag went off", "car on fire / leaking fuel"

**Key questions the operator must ask**

1. Exact location / nearest junction?
1. How many people injured, how many vehicles?
1. Is anyone unconscious or not breathing normally?
1. Major bleeding?
1. Anyone trapped?
1. Is the scene safe (traffic, fire, fuel)?
1. Approximate speed?

**Ambulance:** Yes for A and B; police and rescue service for trapped, fire or blocked road.

**Supplies for the crew:** cervical collar, vacuum mattress / spinal board, tourniquet / haemostatic dressing, oxygen, splints / pelvic binder, IV fluids, rescue service for extraction

**Operator instructions to caller:** Keep yourself safe, warning triangle / hazard lights; Do not move the injured unless danger; Press hard on bleeding; Keep them warm, talk to them

## Mental health crisis / suicide risk (`mental_health_suicide`)

**Urgency criteria**

- **A:** has taken an overdose or harmed themselves; has a plan AND means available right now; acute danger to self or others, weapon
- **B:** active suicidal thoughts with plan but no immediate means; severe agitation, psychosis, not safe alone
- **C:** suicidal thoughts without plan, someone can stay with them
- **D:** distress, no suicidal thoughts, wants to talk (refer to crisis line / psychiatric emergency)
- **E:** third party worried, no contact with person (police welfare check)

**Red-flag phrases:** "took my pills / took more than usual", "wrote letters", "said goodbye", "gave away pet/things", "won't matter after tonight", "don't want to be here", "have a rope / knife / gun", "everyone would be better off", "nobody would notice"

**Key questions the operator must ask**

1. Are you thinking of killing yourself? (ask directly)
1. Have you done anything to hurt yourself today? Taken anything?
1. What and how much, and when?
1. Do you have a plan, and the means with you now?
1. Is anyone with you?
1. Exact address?

**Ambulance:** Yes for A; A/B also police support for scene safety and psychiatric team where available.

**Supplies for the crew:** naloxone (if opioids), activated charcoal (per protocol), glucometer, ECG (tricyclics), police support, psychiatric ambulance / crisis team

**Operator instructions to caller:** Stay on the line, calm voice; Ask directly about suicide; it does not increase risk; Remove means if safe; Unlock the door if able

## Sources

- Dansk Indeks for Akuthjælp 1.8 (https://dpv.rn.dk/-/media/Hospitaler/Den-Praehospitale-Virksomhed/Dansk-Indeks-1-8-Landsudgaven.ashx?la=da): Structure only (symptom group -> criteria -> urgency A-E). Text NOT copied; redistribution not allowed.
- RETTS vitalparametrar, Region Skåne (https://vardgivare.skane.se:443/siteassets/1.-vardriktlinjer/traumamanual/retts-vitalparametrar.pdf): Concept of colour-coded vital-sign limits. Not downloaded today (network blocked); no numbers copied. (c) Predicare.
- 1177 Skåne: what happens when you call for an ambulance (https://www.1177.se/Skane/sa-fungerar-varden/varden-i-skane/vad-hander-nar-du-ringer-efter-en-ambulans-i-skane/): Three Swedish dispatch levels (life-threatening / acute / non-acute).
- General first-aid and prehospital knowledge (FAST stroke signs, telephone CPR, anaphylaxis signs): Written in our own words by Claude. Not reviewed by a clinician. Hackathon use only.
