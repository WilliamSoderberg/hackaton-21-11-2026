# Extra SYNTHETIC training calls for the ambulance model, written by AI (Claude) on 21 Nov 2026.
# Not real patient data. Not clinically validated.
#
# data/source has only 5 "no ambulance" calls, each on a different topic, so a model trained on
# them alone cannot learn what a non-urgent call sounds like. These calls fill that gap. Most are
# "no", on the same topics as the urgent calls (chest, breathing, head, falls, allergy, mental
# health) so the model has to learn severity rather than topic; a few are extra "yes" calls that
# sound calm. They are used for TRAINING ONLY; the evaluation in results.md scores the data/source
# calls. `label_from` is the turn index from which the conversation already justifies the label.

O, C = "operator", "caller"

EXTRA = [
    dict(call_id="extra_01_sprained_ankle", ambulance="no", label_from=3, turns=[
        (O, "112, what is your emergency?"),
        (C, "Hi, I twisted my ankle playing football and it's quite swollen."),
        (O, "Where are you, and did you hit your head or hurt anything else?"),
        (C, "At the pitch by Sparta. No, just the ankle. I can put a bit of weight on it."),
        (O, "Is the foot pale or cold, or does it look bent the wrong way?"),
        (C, "No, it looks normal, just puffy. My teammate has a car."),
        (O, "Then you don't need an ambulance. Rest it, put ice on it and keep it raised. Your friend can drive you to the emergency clinic if it gets worse, or call 1177."),
        (C, "Okay, thanks, sorry for calling."),
    ]),
    dict(call_id="extra_02_small_kitchen_cut", ambulance="no", label_from=3, turns=[
        (O, "112, what has happened?"),
        (C, "I cut my finger chopping onions, it was bleeding a lot but I've pressed a towel on it."),
        (O, "Has the bleeding stopped now?"),
        (C, "Yes, it's almost stopped. It's maybe one centimetre long."),
        (O, "Can you move the finger normally and do you have feeling in the tip?"),
        (C, "Yes, I can bend it and it feels normal."),
        (O, "Good. Keep pressure on it and put a plaster on. If it starts bleeding again or gapes, go to your health centre for stitches. No ambulance needed."),
        (C, "Okay, I'll do that."),
    ]),
    dict(call_id="extra_03_muscle_chest_pain", ambulance="no", label_from=5, turns=[
        (O, "112, what is your emergency?"),
        (C, "I have some pain in my chest on the right side, I'm a bit worried."),
        (O, "How old are you and when did it start?"),
        (C, "I'm 26. Since yesterday, after I moved furniture all day."),
        (O, "Does it get worse when you press on it or twist your body?"),
        (C, "Yes, when I press there it hurts, and when I lift my arm. Otherwise it's fine."),
        (O, "Are you short of breath, sweaty or feeling sick?"),
        (C, "No, I'm breathing fine, I feel normal apart from that spot."),
        (O, "That sounds like a strained muscle. You don't need an ambulance. Take a painkiller and call 1177 if it changes, or call us if you get pressure, breathlessness or sweating."),
    ]),
    dict(call_id="extra_04_migraine_usual", ambulance="no", label_from=5, turns=[
        (O, "112, what has happened?"),
        (C, "I have a really bad headache, my migraine. I ran out of my tablets."),
        (O, "Is this like your usual migraines, or different?"),
        (C, "It's my usual one, with the flashing lights first. I've had them since I was a teenager."),
        (O, "Any weakness, trouble speaking, fever or stiff neck?"),
        (C, "No, nothing like that. Just the headache and I feel a bit sick from the light."),
        (O, "Okay. This doesn't need an ambulance. Lie down in a dark room. Call 1177 or a pharmacy about your tablets, and call us back if it becomes the worst headache of your life or you get new symptoms."),
        (C, "Okay. Thank you."),
    ]),
    dict(call_id="extra_05_child_bumped_head", ambulance="no", label_from=5, turns=[
        (O, "112, what is your emergency?"),
        (C, "My son is four, he fell off the sofa and bumped his head on the floor."),
        (O, "Did he cry straight away, and is he awake now?"),
        (C, "He cried right away, now he's playing again and asking for juice."),
        (O, "Has he vomited, or is he unusually sleepy or acting strange?"),
        (C, "No, he's acting completely normal, he just has a little bump."),
        (O, "That's good. He doesn't need an ambulance. Put something cold on the bump and keep an eye on him today. If he vomits several times, gets very sleepy or acts confused, call back."),
    ]),
    dict(call_id="extra_06_sore_throat_fever", ambulance="no", label_from=3, turns=[
        (O, "112, what has happened?"),
        (C, "I have a sore throat and fever since two days, I can't get an appointment."),
        (O, "Can you swallow your saliva and drink? Is your breathing normal?"),
        (C, "Yes, it hurts to swallow but I can drink. Breathing is normal."),
        (O, "How high is the fever?"),
        (C, "Thirty-eight and a half. I'm 30 and healthy otherwise."),
        (O, "This isn't an emergency. Call 1177 for advice or book a time at the health centre. Drink a lot and take paracetamol."),
        (C, "Alright, thanks."),
    ]),
    dict(call_id="extra_07_bee_sting_no_allergy", ambulance="no", label_from=3, turns=[
        (O, "112, what is your emergency?"),
        (C, "I got stung by a wasp on my hand and it's swollen and red."),
        (O, "Is anything swelling in your face, lips or throat? Any trouble breathing?"),
        (C, "No, just my hand around the sting. I'm breathing normally."),
        (O, "Do you have any known allergy to stings?"),
        (C, "No, I've been stung before and it was the same."),
        (O, "Then it's a local reaction. Cool it and take an antihistamine if you have one. No ambulance needed, but call us immediately if your lips swell or you feel faint."),
    ]),
    dict(call_id="extra_08_nosebleed_stopped", ambulance="no", label_from=3, turns=[
        (O, "112, what has happened?"),
        (C, "My daughter had a big nosebleed, there was blood everywhere, I got scared."),
        (O, "Is it still bleeding?"),
        (C, "No, it stopped after we pinched her nose for ten minutes."),
        (O, "How old is she, and did she hit her nose or does she take blood thinners?"),
        (C, "She's nine, she didn't hit anything, she just picked it. No medicines."),
        (O, "Then she's fine. No ambulance needed. If it happens often, contact the health centre."),
        (C, "Okay, thank you so much."),
    ]),
    dict(call_id="extra_09_anxious_cant_sleep_safe", ambulance="no", label_from=7, turns=[
        (O, "112, what is your emergency?"),
        (C, "I don't know if I should call here. I've been really anxious lately and I can't sleep."),
        (O, "I'm glad you called. Are you safe right now? Do you have any thoughts of hurting yourself?"),
        (C, "No, no, nothing like that. I just feel stressed about work and my exams."),
        (O, "Have you taken anything tonight, any pills or alcohol?"),
        (C, "No, just tea."),
        (O, "Is there someone you can talk to, and have you seen a doctor about this?"),
        (C, "My sister is coming over tomorrow. I haven't seen a doctor yet."),
        (O, "You don't need an ambulance. Call 1177 tomorrow to book a time, or the Mind support line tonight if you want to talk. Call us again if you start thinking about harming yourself."),
    ]),
    dict(call_id="extra_10_pocket_dial", ambulance="no", label_from=2, turns=[
        (O, "112, what is your emergency?"),
        (C, "Oh, sorry, I think my phone called by itself in my pocket."),
        (O, "Is everything okay? Nobody needs help?"),
        (C, "Yes, everything's fine, I'm just on the bus. Sorry about that."),
        (O, "No problem. Have a good day."),
    ]),
    dict(call_id="extra_11_lost_prescription", ambulance="no", label_from=3, turns=[
        (O, "112, what has happened?"),
        (C, "I'm out of my blood pressure pills and the pharmacy says my prescription ran out."),
        (O, "Are you feeling unwell right now? Any chest pain, headache or dizziness?"),
        (C, "No, I feel fine, I just took my last one yesterday."),
        (O, "That isn't an emergency. Call your health centre or 1177 tomorrow and they can renew it. One missed day is usually okay."),
        (C, "Okay, I'll call them in the morning."),
    ]),
    dict(call_id="extra_12_back_pain_chronic", ambulance="no", label_from=5, turns=[
        (O, "112, what is your emergency?"),
        (C, "My back is hurting again, I've had back problems for years."),
        (O, "Did you fall or hurt yourself? Can you walk?"),
        (C, "No fall, I just lifted the laundry basket. I can walk, slowly."),
        (O, "Any numbness between the legs, trouble peeing, or weakness in the legs?"),
        (C, "No, nothing like that. It's the same pain I always get, low down."),
        (O, "Then you don't need an ambulance. Keep moving gently and take your usual painkillers. Contact the health centre if it doesn't improve."),
    ]),
    dict(call_id="extra_13_child_vomiting_drinking", ambulance="no", label_from=5, turns=[
        (O, "112, what has happened?"),
        (C, "My daughter has a stomach bug, she's thrown up three times today."),
        (O, "How old is she? Is she drinking and peeing?"),
        (C, "She's six. She drinks small sips and she peed an hour ago."),
        (O, "Is she awake and alert, any rash or severe tummy pain?"),
        (C, "She's watching cartoons, a bit tired but talking normally. No rash."),
        (O, "That sounds like a normal stomach bug. No ambulance needed. Keep giving small sips often. Call 1177 if she stops peeing, gets very drowsy or has blood in the vomit."),
    ]),
    dict(call_id="extra_14_minor_burn_cooking", ambulance="no", label_from=3, turns=[
        (O, "112, what is your emergency?"),
        (C, "I burned my hand on the oven tray, it really hurts."),
        (O, "How big is the burn and are there blisters?"),
        (C, "It's a red line across two fingers, about like a coin. A tiny blister."),
        (O, "Cool it under lukewarm running water for twenty minutes. Is your face or airway affected?"),
        (C, "No, just the fingers. I'm running water on it now."),
        (O, "Good. That doesn't need an ambulance. If the blister gets big or it looks infected, go to the health centre."),
    ]),
    dict(call_id="extra_15_ear_pain_child", ambulance="no", label_from=3, turns=[
        (O, "112, what has happened?"),
        (C, "My son has had ear pain all evening and he's crying a lot."),
        (O, "Does he have a fever, and is he drinking?"),
        (C, "A little fever, thirty-eight. He drank some milk. He's three."),
        (O, "Is his neck stiff, any rash, or is he hard to wake?"),
        (C, "No, he's awake and crying, he moves his head fine."),
        (O, "It sounds like an ear infection. Give paracetamol for children and call 1177 or the health centre tomorrow. No ambulance."),
    ]),
    dict(call_id="extra_16_dizzy_hungry_ok", ambulance="no", label_from=7, turns=[
        (O, "112, what is your emergency?"),
        (C, "I felt dizzy at the gym, I think I forgot to eat lunch."),
        (O, "Are you dizzy now? Did you faint or have any chest pain?"),
        (C, "I didn't faint. I sat down and ate a banana and now it's much better."),
        (O, "Any heart problems, diabetes, or palpitations?"),
        (C, "No, I'm 22 and healthy. My heart feels normal."),
        (O, "Can you speak and move both arms normally?"),
        (C, "Yes, everything's normal now. I just wanted to check."),
        (O, "Then you don't need an ambulance. Rest, drink water and eat something. Call back if it comes back or you faint."),
    ]),
    dict(call_id="extra_17_mild_asthma_inhaler_worked", ambulance="no", label_from=5, turns=[
        (O, "112, what has happened?"),
        (C, "I had an asthma attack after running, I was wheezing a bit."),
        (O, "Have you used your inhaler? How is your breathing now?"),
        (C, "Yes, two puffs of the blue one and it's much better now."),
        (O, "Can you talk in full sentences without stopping?"),
        (C, "Yes, I'm talking normally, I'm just a bit tired."),
        (O, "Good. No ambulance needed. Rest, and if it comes back and the inhaler doesn't help, call us again straight away."),
    ]),
    dict(call_id="extra_18_elderly_fall_got_up", ambulance="no", label_from=5, turns=[
        (O, "112, what is your emergency?"),
        (C, "My father slipped in the hallway, he's 75. I'm with him."),
        (O, "Did he hit his head, and can he get up and walk?"),
        (C, "He landed on his bottom, he didn't hit his head. He got up himself and walked to the chair."),
        (O, "Does he have pain in the hip, or does one leg look shorter or turned out?"),
        (C, "No, his legs look normal. He says he's just embarrassed. He's not on blood thinners."),
        (O, "Then he doesn't need an ambulance now. Keep an eye on him tonight. Call back if he gets pain when walking, confusion or a headache."),
    ]),
    dict(call_id="extra_19_question_vaccine", ambulance="no", label_from=1, turns=[
        (O, "112, what is your emergency?"),
        (C, "Hi, I just wanted to ask when I can get the flu vaccine this year."),
        (O, "This line is for emergencies. For questions about vaccines, call 1177 or your health centre."),
        (C, "Oh, okay, sorry. Thanks."),
    ]),
    dict(call_id="extra_20_noise_neighbour", ambulance="no", label_from=1, turns=[
        (O, "112, what is your emergency?"),
        (C, "My neighbours are having a very loud party and it's two in the morning."),
        (O, "Is anyone hurt or in danger?"),
        (C, "No, nobody's hurt, it's just loud music."),
        (O, "Then it's not an ambulance matter. You can call the police non-emergency number, 114 14."),
    ]),
    # A few calm-sounding calls that still need an ambulance, so "calm" alone does not mean "no".
    dict(call_id="extra_21_calm_heart_attack", ambulance="yes", label_from=3, turns=[
        (O, "112, what is your emergency?"),
        (C, "Hello, I'm sorry to bother you. I've had this pressure in my chest for half an hour."),
        (O, "How old are you? Does it spread anywhere?"),
        (C, "I'm 64. It goes up into my neck and my left arm feels heavy. I'm a bit sweaty."),
        (O, "Do you have any heart disease?"),
        (C, "I had a stent two years ago. My nitro spray didn't help."),
        (O, "I'm sending an ambulance now. Unlock the door and sit down. Chew an aspirin if you're not allergic."),
    ]),
    dict(call_id="extra_22_quiet_stroke", ambulance="yes", label_from=3, turns=[
        (O, "112, what has happened?"),
        (C, "My wife is talking strangely, the words come out wrong."),
        (O, "When did it start? Is her face drooping on one side?"),
        (C, "Ten minutes ago, at dinner. Yes, the right side of her mouth is hanging down and she dropped her fork."),
        (O, "Can she lift both arms?"),
        (C, "Her right arm is weak, it falls down."),
        (O, "This could be a stroke, I'm sending an ambulance right away. Note the time it started."),
    ]),
    dict(call_id="extra_23_child_hard_to_breathe", ambulance="yes", label_from=3, turns=[
        (O, "112, what is your emergency?"),
        (C, "My baby is breathing really fast and it looks like her ribs are pulling in."),
        (O, "How old is she? Is she drinking?"),
        (C, "She's eight months. She won't drink, and she's grunting with every breath."),
        (O, "What colour are her lips?"),
        (C, "A bit bluish around the mouth."),
        (O, "An ambulance is on its way. Keep her upright in your arms and stay on the line."),
    ]),
    dict(call_id="extra_24_overdose_pills_calm", ambulance="yes", label_from=5, turns=[
        (O, "112, what has happened?"),
        (C, "I don't really know why I'm calling. I took some pills an hour ago."),
        (O, "I'm glad you called. Which pills and how many?"),
        (C, "My paracetamol and some of my sleeping pills. Maybe thirty. I wanted it to stop."),
        (O, "Are you alone? Where are you?"),
        (C, "Alone at home. I'm getting very sleepy."),
        (O, "I'm sending an ambulance now. Unlock the door if you can and stay on the phone with me."),
    ]),
]

# Real calls almost always confirm an address early on. Without this, "address" and "Lund" would
# only appear in the data/source calls and the model would learn them as an "ambulance" cue.
STREETS = ["Bankgatan 4", "Tornavägen 21", "Magistratsvägen 12", "Kävlingevägen 30", "Stora Södergatan 18",
           "Linero torg 2", "Råbyvägen 9", "Fäladstorget 5", "Östra Vallgatan 11", "Klostergatan 3",
           "Sankt Laurentiigatan 7", "Getingevägen 40", "Dalbyvägen 15", "Norra Fäladen 22", "Spolegatan 6",
           "Södra Vägen 27", "Höjdrodergatan 8", "Vildandsvägen 14", "Brunnsgatan 19", "Smörlyckan 10",
           "Mårtenstorget 1", "Byggmästaregatan 5", "Möllevångsvägen 13", "Gyllenkroks allé 2"]
NO_ADDRESS = {"extra_10_pocket_dial", "extra_19_question_vaccine"}

for _i, _c in enumerate(EXTRA):
    if _c["call_id"] in NO_ADDRESS:
        continue
    _street = STREETS[_i % len(STREETS)]
    _ask = ["What is the address?", "Where are you?", "What's the address?", "Where are you calling from?"][_i % 4]
    _c["turns"][2:2] = [(O, _ask), (C, f"{_street} in Lund.")]
    if _c["label_from"] >= 2:
        _c["label_from"] += 2
