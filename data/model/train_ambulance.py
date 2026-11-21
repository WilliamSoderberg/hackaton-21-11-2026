"""Train the "ambulance or not" model on the synthetic calls in data/source.

    python3 data/model/train_ambulance.py

No dependencies (plain Python 3). The model is TF-IDF over word unigrams and
bigrams of what the CALLER says (responder turns are ignored, so "is he
breathing?" from the responder means nothing) followed by L2-regularised
logistic regression. Words after a negation ("not", "can't", "no", ...) are
tagged "not_" up to the end of the clause, so "not breathing" and "breathing
fine" are different features. Pronouns, filler words and numbers are dropped.
It writes:

  frontend/app/lib/ambulanceModel.json  weights the frontend runs in the browser
                                        (app/lib/ambulanceModel.ts must tokenise
                                        exactly like tokenize() below)
  data/model/results.md                 held-out evaluation

Training data: the extra calls in extra_training_calls.py and the ~200
template calls in generated_calls.py, plus (for the final model only) every
call in data/source whose gold `ambulance` is yes or no. The evaluation trains
on the extra + generated calls alone and scores the hand-written data/source
calls, which that model never saw. Calls marked "unclear" are never trained on.
Because the dashboard re-scores the call while it is still going, each call also
contributes its partial transcripts (prefixes of its caller turns): a "yes"
call counts as "yes" from its first red flag onwards, a "no" call from the
turn where it is clearly harmless. Each call gets the same total weight, and
the two classes are balanced.

SYNTHETIC data, not clinically validated. Do not use for real triage.
"""
import json, math, os, re, sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "data", "source"))
from calls import CALLS  # noqa: E402
sys.path.insert(0, HERE)
from extra_training_calls import EXTRA  # noqa: E402
from generated_calls import GENERATED  # noqa: E402

MODEL_OUT = os.path.join(ROOT, "frontend", "app", "lib", "ambulanceModel.json")
REPORT_OUT = os.path.join(HERE, "results.md")

MIN_CALLS = 3      # a term must appear in at least this many training calls
L2 = 1e-4          # regularisation strength
ITERS = 1000
LR = 2.0
THRESHOLD = 0.5
NO_FROM_TURN = 1   # data/source "no" calls count as "no" from this caller turn on


# ---- features (keep in sync with frontend/app/lib/ambulanceModel.ts)

TOKEN = re.compile(r"[a-z0-9åäöéü]+")
CLAUSE = re.compile(r"[.,;:!?\n]+|\bbut\b")
NEGATORS = set("""no not never cant cannot dont doesnt didnt isnt wasnt arent werent wont wouldnt
couldnt hasnt havent hadnt shouldnt aint nothing without neither nor none""".split())
STOPWORDS = set("""i me my myself we us our you your he him his himself she her hers herself they them
their it its im ive id hes shes theyre youre were a an the and or of to in on at by for with from
this that these those is am are was be been being do does did so just um uh oh yes yeah okay ok hi
hello there here""".split())
# Street and town names: addresses are in every call, so they can only be noise.
ADDRESS = re.compile(r"(gatan|vägen|väg|torget|torg|allé|gränd|stigen|backen|ringen|lyckan)$|^(lund|malmö|dalby|"
                     r"staffanstorp|lomma|sandby|södra|norra|östra|västra|stora|lilla|kung|oskars|ideon|gateway|flat|floor)$")
NEG_SCOPE = 3  # words after a negator that get the "not_" tag


def tokenize(text):
    """Caller text -> feature words: lowercase, no stopwords or numbers, negated words tagged not_."""
    out = []
    text = text.lower().replace("'", "").replace("\u2019", "")
    for clause in CLAUSE.split(text):
        scope = 0
        for t in TOKEN.findall(clause):
            if t in NEGATORS:
                scope = NEG_SCOPE
            elif t in STOPWORDS or t.isdigit() or ADDRESS.search(t):
                continue
            elif scope:
                out.append("not_" + t)
                scope -= 1
            else:
                out.append(t)
    return out


def terms(turn_texts):
    out = {}
    for text in turn_texts:
        toks = tokenize(text)
        for i, t in enumerate(toks):
            out[t] = out.get(t, 0) + 1
            if i + 1 < len(toks):
                bg = t + " " + toks[i + 1]
                out[bg] = out.get(bg, 0) + 1
    return out


def vectorize(counts, index, idf):
    vec = {}
    for term, c in counts.items():
        j = index.get(term)
        if j is not None:
            vec[j] = (1 + math.log(c)) * idf[j]
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    return [(j, v / norm) for j, v in vec.items()]


def sigmoid(z):
    return 1 / (1 + math.exp(-z)) if z >= 0 else math.exp(z) / (1 + math.exp(z))


# ---- data

def caller_index(speakers, turn):
    """Number of caller turns before full-conversation turn index `turn`, i.e. the caller-turn index
    of the first caller turn at or after it."""
    return sum(1 for sp in speakers[:turn] if sp == "caller")


def load():
    calls = []
    for c in CALLS:
        speakers = [sp for _, sp, _ in c["turns"]]
        all_texts = [tx for _, _, tx in c["turns"]]
        g = c["gold"]
        quotes = [q for _, q in g["red_flags"]]
        flag_turns = [i for i, tx in enumerate(all_texts) if any(q in tx for q in quotes)]
        calls.append({
            "id": c["call_id"], "title": c["title"], "gold": g["ambulance"],
            "texts": [tx for sp, tx in zip(speakers, all_texts) if sp == "caller"],
            "full": list(zip(speakers, all_texts)),
            "first_flag": caller_index(speakers, min(flag_turns)) if flag_turns else 0, "extra": False,
        })
    extras = []
    for c in EXTRA + GENERATED:
        speakers = [sp for sp, _ in c["turns"]]
        extras.append({
            "id": c["call_id"], "title": c["call_id"], "gold": c["ambulance"],
            "texts": [tx for sp, tx in c["turns"] if sp == "caller"], "full": c["turns"],
            "first_flag": caller_index(speakers, c["label_from"] or 0), "extra": True,
        })
    return calls, extras


def samples_for(call):
    """(turn_texts_prefix, label) pairs for one training call."""
    n = len(call["texts"])
    if call["gold"] == "yes":
        start, label = min(call["first_flag"], n - 1), 1
    elif call["extra"]:
        start, label = min(call["first_flag"], n - 1), 0
    else:
        start, label = min(NO_FROM_TURN, n - 1), 0
    return [(call["texts"][: k + 1], label) for k in range(start, n)]


# ---- training

def fit(train_calls):
    df = {}
    for c in train_calls:
        for t in terms(c["texts"]):
            df[t] = df.get(t, 0) + 1
    vocab = sorted(t for t, d in df.items() if d >= MIN_CALLS)
    index = {t: j for j, t in enumerate(vocab)}
    n_docs = len(train_calls)
    idf = [math.log((1 + n_docs) / (1 + df[t])) + 1 for t in vocab]

    pos = sum(1 for c in train_calls if c["gold"] == "yes")
    neg = len(train_calls) - pos
    class_w = {1: len(train_calls) / (2 * pos), 0: len(train_calls) / (2 * neg)}

    X, y, w = [], [], []
    for c in train_calls:
        s = samples_for(c)
        for texts, label in s:
            X.append(vectorize(terms(texts), index, idf))
            y.append(label)
            w.append(class_w[label] / len(s))  # every call weighs the same in total
    total_w = sum(w)
    w = [x / total_w for x in w]

    # Full-batch gradient descent with Nesterov momentum.
    dim = len(vocab)
    coef, bias = [0.0] * dim, 0.0
    vel, vbias = [0.0] * dim, 0.0
    mom = 0.9
    for _ in range(ITERS):
        look = [coef[j] + mom * vel[j] for j in range(dim)]
        lb = bias + mom * vbias
        grad = [L2 * look[j] for j in range(dim)]
        gb = 0.0
        for xi, yi, wi in zip(X, y, w):
            z = lb + sum(look[j] * v for j, v in xi)
            err = wi * (sigmoid(z) - yi)
            gb += err
            for j, v in xi:
                grad[j] += err * v
        vel = [mom * vel[j] - LR * grad[j] for j in range(dim)]
        vbias = mom * vbias - LR * gb
        coef = [coef[j] + vel[j] for j in range(dim)]
        bias += vbias
    return {"vocab": vocab, "index": index, "idf": idf, "coef": coef, "bias": bias}


def predict(model, turn_texts):
    x = vectorize(terms(turn_texts), model["index"], model["idf"])
    return sigmoid(model["bias"] + sum(model["coef"][j] * v for j, v in x))


def first_alert(model, texts):
    """Index of the first turn at which the model says "ambulance", or None."""
    for k in range(len(texts)):
        if predict(model, texts[: k + 1]) >= THRESHOLD:
            return k
    return None


# ---- main

def main():
    calls, extras = load()
    labelled = [c for c in calls if c["gold"] in ("yes", "no")]
    print(f"{len(calls)} calls, {len(labelled)} labelled yes/no "
          f"({sum(c['gold'] == 'yes' for c in labelled)} yes, {sum(c['gold'] == 'no' for c in labelled)} no) "
          f"+ {len(extras)} extra training calls ({sum(c['gold'] == 'no' for c in extras)} no)")

    # Held out: a model trained without any data/source call scores every data/source call.
    held = fit(extras)
    results = {}
    for c in calls:
        p = predict(held, c["texts"])
        results[c["id"]] = {"prob": p, "first_alert": first_alert(held, c["texts"])}
        print(f"  {c['id']:<40} gold={c['gold']:<7} p={p:.2f}")

    final = fit(labelled + extras)

    correct = sum((results[c["id"]]["prob"] >= THRESHOLD) == (c["gold"] == "yes") for c in labelled)
    tp = sum(results[c["id"]]["prob"] >= THRESHOLD for c in labelled if c["gold"] == "yes")
    tn = sum(results[c["id"]]["prob"] < THRESHOLD for c in labelled if c["gold"] == "no")
    n_yes = sum(c["gold"] == "yes" for c in labelled)
    n_no = len(labelled) - n_yes
    print(f"held-out accuracy {correct}/{len(labelled)}  (ambulance {tp}/{n_yes}, no ambulance {tn}/{n_no})")

    # Strongest terms, for the report and the testbench.
    ranked = sorted(range(len(final["vocab"])), key=lambda j: final["coef"][j])
    top_no = [(final["vocab"][j], final["coef"][j]) for j in ranked[:15]]
    top_yes = [(final["vocab"][j], final["coef"][j]) for j in reversed(ranked[-15:])]

    speaker_name = {"operator": "Responder", "caller": "Caller"}
    examples = [{
        "callId": c["id"], "title": c["title"], "gold": c["gold"],
        "looProb": round(results[c["id"]]["prob"], 4),
        "heldOut": True,
        "text": "\n".join(f"{speaker_name[s]}: {t}" for s, t in c["full"]),
    } for c in calls]

    model_json = {
        "_note": "SYNTHETIC training data, not clinically validated. Generated by data/model/train_ambulance.py - do not edit by hand.",
        "version": 2,
        "trainedOn": date.today().isoformat(),
        "threshold": THRESHOLD,
        "bias": round(final["bias"], 6),
        "terms": final["vocab"],
        "idf": [round(v, 6) for v in final["idf"]],
        "weights": [round(v, 6) for v in final["coef"]],
        "evaluation": {"method": "held-out (trained without data/source)", "correct": correct, "total": len(labelled),
                       "ambulanceCorrect": tp, "ambulanceTotal": n_yes, "noAmbulanceCorrect": tn, "noAmbulanceTotal": n_no},
        "examples": examples,
    }
    with open(MODEL_OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(model_json, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    md = ["# Ambulance model: held-out results", "",
          "SYNTHETIC data, not clinically validated. Generated by `python3 data/model/train_ambulance.py`.", "",
          f"TF-IDF (unigrams + bigrams of the caller's words only, negation-tagged) + logistic regression. "
          f"{len(final['vocab'])} terms, threshold {THRESHOLD}. Trained on {len(labelled)} data/source calls, "
          f"{len(EXTRA)} extra calls and {len(GENERATED)} generated calls.", "",
          f"**Accuracy {correct}/{len(labelled)}** (ambulance {tp}/{n_yes}, no ambulance {tn}/{n_no}). "
          "Every score below comes from a model trained only on the extra + generated calls, so it has never seen any data/source call. "
          "\"First says ambulance\" counts caller turns.", "",
          "| Call | Gold | P(ambulance) | Model | First says ambulance at turn |", "|---|---|---|---|---|"]
    for c in calls:
        r = results[c["id"]]
        verdict = "ambulance" if r["prob"] >= THRESHOLD else "no ambulance"
        ok = "" if c["gold"] == "unclear" else (" ✓" if (r["prob"] >= THRESHOLD) == (c["gold"] == "yes") else " ✗")
        fa = "—" if r["first_alert"] is None else f"{r['first_alert'] + 1} of {len(c['texts'])}"
        md.append(f"| {c['id']} | {c['gold']} | {r['prob']:.2f} | {verdict}{ok} | {fa} |")
    md += ["", "## Strongest terms (final model)", "", "| Towards ambulance | weight | Towards no ambulance | weight |", "|---|---|---|---|"]
    for (a, wa), (b, wb) in zip(top_yes, top_no):
        md.append(f"| {a} | {wa:+.2f} | {b} | {wb:+.2f} |")
    with open(REPORT_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md) + "\n")
    print(f"wrote {os.path.relpath(MODEL_OUT, ROOT)} and {os.path.relpath(REPORT_OUT, ROOT)}")


if __name__ == "__main__":
    main()
