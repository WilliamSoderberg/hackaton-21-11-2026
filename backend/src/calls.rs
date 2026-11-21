//! Call log stored in SQLite.
//!
//! The Next.js call store reports every call here: `POST /api/calls` when it
//! starts, `PATCH /api/calls/{id}` with each new assessment and transcript
//! line, and again when it ends. `GET /api/calls` lists them for the calls
//! overview page.

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use anyhow::Context;
use axum::{
    Json,
    extract::{Path as UrlPath, Query, State},
    http::StatusCode,
};
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};

use crate::{
    AppState,
    types::{TranscriptLine, Urgency},
};

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS calls (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id     TEXT    NOT NULL,
    label         TEXT    NOT NULL,
    location      TEXT    NOT NULL,
    status        TEXT    NOT NULL CHECK (status IN ('active', 'ended')),
    started_at    INTEGER NOT NULL,          -- ms since epoch
    ended_at      INTEGER,
    urgency       TEXT    CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical')),
    urgency_score INTEGER,
    ambulance     INTEGER,                   -- 0/1, NULL until first assessment
    indicators    TEXT    NOT NULL DEFAULT '[]', -- JSON array of strings
    transcript    TEXT    NOT NULL DEFAULT '[]', -- JSON array of TranscriptLine
    updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_status ON calls (status, started_at);
";

const COLUMNS: &str = "id, source_id, label, location, status, started_at, ended_at, urgency, \
     urgency_score, ambulance, indicators, transcript, updated_at";

/// Upper bounds on what one request may store.
const MAX_TEXT: usize = 500;
const MAX_LINES: usize = 500;
const MAX_INDICATORS: usize = 50;

#[derive(Clone)]
pub struct CallDb(Arc<Mutex<Connection>>);

impl CallDb {
    pub fn open(path: impl AsRef<Path>) -> anyhow::Result<Self> {
        let path = path.as_ref();
        let conn = Connection::open(path).with_context(|| format!("open {}", path.display()))?;
        Self::init(conn)
    }

    #[cfg(test)]
    pub fn in_memory() -> anyhow::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> anyhow::Result<Self> {
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self(Arc::new(Mutex::new(conn))))
    }

    fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        // A panic while holding the lock leaves SQLite itself consistent.
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn create(&self, new: &NewCall) -> rusqlite::Result<CallRecord> {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO calls (source_id, label, location, status, started_at, updated_at)
             VALUES (?1, ?2, ?3, 'active', ?4, ?5)",
            params![
                new.source_id,
                new.label,
                new.location,
                new.started_at,
                now_ms()
            ],
        )?;
        get(&conn, conn.last_insert_rowid()).map(|c| c.expect("row just inserted"))
    }

    pub fn update(&self, id: i64, patch: &CallPatch) -> rusqlite::Result<Option<CallRecord>> {
        let conn = self.conn();
        let tx = conn.unchecked_transaction()?;
        if let Some(status) = patch.status {
            tx.execute(
                "UPDATE calls SET status = ?2, ended_at = CASE WHEN ?2 = 'ended'
                     THEN COALESCE(?3, ended_at, ?4) ELSE NULL END
                 WHERE id = ?1",
                params![id, status.as_str(), patch.ended_at, now_ms()],
            )?;
        }
        if let Some(a) = &patch.assessment {
            tx.execute(
                "UPDATE calls SET urgency = ?2, urgency_score = ?3, ambulance = ?4,
                     indicators = ?5
                 WHERE id = ?1",
                params![
                    id,
                    format!("{:?}", a.urgency),
                    a.urgency_score,
                    a.ambulance,
                    serde_json::to_string(&a.indicators).expect("strings serialize"),
                ],
            )?;
        }
        if let Some(lines) = &patch.transcript {
            tx.execute(
                "UPDATE calls SET transcript = ?2 WHERE id = ?1",
                params![id, serde_json::to_string(lines).expect("lines serialize")],
            )?;
        }
        tx.execute(
            "UPDATE calls SET updated_at = ?2 WHERE id = ?1",
            params![id, now_ms()],
        )?;
        tx.commit()?;
        get(&conn, id)
    }

    /// Marks every active call as ended, e.g. after the frontend restarted and
    /// lost track of the call it was running.
    pub fn end_active(&self) -> rusqlite::Result<usize> {
        let now = now_ms();
        self.conn().execute(
            "UPDATE calls SET status = 'ended', ended_at = ?1, updated_at = ?1 WHERE status = 'active'",
            params![now],
        )
    }

    /// Newest first; sorting by urgency or ambulance is done in the table.
    pub fn list(&self, status: Option<CallStatus>) -> rusqlite::Result<Vec<CallRecord>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM calls WHERE ?1 IS NULL OR status = ?1
             ORDER BY started_at DESC, id DESC LIMIT 500"
        ))?;
        stmt.query_map(params![status.map(CallStatus::as_str)], from_row)?
            .collect()
    }
}

fn get(conn: &Connection, id: i64) -> rusqlite::Result<Option<CallRecord>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM calls WHERE id = ?1"),
        [id],
        from_row,
    )
    .optional()
}

fn from_row(row: &Row) -> rusqlite::Result<CallRecord> {
    let urgency: Option<String> = row.get("urgency")?;
    let indicators: String = row.get("indicators")?;
    let transcript: String = row.get("transcript")?;
    let status: String = row.get("status")?;
    Ok(CallRecord {
        id: row.get("id")?,
        source_id: row.get("source_id")?,
        label: row.get("label")?,
        location: row.get("location")?,
        status: if status == "ended" {
            CallStatus::Ended
        } else {
            CallStatus::Active
        },
        started_at: row.get("started_at")?,
        ended_at: row.get("ended_at")?,
        urgency: urgency.as_deref().and_then(parse_urgency),
        urgency_score: row.get("urgency_score")?,
        ambulance: row.get("ambulance")?,
        indicators: serde_json::from_str(&indicators).unwrap_or_default(),
        transcript: serde_json::from_str(&transcript).unwrap_or_default(),
        updated_at: row.get("updated_at")?,
    })
}

fn parse_urgency(s: &str) -> Option<Urgency> {
    Some(match s {
        "Low" => Urgency::Low,
        "Medium" => Urgency::Medium,
        "High" => Urgency::High,
        "Critical" => Urgency::Critical,
        _ => return None,
    })
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CallStatus {
    Active,
    Ended,
}

impl CallStatus {
    fn as_str(self) -> &'static str {
        match self {
            CallStatus::Active => "active",
            CallStatus::Ended => "ended",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallRecord {
    pub id: i64,
    pub source_id: String,
    pub label: String,
    pub location: String,
    pub status: CallStatus,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub urgency: Option<Urgency>,
    pub urgency_score: Option<u8>,
    pub ambulance: Option<bool>,
    pub indicators: Vec<String>,
    pub transcript: Vec<TranscriptLine>,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCall {
    pub source_id: String,
    pub label: String,
    #[serde(default)]
    pub location: String,
    pub started_at: i64,
}

/// The parts of a `Classification` worth keeping.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assessment {
    pub urgency: Urgency,
    pub urgency_score: u8,
    pub ambulance: bool,
    #[serde(default)]
    pub indicators: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallPatch {
    pub status: Option<CallStatus>,
    pub ended_at: Option<i64>,
    pub assessment: Option<Assessment>,
    pub transcript: Option<Vec<TranscriptLine>>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<CallStatus>,
}

type ApiError = (StatusCode, String);

fn db_error(e: rusqlite::Error) -> ApiError {
    tracing::error!("call database error: {e}");
    (StatusCode::INTERNAL_SERVER_ERROR, "database error".into())
}

fn too_large() -> ApiError {
    (StatusCode::PAYLOAD_TOO_LARGE, "call data too large".into())
}

pub async fn list_handler(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<CallRecord>>, ApiError> {
    state.calls.list(q.status).map(Json).map_err(db_error)
}

pub async fn create_handler(
    State(state): State<Arc<AppState>>,
    Json(new): Json<NewCall>,
) -> Result<(StatusCode, Json<CallRecord>), ApiError> {
    if [&new.source_id, &new.label, &new.location]
        .iter()
        .any(|s| s.len() > MAX_TEXT)
    {
        return Err(too_large());
    }
    let call = state.calls.create(&new).map_err(db_error)?;
    Ok((StatusCode::CREATED, Json(call)))
}

pub async fn update_handler(
    State(state): State<Arc<AppState>>,
    UrlPath(id): UrlPath<i64>,
    Json(patch): Json<CallPatch>,
) -> Result<Json<CallRecord>, ApiError> {
    if patch.transcript.as_ref().is_some_and(|t| {
        t.len() > MAX_LINES || t.iter().map(|l| l.text.len()).sum::<usize>() > 50_000
    }) || patch
        .assessment
        .as_ref()
        .is_some_and(|a| a.indicators.len() > MAX_INDICATORS)
    {
        return Err(too_large());
    }
    match state.calls.update(id, &patch).map_err(db_error)? {
        Some(call) => Ok(Json(call)),
        None => Err((StatusCode::NOT_FOUND, "no such call".into())),
    }
}

pub async fn end_active_handler(
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    state.calls.end_active().map_err(db_error)?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Speaker;

    fn new_call(label: &str, started_at: i64) -> NewCall {
        NewCall {
            source_id: "microphone".into(),
            label: label.into(),
            location: "Lund".into(),
            started_at,
        }
    }

    #[test]
    fn create_update_list_and_end() {
        let db = CallDb::in_memory().unwrap();
        let a = db.create(&new_call("first", 1)).unwrap();
        let b = db.create(&new_call("second", 2)).unwrap();
        assert_eq!(a.status, CallStatus::Active);
        assert_eq!(a.urgency, None);

        let patch = CallPatch {
            assessment: Some(Assessment {
                urgency: Urgency::Critical,
                urgency_score: 90,
                ambulance: true,
                indicators: vec!["Not breathing".into()],
            }),
            transcript: Some(vec![TranscriptLine {
                speaker: Speaker::Caller,
                text: "He is not breathing".into(),
            }]),
            ..Default::default()
        };
        let a = db.update(a.id, &patch).unwrap().unwrap();
        assert_eq!(a.urgency, Some(Urgency::Critical));
        assert_eq!(a.ambulance, Some(true));
        assert_eq!(a.indicators, ["Not breathing"]);
        assert_eq!(a.transcript.len(), 1);

        let ended = CallPatch {
            status: Some(CallStatus::Ended),
            ended_at: Some(10),
            ..Default::default()
        };
        let b = db.update(b.id, &ended).unwrap().unwrap();
        assert_eq!(b.ended_at, Some(10));

        let active = db.list(Some(CallStatus::Active)).unwrap();
        assert_eq!(active.iter().map(|c| c.id).collect::<Vec<_>>(), [a.id]);
        // Newest first.
        let all = db.list(None).unwrap();
        assert_eq!(all.iter().map(|c| c.id).collect::<Vec<_>>(), [b.id, a.id]);

        assert_eq!(db.end_active().unwrap(), 1);
        assert!(db.list(Some(CallStatus::Active)).unwrap().is_empty());
        assert!(db.update(999, &CallPatch::default()).unwrap().is_none());
    }

    #[test]
    fn record_serializes_like_frontend_type() {
        let db = CallDb::in_memory().unwrap();
        let c = db.create(&new_call("x", 5)).unwrap();
        let v = serde_json::to_value(&c).unwrap();
        assert_eq!(v["status"], "active");
        assert_eq!(v["startedAt"], 5);
        assert!(v["urgency"].is_null());
    }
}
