# Generated SYNTHETIC training calls for the ambulance model, written by AI (Claude) on 21 Nov 2026.
# Not real patient data. Not clinically validated. Do not use for real triage.
#
# Builds ~200 calls from templates. They are mixed and matched per call, so no two read the same:
# who is calling and about whom (self, partner, parent, child, friend, stranger), tone (calm,
# panicked, apologetic, downplaying), address or none, and filler lines that occur in both classes.
#
# The point is CONTRAST: every topic has "yes" and "no" calls that share the same opening
# and words (chest, breathing, blood, head, fell, pills...). Only the details decide. Breathing in
# particular shows up in "no" calls as explicit denials ("he's breathing fine", "no trouble
# breathing") and in "yes" calls where the danger is something else, so the word alone stops
# meaning "ambulance".
#
# Only the caller turns matter to the model (train_ambulance.py ignores the responder), but the
# calls keep responder turns so they read like the other training calls.
#
#   python3 data/model/generated_calls.py      prints a few samples and the counts
import random
import re

O, C = "operator", "caller"
SEED = 20261121
PER_TOPIC = 7  # calls per class per topic -> 14 topics x 2 classes x 7 = 196

# ---- people. {s}=subject, {be}=he's/I'm, {has}=he has/I have, {doesnt}, {o}=object, {p}=possessive,
# {was}, {is}=is/am, {feels}=feels/feel, {looks}=looks/look, {needs}=needs/need, {wants}=wants/want.
SELF = dict(s="I", be="I'm", has="I have", doesnt="I don't", o="me", p="my", was="I was", isnt="I'm not",
            is_="am", feels="feel", looks="look", says="I think", wants="want", cant="I can't", can="I can", self="myself")


def third(he):
    m = he == "he"
    return dict(s=he, be=f"{he}'s", has=f"{he} has", doesnt=f"{he} doesn't", o="him" if m else "her",
                p="his" if m else "her", was=f"{he} was", isnt=f"{he}'s not", is_="is", feels="feels",
                looks="looks", says=f"{he} says", wants="wants", cant=f"{he} can't", can=f"{he} can", self="himself" if m else "herself")


ADULT_REL = [("my husband", "he"), ("my wife", "she"), ("my dad", "he"), ("my mum", "she"),
             ("my boyfriend", "he"), ("my girlfriend", "she"), ("my friend", "he"), ("my friend", "she"),
             ("my colleague", "he"), ("my colleague", "she"), ("my neighbour", "she"), ("my neighbour", "he"),
             ("my brother", "he"), ("my sister", "she"), ("my partner", "she"), ("my partner", "he"),
             ("a man here on the street", "he"), ("a woman on the bus", "she"), ("my flatmate", "he")]
OLD_REL = [("my grandma", "she"), ("my grandpa", "he"), ("my mother", "she"), ("my father", "he"),
           ("the old lady next door", "she"), ("my husband", "he"), ("my wife", "she")]
CHILD_REL = [("my son", "he"), ("my daughter", "she"), ("my baby", "she"), ("my baby", "he"),
             ("my little boy", "he"), ("my little girl", "she"), ("the kid I'm babysitting", "he"),
             ("my toddler", "she")]

STREETS = ["Bankgatan 4", "Tornavägen 21", "Kävlingevägen 30", "Stora Södergatan 18", "Linero torg 2",
           "Råbyvägen 9", "Fäladstorget 5", "Östra Vallgatan 11", "Klostergatan 3", "Getingevägen 40",
           "Dalbyvägen 15", "Spolegatan 6", "Södra Vägen 27", "Brunnsgatan 19", "Smörlyckan 10",
           "Mårtenstorget 1", "Byggmästaregatan 5", "Möllevångsvägen 13", "Gyllenkroks allé 2",
           "Magistratsvägen 12", "Vipeholmsvägen 8", "Sölvegatan 3", "Kung Oskars väg 7", "Trollebergsvägen 20",
           "Norra Ringen 44", "Västra Mårtensgatan 9", "Ideon Gateway", "Clemenstorget 1"]
CITIES = ["Lund", "Lund", "Lund", "Malmö", "Dalby", "Staffanstorp", "Södra Sandby", "Lomma"]

# ---- tone: lines either class can have, so manner of speaking is not the signal.
OPEN_TONE = {
    "calm": ["Hello.", "Hi, yes.", "Good evening.", "Hello, I need some advice.", ""],
    "panic": ["Please, please help!", "Oh god, hello?!", "Help me, please!", "I don't know what to do!"],
    "sorry": ["Sorry to bother you.", "I'm sorry, I didn't know who else to call.", "Hi, sorry, this might be silly."],
    "downplay": ["It's probably nothing, but", "I don't want to make a fuss, but", "I'm sure it's fine, but"],
}
CLOSE_TONE = {
    "calm": ["Okay, thank you.", "Alright.", "Thanks.", "Okay, I understand.", "Yes, okay."],
    "panic": ["Please hurry!", "Okay okay. Please.", "What do I do now?", "Please, just tell me what to do."],
    "sorry": ["Thank you so much, sorry again.", "Okay, sorry for calling.", "Thanks, I appreciate it."],
    "downplay": ["Okay, if you say so.", "Alright, fine.", "Okay, thanks I guess."],
}
FILLER = ["I don't really know what to do.", "{s} {is_} sitting in the kitchen now.", "I'm here with {o}.",
          "{be} lying on the sofa.", "We just got home.", "It happened just now.", "{has} high blood pressure, {says}.",
          "{s} takes a few pills, I don't remember the names.", "{be} a bit scared.", "Should I give {o} water?",
          "{s} had a cold last week too.", "I'm on speaker, can you hear me?", "Can you hold on a second?",
          "My phone battery is low.", "Nobody else is home.", "{be} 34.", "{be} 61.", "{be} 78.", "{be} 45.",
          "Yes.", "No.", "I think so.", "I don't know.", "Hold on, let me look.", "Yes, the front door.",
          "It's the yellow house.", "{s} had dinner an hour ago.", "{s} {is_} allergic to penicillin.",
          "{doesnt} take any medicine.", "{s} drank a glass of wine earlier.", "We were watching TV.",
          "We were out walking the dog.",
          "{s} smokes.", "It started maybe half an hour ago.", "Yes, I'm still here.", "Sorry, what did you say?"]
CHILD_FILLER = ["{be} two years old.", "{be} six months.", "{be} four.", "{be} eight.", "My partner is at work.",
                "I'm holding {o} now.", "{s} had a fever yesterday.", "{s} was fine this morning."]

# ---- topics. who: adult/old/child/self (self = caller is the patient; adult topics can be either).
# shared: openings used by BOTH classes. yes/no: detail lines; a call uses 2-3 of its class.
TOPICS = {
    "breathing": dict(who="adult+self", shared=[
        "{be} having trouble with {p} breathing.", "{p} breathing sounds weird.", "{s} {is_} coughing a lot.",
        "it's about {p} breathing.", "{s} has asthma and {s} {is_} wheezing a bit."],
        yes=["{cant} breathe, {s} can only say one or two words.", "{be} gasping for air.",
             "{p} lips are going blue.", "{p} inhaler isn't helping at all, it's getting worse.",
             "{be} struggling to breathe and sitting bent forward.", "{be} breathing really fast and {be} grey.",
             "{s} sounds like {be} drowning, gurgling.", "{be} so out of breath {cant} talk."],
        no=["{be} breathing fine now, the inhaler helped.", "no, there's no trouble breathing, just a stuffy nose.",
            "{be} breathing normally, it's just a tickly cough.", "{can} talk in full sentences, no problem.",
            "{p} breathing is calm and {p} colour is normal.", "{s} took two puffs and {be} completely fine now.",
            "{be} not short of breath at all.", "the cough is dry, {be} breathing okay and has no fever."]),
    "chest": dict(who="adult+self", shared=[
        "{has} pain in {p} chest.", "{be} complaining about {p} chest.", "{s} {feels} some pressure in the chest.",
        "{has} chest pain."],
        yes=["it's crushing, like an elephant sitting on {o}.", "the pain goes down {p} left arm and into the jaw.",
             "{be} all sweaty and grey in the face.", "{s} had a heart attack before and it feels the same.",
             "the nitro spray didn't help.", "{be} breathing okay but the pain is really bad and won't go away.",
             "{s} {feels} sick and faint with the pain.", "it started twenty minutes ago and keeps getting worse."],
        no=["it hurts when {s} presses on it, {s} moved furniture yesterday.", "it's heartburn, {s} gets it after spicy food.",
            "the antacid helped, it's almost gone.", "it's only when {s} coughs, {p} ribs are sore.",
            "{be} breathing fine and {p} colour is normal.", "it's a small sharp twinge when {s} twists, nothing else.",
            "{s} {feels} fine otherwise, no sweating, no arm pain.", "{s} pulled a muscle at the gym, it hurts to lift the arm."]),
    "stroke": dict(who="adult+old+self", shared=[
        "{s} {is_} acting a bit strange.", "{s} {feels} odd in {p} face.", "something is off with {o}.",
        "{has} a headache and {s} {feels} weird."],
        yes=["{p} face is hanging down on one side.", "{p} speech is slurred, the words come out wrong.",
             "{cant} lift {p} right arm, it just falls down.", "it came on suddenly ten minutes ago.",
             "{be} confused and doesn't understand what I say.", "{s} suddenly can't see on one side.",
             "{s} dropped {p} cup and {p} hand won't work.", "it's the worst headache of {p} life, it came like a thunderclap."],
        no=["it's {p} usual migraine, {s} gets them every month.", "{p} foot fell asleep from sitting, it's already gone.",
            "{be} talking normally and can move both arms.", "{p} face looks normal, smiling is even.",
            "{s} took a painkiller and it's getting better.", "{s} just slept badly, {be} tired but okay.",
            "{be} breathing fine and making sense.", "the headache came slowly over the day, like a normal one."]),
    "collapse": dict(who="adult+old", shared=[
        "{s} fainted.", "{s} collapsed.", "{s} fell down suddenly.", "{s} passed out for a moment."],
        yes=["{be} not waking up.", "{isnt} responding when I shake {o}.", "{be} not breathing properly, just snoring sounds.",
             "{be} lying on the floor and {p} eyes are rolled back.", "{s} isn't breathing, I don't think {be} breathing!",
             "{be} been unconscious for several minutes.", "{s} went completely limp and {be} blue.",
             "{be} breathing but I can't wake {o} up."],
        no=["{s} woke up after a few seconds and {be} talking.", "{s} fainted when {s} saw blood, {be} fine now.",
            "{be} sitting up and drinking juice, {s} {feels} okay.", "{be} breathing normally and knows where {be} at.",
            "{s} stood up too fast in the heat, {s} came round straight away.", "{s} didn't hit {p} head and {be} chatting with me now.",
            "{s} hadn't eaten all day, after a sandwich {s} {feels} normal.", "{be} awake and laughing about it."]),
    "bleeding": dict(who="adult+self", shared=[
        "there's been an accident with a knife.", "{be} bleeding.", "{s} cut {p} hand.",
        "there's blood everywhere.", "{s} fell and {be} bleeding."],
        yes=["the blood is spurting and won't stop even when I press.", "it's a deep cut on {p} thigh, the towel is soaked.",
             "{be} going pale and dizzy from all the blood.", "{s} hit {p} head hard and {be} confused and vomiting.",
             "there's a bone sticking out of {p} leg.", "it's been bleeding for twenty minutes, {s} takes blood thinners.",
             "{s} lost a lot of blood, it's a pool on the floor.", "the glass went into {p} neck."],
        no=["it's a small cut, the bleeding has stopped.", "it's just a graze on {p} knee.", "it was a nosebleed, it's stopped now.",
            "I pressed for ten minutes and it stopped, it's about one centimetre.", "{s} can move the finger fine and has feeling.",
            "{be} breathing fine and totally alert, just a bit of blood.", "it looked worse than it is, a plaster covers it.",
            "{s} bit {p} tongue, it stopped bleeding already."]),
    "allergy": dict(who="adult+self+child", shared=[
        "{s} ate something with nuts.", "{has} an allergic reaction.", "{s} got stung by a wasp.",
        "{has} a rash after taking a new medicine.", "{s} {is_} itchy all over."],
        yes=["{p} throat is swelling and {s} sounds hoarse.", "{p} lips and tongue are swelling up.",
             "{be} wheezing and finding it hard to swallow.", "{s} used {p} EpiPen and it's still getting worse.",
             "{be} dizzy and has hives everywhere.", "{p} face is swelling, {p} eyes are closing.",
             "{s} {feels} faint and is vomiting since eating the shrimp.", "{be} breathing worse and worse."],
        no=["it's just a red bump where the sting was.", "{p} lips are normal, {be} breathing fine.", "the rash is only on {p} arm, no swelling.",
            "{s} took an antihistamine and it's calming down.", "{s} {is_} not allergic, it's just a mosquito bite.",
            "no swelling in the face, no trouble breathing.", "it's hay fever, sneezing and itchy eyes.",
            "{be} talking and swallowing normally, just itchy."]),
    "child": dict(who="child", shared=[
        "{has} a high fever.", "{s} hit {p} head.", "{has} been sick.", "{s} {is_} crying a lot.",
        "{s} had a fit."],
        yes=["{be} really floppy and hard to wake up.", "{p} ribs are pulling in with every breath.",
             "the fit has been going on for more than five minutes.", "{s} won't drink anything and hasn't had a wet nappy all day.",
             "{has} purple spots that don't fade when I press a glass.", "{be} grey and grunting.",
             "{s} fell from the balcony on the second floor.", "{s} hit {p} head and keeps vomiting and is very sleepy."],
        no=["{be} playing and drinking normally.", "the fever went down with paracetamol, {be} watching TV.",
            "{s} cried straight away and now {be} running around.", "{be} breathing fine, just a runny nose.",
            "{s} threw up once but {be} drinking and peeing.", "{s} had a short febrile fit, it stopped in a minute and {be} awake now and back to normal.",
            "{p} ear hurts, {be} otherwise happy.", "it's a little bump on the forehead, {s} didn't pass out."]),
    "mental": dict(who="self+adult", shared=[
        "{be} not doing well.", "{s} {feels} really low.", "{be} so anxious.", "it's about {p} mental health.",
        "{be} been depressed for a while."],
        yes=["{s} took a whole box of pills an hour ago.", "{s} {says} {s} {wants} to die tonight.",
             "{has} a knife and is talking about ending it.", "{s} wrote a goodbye letter.",
             "{s} cut {p} wrists, it's bleeding a lot.", "{be} on the bridge and won't come down.",
             "{s} drank and took all {p} sleeping pills, {be} getting drowsy.", "{be} standing on the balcony railing right now and wants to jump."],
        no=["{be} safe, {s} just needs someone to talk to.", "{s} {doesnt} want to hurt anyone, {s} just can't sleep.",
            "no, {s} hasn't taken anything and has no plans like that.", "{s} {wants} the number to the psychiatric clinic.",
            "{be} breathing slowly now, the panic is passing.", "{s} has an appointment tomorrow, {s} just {wants} advice tonight.",
            "{be} at home with family and feels safe.", "{be} stressed about exams, nothing dangerous."]),
    "fall_old": dict(who="old+self", shared=[
        "{s} fell.", "{s} slipped in the bathroom.", "{s} tripped on the rug.", "{s} fell off a chair."],
        yes=["{cant} get up and {p} leg is turned outwards.", "{be} been lying on the floor since last night.",
             "{s} hit {p} head and takes blood thinners, {be} drowsy.", "{p} hip hurts terribly and the leg looks shorter.",
             "{be} confused and cold, I found {o} on the floor.", "{s} can't feel {p} legs.",
             "{be} breathing okay but screaming when I move {o}.", "there's a big wound on {p} head that won't stop bleeding."],
        no=["{s} got up by {self} and is walking normally.", "it's a small bruise on {p} elbow, nothing else.",
            "{s} didn't hit {p} head, {be} sitting in {p} chair now.", "{be} breathing fine, talking, a bit embarrassed.",
            "{s} only needs help getting up, nothing hurts.", "{s} slid down slowly, no pain anywhere.",
            "{s} can walk and bend everything, just shaken.", "{be} fine, we just wanted to check."]),
    "diabetes": dict(who="adult+self", shared=[
        "{has} diabetes.", "{p} blood sugar is off.", "{s} takes insulin.", "{s} {is_} diabetic and {feels} weird."],
        yes=["{be} not making sense and won't eat anything.", "{be} sweating, shaking and getting unconscious.",
             "{s} won't wake up properly, the sugar was 1.8.", "{be} fitting, {p} arms are jerking.",
             "{be} breathing deep and fast, {p} breath smells like nail polish.", "{s} can't swallow so I can't give {o} sugar."],
        no=["{s} had juice and the sugar is back to 6.", "the sugar is a bit high but {s} {feels} fine.",
            "{s} just wants to know about the dose tonight.", "{be} breathing normally and eating a sandwich.",
            "{s} forgot {p} insulin, {s} has no symptoms.", "{be} completely alert, the meter says 9."]),
    "stomach": dict(who="adult+self+old", shared=[
        "{has} a stomach ache.", "{has} been vomiting.", "{s} {feels} sick in {p} stomach.", "{has} diarrhoea."],
        yes=["{be} vomiting blood.", "the stool is black like tar and {be} dizzy.", "the pain is unbearable, {s} can't stand up.",
             "{be} pale and sweaty and nearly fainted.", "{p} belly is hard as a board.",
             "{s} can't keep anything down and {be} very drowsy."],
        no=["it's mild, {s} can drink and keep it down.", "it started after the kebab, half the family has it.",
            "{be} breathing fine and walking around.", "the pain comes and goes, {be} a bit bloated.",
            "{s} had period cramps, a painkiller helped.", "no blood, no fever, just loose stools."]),
    "poison": dict(who="child+adult", shared=[
        "{s} swallowed something.", "{s} got into the medicine cabinet.", "{s} drank something from the garage.",
        "{s} took too many pills."],
        yes=["{be} very sleepy and hard to wake.", "it was granny's heart pills, maybe ten of them.",
             "{be} breathing very slowly, {p} lips are blue.", "{s} injected heroin and {be} not responding.",
             "{p} mouth is burning and {be} drooling and vomiting.", "{be} having a seizure."],
        no=["it was one vitamin gummy.", "{s} licked a little dish soap, {be} totally fine.", "poison info said it's harmless.",
            "{be} breathing fine and playing.", "it was a bite of a houseplant leaf, the non-toxic one.",
            "{s} took one extra paracetamol by mistake, nothing else."]),
    "traffic": dict(who="adult", shared=[
        "there's been a car accident.", "a car hit a cyclist.", "{s} crashed {p} car.", "there was a collision at the roundabout."],
        yes=["{be} not moving and there's blood from {p} head.", "{be} trapped in the car and screaming.",
             "{s} flew over the handlebars and isn't responding.", "{be} breathing strangely and confused.",
             "the car rolled over, {s} can't feel {p} legs.", "{be} unconscious behind the wheel."],
        no=["nobody is hurt, we just need to exchange details.", "{be} out of the car and walking around, just angry.",
            "it was a small bump, everyone is breathing fine and talking.", "{s} has a scratch on {p} arm, that's all.",
            "the airbag didn't even go off, we're all okay.", "{s} {feels} fine, it's just the car that's damaged."]),
    "admin": dict(who="self", shared=[
        "I have a question.", "I'm not sure if this is the right number.", "it's not really an emergency.",
        "I need some help with something."],
        yes=[],
        no=["I lost my prescription, how do I get a new one?", "what time does the emergency clinic open?",
            "my cat is stuck in a tree.", "the neighbours are playing loud music.", "sorry, my kid was playing with the phone.",
            "I wanted to ask about the flu vaccine.", "my car was broken into, who do I call?", "I'm breathing fine, I just wanted advice about my cough medicine.",
            "is 1177 open at night?", "my power is out.", "can I take ibuprofen with my blood pressure pills?",
            "I need a doctor's note for work."]),
}
# Yes-only topics for "admin" would be empty; extra yes calls come from these to keep classes balanced.
EXTRA_YES_TOPICS = ["breathing", "chest", "collapse", "stroke", "bleeding", "allergy", "mental"]

OPERATOR_OPEN = ["112, what is your emergency?", "112, what has happened?", "Emergency, what's happened?",
                 "112, tell me what's going on."]
OPERATOR_MID = ["Okay. Tell me more.", "I understand. What else?", "Okay, go on.", "How is it right now?",
                "Is anything else going on?", "Okay. And how does it look now?", "Mm-hm.", "Tell me exactly what you see."]
OPERATOR_ADDR = ["What's the address?", "Where are you?", "Where are you calling from?", "What is the address?"]


# First-person fixes for templates written in the third person ("I takes" -> "I take").
SELF_FIX = [(f"I {a}", f"I {b}") for a, b in [
    ("has", "have"), ("takes", "take"), ("gets", "get"), ("presses", "press"), ("coughs", "cough"),
    ("twists", "twist"), ("needs", "need"), ("knows", "know"), ("hasn't", "haven't"), ("doesn't", "don't"),
    ("sounds", "sound"), ("keeps", "keep"), ("is", "am"), ("isn't", "am not"), ("wants", "want"), ("'m been", "'ve been")]]
SELF_FIX += [("I'm been", "I've been"), ("by meself", "by myself"), ("meself", "myself")]


def fill(text, who):
    out = text.format(**who)
    if who is SELF:
        for a, b in SELF_FIX:
            out = re.sub(rf"(?<![A-Za-z]){re.escape(a)}(?![A-Za-z])", b, out)
    return out[0].upper() + out[1:] if out else out


def pick_person(rng, who):
    options = who.split("+")
    kind = rng.choice(options)
    if kind == "self":
        return "", SELF, kind
    rel = rng.choice({"adult": ADULT_REL, "old": OLD_REL, "child": CHILD_REL}[kind])
    return rel[0], third(rel[1]), kind


def make_call(rng, topic_name, label, n):
    t = TOPICS[topic_name]
    rel, who, kind = pick_person(rng, t["who"])
    tone = rng.choice(["calm", "calm", "panic", "sorry", "downplay"])
    if label == "yes" and tone == "downplay" and rng.random() < 0.5:
        tone = "calm"

    opener = fill(rng.choice(t["shared"]), who)
    lead = rng.choice(OPEN_TONE[tone])
    if rel:
        about = rng.choice([f"It's {rel}.", f"I'm calling about {rel}.", f"I'm with {rel}.", f"{rel[0].upper() + rel[1:]},"])
        first = " ".join(x for x in (lead, about, opener) if x)
    else:
        first = " ".join(x for x in (lead, opener) if x)

    turns = [(O, rng.choice(OPERATOR_OPEN)), (C, first)]
    if rng.random() < 0.85 and topic_name != "admin" or rng.random() < 0.3:
        turns += [(O, rng.choice(OPERATOR_ADDR)),
                  (C, f"{rng.choice(STREETS)} in {rng.choice(CITIES)}." + rng.choice(["", " Second floor.", " The door is open.", " Flat 12."]))]

    details = rng.sample(t[label], k=min(len(t[label]), rng.choice([1, 2, 2, 3])))
    fillers = FILLER + (CHILD_FILLER if kind == "child" else [])
    body = [fill(d, who) for d in details]
    # A neutral line in the middle sometimes, so the deciding line is not always the next turn.
    for f in rng.sample(fillers, k=rng.choice([0, 1, 2, 2, 3, 4])):
        body.insert(rng.randrange(len(body) + 1), fill(f, who))
    label_from = None
    for line in body:
        turns.append((O, rng.choice(OPERATOR_MID)))
        if label_from is None and line in [fill(d, who) for d in details]:
            label_from = len(turns)
        turns.append((C, line))
    if rng.random() < 0.7:
        turns += [(O, "Okay." if label == "no" else "I'm sending help now."), (C, rng.choice(CLOSE_TONE[tone]))]
    return dict(call_id=f"gen_{n:03d}_{topic_name}_{label}", ambulance=label, label_from=label_from, turns=turns)


def generate():
    rng = random.Random(SEED)
    calls, n = [], 0
    for name, t in TOPICS.items():
        for label in ("yes", "no"):
            if not t[label]:
                continue
            count = PER_TOPIC * 2 if name == "admin" else PER_TOPIC
            for _ in range(count):
                n += 1
                calls.append(make_call(rng, name, label, n))
    # Balance: admin has no "yes", so top up yes with more medical topics.
    for i in range(PER_TOPIC):
        n += 1
        calls.append(make_call(rng, EXTRA_YES_TOPICS[i % len(EXTRA_YES_TOPICS)], "yes", n))
    return calls


GENERATED = generate()

if __name__ == "__main__":
    yes = sum(c["ambulance"] == "yes" for c in GENERATED)
    print(f"{len(GENERATED)} calls ({yes} yes, {len(GENERATED) - yes} no)")
    rng = random.Random(1)
    for c in rng.sample(GENERATED, 5):
        print(f"\n--- {c['call_id']}  (label from turn {c['label_from']})")
        for sp, tx in c["turns"]:
            print(f"  {'C' if sp == C else 'O'}: {tx}")
