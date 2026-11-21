"use client";

import { useMemo, useState } from "react";
import { modelInfo, parseConversation, predictAmbulance, type ModelExample } from "../lib/ambulanceModel";
import AppNav from "./AppNav";

// Paste a responder/caller conversation and see what the trained ambulance
// model (data/model/train_ambulance.py) says. Runs entirely in the browser.

const PLACEHOLDER = `Responder: 112, what is your emergency?
Caller: My dad is having chest pain, he's sweaty and grey.
Responder: What is the address?
Caller: Bankgatan 4 in Lund.`;

const goldLabel: Record<string, string> = { yes: "Ambulance", no: "No ambulance", unclear: "Unclear" };

export default function AmbulanceTestbench() {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const turns = useMemo(() => parseConversation(text), [text]);
  const result = useMemo(() => (turns.length ? predictAmbulance(turns) : null), [turns]);
  // Score after every turn, as the live dashboard would see the call unfold.
  const trace = useMemo(() => turns.map((_, i) => predictAmbulance(turns.slice(0, i + 1)).probability), [turns]);
  const example = modelInfo.examples.find((e) => e.callId === loaded);
  const ev = modelInfo.evaluation;

  function load(e: ModelExample) {
    setText(e.text);
    setLoaded(e.callId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-800 text-lg font-semibold text-white">+</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Ambulance Model Testbench</h1>
            <p className="text-xs text-slate-500">
              Trained {modelInfo.trainedOn} · {modelInfo.termCount} terms · held-out {ev.correct}/{ev.total}
            </p>
          </div>
          <AppNav />
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-5 lg:p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Conversation</h2>
            <div className="flex items-center gap-2">
              <select
                value={loaded ?? ""}
                onChange={(e) => {
                  const ex = modelInfo.examples.find((x) => x.callId === e.target.value);
                  if (ex) load(ex);
                }}
                className="max-w-64 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                aria-label="Load a call from the dataset"
              >
                <option value="" disabled>
                  Load a dataset call…
                </option>
                {modelInfo.examples.map((e) => (
                  <option key={e.callId} value={e.callId}>
                    {e.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setText("");
                  setLoaded(null);
                }}
                disabled={!text}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setLoaded(null);
            }}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="h-[28rem] w-full resize-y rounded-md border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-400">
            One turn per line. The model reads only the caller: &quot;Responder:&quot; / &quot;Operator:&quot; lines are
            skipped, and unlabelled lines count as the caller. {turns.length} caller turn{turns.length === 1 ? "" : "s"}.
          </p>
        </section>

        <section className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Model says</h2>
            <Verdict probability={result?.probability ?? null} />
            {example && (
              <p className="mt-3 text-xs text-slate-500">
                Dataset label: <span className="font-semibold text-slate-700">{goldLabel[example.gold]}</span>
                {example.heldOut
                  ? ` · held-out score ${Math.round(example.looProb * 100)}% (model trained without any hand-written call)`
                  : " · not used in training"}
                . The score above is from the final model, which{" "}
                {example.gold === "unclear" ? "has not seen this call either" : "was also trained on this call"}.
              </p>
            )}
          </div>

          {result && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">As the call unfolds</h2>
              <div className="flex h-16 items-end gap-0.5" aria-label="Ambulance probability after each turn">
                {trace.map((p, i) => (
                  <div
                    key={i}
                    title={`After caller turn ${i + 1}: ${Math.round(p * 100)}%`}
                    className={`flex-1 rounded-t-sm ${p >= modelInfo.threshold ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ height: `${Math.max(4, p * 100)}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">Probability after each caller turn · threshold {modelInfo.threshold * 100}%</p>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Words that moved the score</h2>
              <ul className="flex flex-wrap gap-1.5">
                {result.contributions.map((c) => (
                  <li
                    key={c.term}
                    className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                      c.weight > 0 ? "bg-red-50 text-red-800 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    }`}
                  >
                    {c.term} {c.weight > 0 ? "+" : "−"}
                    {Math.abs(c.weight).toFixed(2)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">Red pushes towards ambulance, green away from it.</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Dataset results (held out)</h2>
            <span className="text-xs text-slate-500">
              Correct {ev.correct}/{ev.total} · ambulance {ev.ambulanceCorrect}/{ev.ambulanceTotal} · no ambulance{" "}
              {ev.noAmbulanceCorrect}/{ev.noAmbulanceTotal}. Each score is from a model trained without that call. Click a
              row to load it.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Call</th>
                  <th className="py-2 pr-3 font-medium">Label</th>
                  <th className="py-2 pr-3 font-medium">P(ambulance)</th>
                  <th className="py-2 font-medium">Model</th>
                </tr>
              </thead>
              <tbody>
                {modelInfo.examples.map((e) => {
                  const says = e.looProb >= modelInfo.threshold;
                  const right = e.gold === "unclear" ? null : says === (e.gold === "yes");
                  return (
                    <tr
                      key={e.callId}
                      onClick={() => load(e)}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                        loaded === e.callId ? "bg-sky-50" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-3">{e.title}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{goldLabel[e.gold]}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{Math.round(e.looProb * 100)}%</td>
                      <td className="py-1.5">
                        <span className={says ? "text-red-700" : "text-emerald-700"}>{says ? "Ambulance" : "No ambulance"}</span>
                        {right !== null && (
                          <span className={`ml-2 ${right ? "text-emerald-600" : "font-semibold text-red-600"}`}>
                            {right ? "✓" : "✗"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Synthetic training data only, not clinically validated. Retrain with{" "}
            <code>python3 data/model/train_ambulance.py</code>.
          </p>
        </section>
      </main>
    </div>
  );
}

function Verdict({ probability }: { probability: number | null }) {
  if (probability === null) {
    return <p className="py-6 text-center text-sm text-slate-400">Paste a conversation to evaluate it.</p>;
  }
  const yes = probability >= modelInfo.threshold;
  return (
    <div className={`rounded-lg p-4 ring-1 ${yes ? "bg-red-50 ring-red-500/40" : "bg-emerald-50 ring-emerald-500/30"}`}>
      <p className={`text-2xl font-bold ${yes ? "text-red-700" : "text-emerald-700"}`}>
        {yes ? "Ambulance" : "No ambulance"}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
        <div
          className={`h-full transition-all duration-300 ${yes ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${probability * 100}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">{Math.round(probability * 100)}% probability an ambulance is needed</p>
    </div>
  );
}
