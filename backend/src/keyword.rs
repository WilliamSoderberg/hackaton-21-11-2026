//! Offline keyword models. Used when no Claude API key is configured, or when
//! a Claude call fails, so the dashboard always gets an answer.

use std::sync::LazyLock;

use fancy_regex::Regex;

use crate::types::{Indicator, IndicatorKind, Speaker, TranscriptLine, Triage, Urgency};

struct Rule {
    pattern: Regex,
    label: &'static str,
    kind: IndicatorKind,
    /// Contribution to the urgency score.
    weight: u32,
    ambulance: bool,
}

static RULES: LazyLock<Vec<Rule>> = LazyLock::new(|| {
    use IndicatorKind::{Mental as M, Physical as P};
    let rules: &[(&str, &str, IndicatorKind, u32, bool)] = &[
        (
            r"not breathing|stopped breathing|isn't breathing|no pulse",
            "Not breathing",
            P,
            45,
            true,
        ),
        (
            r"unconscious|not responding|unresponsive|collapsed|won't wake up",
            "Unresponsive",
            P,
            35,
            true,
        ),
        (
            r"can't breathe|cannot breathe|(difficulty|trouble|struggling) breathing|short of breath|choking",
            "Breathing difficulty",
            P,
            35,
            true,
        ),
        (
            r"heart attack|cardiac arrest",
            "Suspected heart attack",
            P,
            40,
            true,
        ),
        (
            r"stroke|face is drooping|slurred speech|slurring",
            "Stroke signs",
            P,
            40,
            true,
        ),
        (r"overdose|took too many", "Overdose", P, 35, true),
        (
            r"chest pain|pain in (my|his|her) chest",
            "Chest pain",
            P,
            25,
            true,
        ),
        (r"seizure|convuls|fitting", "Seizure", P, 30, true),
        (
            r"allergic|anaphyla|throat is (swelling|closing)",
            "Allergic reaction",
            P,
            30,
            true,
        ),
        (
            r"(car|traffic) (crash|accident)|collision|hit by a (car|bus|truck)",
            "Traffic accident",
            P,
            30,
            true,
        ),
        (r"lips.*blue|turning blue", "Cyanosis", P, 20, true),
        (r"(?<!no )(bleeding|blood)", "Bleeding", P, 20, true),
        (
            r"hit (my|his|her|their) head|head injury|concussion",
            "Head injury",
            P,
            20,
            true,
        ),
        (r"fainted|passed out", "Fainted", P, 20, true),
        (
            r"pregnant|contractions|in labou?r|water broke",
            "Pregnancy / labour",
            P,
            20,
            true,
        ),
        (r"broken|fracture", "Possible fracture", P, 12, false),
        (r"\bburn(ed|t|s|ing)?\b", "Burn", P, 15, false),
        (r"twisted|sprain|swollen", "Limb injury", P, 8, false),
        (r"hurts|pain(?!t)", "Pain", P, 5, false),
        (
            r"heart is racing|shaking|dizzy",
            "Physical stress symptoms",
            P,
            6,
            false,
        ),
        (
            r"ending it|end my life|kill myself|want to die|hurting yourself|suicid",
            "Suicidal ideation",
            M,
            40,
            true,
        ),
        (
            r"self[- ]harm|cut(ting)? myself|hurt(ing)? myself",
            "Self-harm",
            M,
            30,
            true,
        ),
        (
            r"hearing voices|hallucinat|paranoi",
            "Psychosis signs",
            M,
            20,
            false,
        ),
        (r"pills", "Means available", M, 15, false),
        (
            r"hopeless|can't do this anymore|depress",
            "Hopelessness",
            M,
            15,
            false,
        ),
        (
            r"panic attack|scared|anxious|anxiety",
            "Panic / anxiety",
            M,
            10,
            false,
        ),
        (r"alone", "Isolated", M, 5, false),
    ];
    rules
        .iter()
        .map(|&(pattern, label, kind, weight, ambulance)| Rule {
            pattern: Regex::new(&format!("(?i){pattern}")).expect("valid keyword pattern"),
            label,
            kind,
            weight,
            ambulance,
        })
        .collect()
});

fn caller_text(lines: &[TranscriptLine]) -> String {
    lines
        .iter()
        .filter(|l| l.speaker == Speaker::Caller)
        .map(|l| l.text.as_str())
        .collect::<Vec<_>>()
        .join(" ")
}

fn matching_rules(lines: &[TranscriptLine]) -> Vec<&'static Rule> {
    let text = caller_text(lines);
    RULES
        .iter()
        .filter(|r| r.pattern.is_match(&text).unwrap_or(false))
        .collect()
}

/// Keyword triage model: urgency, ambulance and physical/mental split.
pub fn triage(lines: &[TranscriptLine]) -> Triage {
    let hits = matching_rules(lines);
    let weight = |kind| -> u32 {
        hits.iter()
            .filter(|r| r.kind == kind)
            .map(|r| r.weight)
            .sum()
    };
    let physical = weight(IndicatorKind::Physical);
    let mental = weight(IndicatorKind::Mental);
    let total = physical + mental;
    let score = total.min(100) as u8;
    Triage {
        urgency: Urgency::from_score(score),
        urgency_score: score,
        ambulance: hits.iter().any(|r| r.ambulance),
        physical: if total == 0 {
            50
        } else {
            ((physical * 100 + total / 2) / total) as u8
        },
    }
}

/// Keyword indicator model: which red flags appear in the caller's words.
pub fn indicators(lines: &[TranscriptLine]) -> Vec<Indicator> {
    matching_rules(lines)
        .into_iter()
        .map(|r| Indicator {
            label: r.label.to_string(),
            kind: r.kind,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn caller(text: &str) -> TranscriptLine {
        TranscriptLine {
            speaker: Speaker::Caller,
            text: text.into(),
        }
    }

    #[test]
    fn cardiac_arrest_is_critical_with_ambulance() {
        let lines = [
            caller("My father just collapsed, he's not responding!"),
            caller("He's not breathing and his lips are turning blue."),
        ];
        let t = triage(&lines);
        assert_eq!(t.urgency, Urgency::Critical);
        assert!(t.ambulance);
        assert_eq!(t.physical, 100);
        let labels: Vec<_> = indicators(&lines).into_iter().map(|i| i.label).collect();
        assert!(labels.contains(&"Not breathing".to_string()));
        assert!(labels.contains(&"Cyanosis".to_string()));
    }

    #[test]
    fn sprained_ankle_is_low_without_ambulance() {
        let lines = [caller(
            "I twisted my ankle. It's swollen and it hurts. No bleeding.",
        )];
        let t = triage(&lines);
        assert_eq!(t.urgency, Urgency::Low);
        assert!(!t.ambulance);
        let labels: Vec<_> = indicators(&lines).into_iter().map(|i| i.label).collect();
        assert!(
            !labels.contains(&"Bleeding".to_string()),
            "negative lookbehind for 'no bleeding'"
        );
    }

    #[test]
    fn operator_lines_are_ignored() {
        let lines = [TranscriptLine {
            speaker: Speaker::Operator,
            text: "Is he bleeding?".into(),
        }];
        assert!(indicators(&lines).is_empty());
        assert_eq!(triage(&lines).urgency_score, 0);
    }

    #[test]
    fn crisis_call_is_mostly_mental() {
        let lines = [caller(
            "I feel hopeless. Sometimes I think about ending it. I have pills here.",
        )];
        let t = triage(&lines);
        assert!(t.ambulance);
        assert!(t.physical < 50);
    }
}
