//! Emergency call triage backend.
//!
//! `POST /api/classify` takes the current call transcript from the dashboard
//! and runs two models in parallel:
//!   * a triage model  -> urgency, urgency score, ambulance yes/no, physical/mental split
//!   * an indicator model -> the detected indicators shown as chips
//!
//! With `ANTHROPIC_API_KEY` set both models are Claude; otherwise (or if a
//! Claude call fails) the offline keyword models answer instead.

mod claude;
mod keyword;
mod types;

use std::{net::SocketAddr, sync::Arc};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};

use crate::{
    claude::ClaudeClient,
    types::{
        Classification, ClassifyRequest, ModelSource, Sources, Speaker, TranscriptLine, Triage,
        Urgency, format_transcript,
    },
};

/// Upper bound on what one request may send, to keep model calls bounded.
const MAX_LINES: usize = 500;
const MAX_CHARS: usize = 50_000;

struct AppState {
    claude: Option<ClaudeClient>,
}

#[tokio::main]
async fn main() {
    // Load backend/.env if present; real environment variables take precedence.
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    let claude = ClaudeClient::from_env();
    match &claude {
        Some(c) => info!("using Claude model {} for triage and indicators", c.model()),
        None => warn!("ANTHROPIC_API_KEY not set: using offline keyword models"),
    }

    let app = router(Arc::new(AppState { claude }));
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind port");
    axum::serve(listener, app).await.expect("server");
}

fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/classify", post(classify_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn classify_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ClassifyRequest>,
) -> Result<Json<Classification>, (StatusCode, String)> {
    let chars: usize = req.lines.iter().map(|l| l.text.len()).sum();
    if req.lines.len() > MAX_LINES || chars > MAX_CHARS {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "transcript too long".into()));
    }
    Ok(Json(classify(state.claude.as_ref(), &req.lines).await))
}

async fn classify(claude: Option<&ClaudeClient>, lines: &[TranscriptLine]) -> Classification {
    // Nothing from the caller yet: nothing to assess.
    if !lines
        .iter()
        .any(|l| l.speaker == Speaker::Caller && !l.text.trim().is_empty())
    {
        return empty_classification();
    }

    let ((triage, triage_src), (indicators, ind_src)) = match claude {
        Some(c) => {
            let transcript = format_transcript(lines);
            let (t, i) = tokio::join!(c.triage(&transcript), c.indicators(&transcript));
            let t = t.map(|t| (t, ModelSource::Claude)).unwrap_or_else(|e| {
                warn!("Claude triage failed, using keyword model: {e:#}");
                (keyword::triage(lines), ModelSource::Keyword)
            });
            let i = i.map(|i| (i, ModelSource::Claude)).unwrap_or_else(|e| {
                warn!("Claude indicators failed, using keyword model: {e:#}");
                (keyword::indicators(lines), ModelSource::Keyword)
            });
            (t, i)
        }
        None => (
            (keyword::triage(lines), ModelSource::Keyword),
            (keyword::indicators(lines), ModelSource::Keyword),
        ),
    };

    let physical = triage.physical;
    Classification {
        urgency: triage.urgency,
        urgency_score: triage.urgency_score,
        ambulance: triage.ambulance,
        physical,
        mental: 100 - physical,
        indicators: indicators.into_iter().map(|i| i.label).collect(),
        sources: Sources {
            triage: triage_src,
            indicators: ind_src,
        },
    }
}

fn empty_classification() -> Classification {
    let t = Triage {
        urgency: Urgency::Low,
        urgency_score: 0,
        ambulance: false,
        physical: 50,
    };
    Classification {
        urgency: t.urgency,
        urgency_score: t.urgency_score,
        ambulance: t.ambulance,
        physical: t.physical,
        mental: 100 - t.physical,
        indicators: vec![],
        sources: Sources {
            triage: ModelSource::Keyword,
            indicators: ModelSource::Keyword,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn empty_transcript_gives_empty_classification() {
        let c = classify(None, &[]).await;
        assert_eq!(c.urgency_score, 0);
        assert!(c.indicators.is_empty());
        assert_eq!(c.physical + c.mental, 100);
    }

    #[tokio::test]
    async fn keyword_pipeline_serializes_like_frontend_type() {
        let lines = [TranscriptLine {
            speaker: Speaker::Caller,
            text: "He collapsed and is not breathing".into(),
        }];
        let c = classify(None, &lines).await;
        let v = serde_json::to_value(&c).unwrap();
        assert_eq!(v["urgency"], "Critical");
        assert_eq!(v["ambulance"], true);
        assert!(v["urgencyScore"].is_number());
        assert_eq!(v["sources"]["triage"], "keyword");
    }
}
