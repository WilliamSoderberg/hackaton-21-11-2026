//! Wire types shared with the frontend (`frontend/app/lib/calls.ts`).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
pub enum Speaker {
    Caller,
    Operator,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TranscriptLine {
    pub speaker: Speaker,
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct ClassifyRequest {
    pub lines: Vec<TranscriptLine>,
}

/// Several transcripts to rate with the keyword model only (crew map).
#[derive(Debug, Deserialize)]
pub struct KeywordTriageRequest {
    pub transcripts: Vec<Vec<TranscriptLine>>,
}

/// Keyword-model urgency for one transcript.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeywordUrgency {
    pub urgency: Urgency,
    pub urgency_score: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
pub enum Urgency {
    Low,
    Medium,
    High,
    Critical,
}

impl Urgency {
    pub fn from_score(score: u8) -> Self {
        match score {
            75.. => Urgency::Critical,
            45.. => Urgency::High,
            20.. => Urgency::Medium,
            _ => Urgency::Low,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum IndicatorKind {
    Physical,
    Mental,
}

/// Output of the triage model: how urgent, and whether to send an ambulance.
#[derive(Debug, Clone, PartialEq)]
pub struct Triage {
    pub urgency: Urgency,
    pub urgency_score: u8,
    pub ambulance: bool,
    /// 0–100 share of the problem that is physical; mental = 100 - physical.
    pub physical: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Indicator {
    pub label: String,
    pub kind: IndicatorKind,
}

/// Which model produced each part of the answer.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelSource {
    Claude,
    Keyword,
}

#[derive(Debug, Clone, Serialize)]
pub struct Sources {
    pub triage: ModelSource,
    pub indicators: ModelSource,
}

/// Response sent back to the frontend, which only displays it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Classification {
    pub urgency: Urgency,
    pub urgency_score: u8,
    pub ambulance: bool,
    pub physical: u8,
    pub mental: u8,
    pub indicators: Vec<String>,
    pub sources: Sources,
}

pub fn format_transcript(lines: &[TranscriptLine]) -> String {
    lines
        .iter()
        .map(|l| format!("{:?}: {}", l.speaker, l.text.trim()))
        .collect::<Vec<_>>()
        .join("\n")
}
