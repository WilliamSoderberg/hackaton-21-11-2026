"""Train the "ambulance or not" model on the synthetic calls in data/source.

    python3 data/model/train_ambulance.py

No dependencies (plain Python 3). The model is TF-IDF over word unigrams and
bigrams of the whole conversation (responder + caller) followed by L2-regularised
logistic regression. It writes:

  frontend/app/lib/ambulanceModel.json  weights the frontend runs in the browser
                                        (app/lib/ambulanceModel.ts must tokenise
                                        exactly like tokenize() below)
  data/model/results.md                 leave-one-call-out evaluation

Training data: every call in data/source whose gold `ambulance` is yes or no,
plus the extra synthetic calls in extra_training_calls.py (mostly "no", which
data/source has only 5 of). Calls marked
"unclear" are left out of training and only reported. Because the dashboard
re-scores the call while it is still going, each call also contributes its
partial transcripts (prefixes): a "yes" call counts as "yes" from its first red
flag onwards, a "no" call counts as "no" from its third turn onwards. Each call
gets the same total weight, and the two classes are balanced.

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

MODEL_OUT = os.path.join(ROOT, "frontend", "app", "lib", "ambulanceModel.json")
REPORT_OUT = os.path.join(HERE, "results.md")

MIN_CALLS = 3      # a term must appear in at least this many training calls
L2 = 1e-3          # regularisation strength
ITERS = 400
LR = 2.0
THRESHOLD = 0.5
NO_FROM_TURN = 2   # "no" calls count as "no" from this turn index on


# ---- features (keep in sync with frontend/app/lib/ambulanceModel.ts)

TOKEN = re.compile(r"[a-z0-9åäöéü]+")


def tokenize(text):
    return TOKEN.findall(text.lower().replace("'", "").replace("\u2019", ""))


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

def load():
    calls = []
    for c in CALLS:
        texts = [tx for _, _, tx in c["turns"]]
        g = c["gold"]
        quotes = [q for _, q in g["red_flags"]]
        flag_turns = [i for i, tx in enumerate(texts) if any(q in tx for q in quotes)]
        calls.append({
            "id": c["call_id"], "title": c["title"], "gold": g["ambulance"], "texts": texts,
            "speakers": [sp for _, sp, _ in c["turns"]],
            "first_flag": min(flag_turns) if flag_turns else 0, "extra": False,
        })
    extras = [{
        "id": c["call_id"], "title": c["call_id"], "gold": c["ambulance"], "texts": [tx for _, tx in c["turns"]],
        "speakers": [sp for sp, _ in c["turns"]], "first_flag": c["label_from"], "extra": True,
    } for c in EXTRA]
    return calls, extras


def samples_for(call):
    """(turn_texts_prefix, label) pairs for one training call."""
    n = len(call["texts"])
    if call["gold"] == "yes":
        start, label = call["first_flag"], 1
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

    # Leave-one-call-out: the score for each call comes from a model that never saw it.
    results = {}
    for i, held in enumerate(labelled):
        m = fit([c for c in labelled + extras if c is not held])
        p = predict(m, held["texts"])
        results[held["id"]] = {"prob": p, "first_alert": first_alert(m, held["texts"])}
        print(f"  [{i + 1:2d}/{len(labelled)}] {held['id']:<40} gold={held['gold']:<3} p={p:.2f}")

    final = fit(labelled + extras)
    for c in calls:
        if c["id"] not in results:  # unclear calls were never trained on
            results[c["id"]] = {"prob": predict(final, c["texts"]), "first_alert": first_alert(final, c["texts"])}

    correct = sum((results[c["id"]]["prob"] >= THRESHOLD) == (c["gold"] == "yes") for c in labelled)
    tp = sum(results[c["id"]]["prob"] >= THRESHOLD for c in labelled if c["gold"] == "yes")
    tn = sum(results[c["id"]]["prob"] < THRESHOLD for c in labelled if c["gold"] == "no")
    n_yes = sum(c["gold"] == "yes" for c in labelled)
    n_no = len(labelled) - n_yes
    print(f"leave-one-call-out accuracy {correct}/{len(labelled)}  (ambulance {tp}/{n_yes}, no ambulance {tn}/{n_no})")

    # Strongest terms, for the report and the testbench.
    ranked = sorted(range(len(final["vocab"])), key=lambda j: final["coef"][j])
    top_no = [(final["vocab"][j], final["coef"][j]) for j in ranked[:15]]
    top_yes = [(final["vocab"][j], final["coef"][j]) for j in reversed(ranked[-15:])]

    speaker_name = {"operator": "Responder", "caller": "Caller"}
    examples = [{
        "callId": c["id"], "title": c["title"], "gold": c["gold"],
        "looProb": round(results[c["id"]]["prob"], 4),
        "heldOut": c["gold"] in ("yes", "no"),
        "text": "\n".join(f"{speaker_name[s]}: {t}" for s, t in zip(c["speakers"], c["texts"])),
    } for c in calls]

    model_json = {
        "_note": "SYNTHETIC training data, not clinically validated. Generated by data/model/train_ambulance.py - do not edit by hand.",
        "version": 1,
        "trainedOn": date.today().isoformat(),
        "threshold": THRESHOLD,
        "bias": round(final["bias"], 6),
        "terms": final["vocab"],
        "idf": [round(v, 6) for v in final["idf"]],
        "weights": [round(v, 6) for v in final["coef"]],
        "evaluation": {"method": "leave-one-call-out", "correct": correct, "total": len(labelled),
                       "ambulanceCorrect": tp, "ambulanceTotal": n_yes, "noAmbulanceCorrect": tn, "noAmbulanceTotal": n_no},
        "examples": examples,
    }
    with open(MODEL_OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(model_json, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    md = ["# Ambulance model: leave-one-call-out results", "",
          "SYNTHETIC data, not clinically validated. Generated by `python3 data/model/train_ambulance.py`.", "",
          f"TF-IDF (unigrams + bigrams, whole conversation) + logistic regression. {len(final['vocab'])} terms, threshold {THRESHOLD}.", "",
          f"**Accuracy {correct}/{len(labelled)}** (ambulance {tp}/{n_yes}, no ambulance {tn}/{n_no}). "
          "Each score comes from a model trained without that call. \"Unclear\" calls are not trained on; they are scored by the final model.", "",
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
