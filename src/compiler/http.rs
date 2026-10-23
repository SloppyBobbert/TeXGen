use std::{fmt::Display, sync::Arc};

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{
    jobs,
    lifecycle::Engine,
    service::{Compiler, Failure},
};
use crate::{document::Document, render};

type Error = (StatusCode, Json<Value>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CompileRequest {
    document: Document,
    revision: u64,
    request_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CancelRequest {
    request_id: String,
}

fn error(status: StatusCode, message: impl Into<String>) -> Error {
    (status, Json(json!({ "error": message.into() })))
}

fn failure(failure: Failure) -> Error {
    match failure {
        Failure::Identity => error(
            StatusCode::BAD_REQUEST,
            "The compilation request identity is invalid.",
        ),
        Failure::Admission(jobs::Failure::Busy) => error(
            StatusCode::CONFLICT,
            "The compiler is busy. Wait for cleanup, then try again.",
        ),
        Failure::Unavailable | Failure::Admission(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "The compiler is unavailable. Uncertain cleanup requires review.",
        ),
        Failure::Files(_) => error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Compiler file preparation failed. The source is unchanged.",
        ),
        Failure::Compile(message) => error(StatusCode::UNPROCESSABLE_ENTITY, message),
    }
}

pub fn routes<E>(compiler: Arc<Compiler<E>>) -> Router
where
    E: Engine + Send + 'static,
    E::Error: Display,
{
    Router::new()
        .route("/api/compile", post(compile::<E>))
        .route("/api/compile/cancel", post(cancel::<E>))
        .with_state(compiler)
}

async fn compile<E>(
    State(compiler): State<Arc<Compiler<E>>>,
    Json(request): Json<CompileRequest>,
) -> Result<Response, Error>
where
    E: Engine + Send + 'static,
    E::Error: Display,
{
    if request.revision > 9_007_199_254_740_991 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "The session revision must be a safe nonnegative integer.",
        ));
    }
    let source = render::tex(&request.document)
        .map_err(|message| error(StatusCode::BAD_REQUEST, message))?;
    let document_id = HeaderValue::from_str(&request.document.id).map_err(|_| {
        error(
            StatusCode::BAD_REQUEST,
            "The document identity cannot be returned.",
        )
    })?;
    let request_id = HeaderValue::from_str(&request.request_id).map_err(|_| {
        error(
            StatusCode::BAD_REQUEST,
            "The request identity cannot be returned.",
        )
    })?;
    let mut ticket = compiler
        .begin(request.request_id, source)
        .await
        .map_err(failure)?;
    let candidate = ticket.finish().await.map_err(failure)?;
    // The browser must verify these candidate bytes in its worker before preview or export.
    let mut response = candidate.bytes.into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/pdf"),
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=texgen-document.pdf"),
    );
    response
        .headers_mut()
        .insert("x-texgen-document-id", document_id);
    response.headers_mut().insert(
        "x-texgen-revision",
        HeaderValue::from_str(&request.revision.to_string()).expect("numeric revision"),
    );
    response
        .headers_mut()
        .insert("x-texgen-request-id", request_id);
    Ok(response)
}

async fn cancel<E>(
    State(compiler): State<Arc<Compiler<E>>>,
    Json(request): Json<CancelRequest>,
) -> Result<StatusCode, Error>
where
    E: Engine + Send + 'static,
    E::Error: Display,
{
    if request.request_id.len() != 64
        || !request
            .request_id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "The compilation request identity is invalid.",
        ));
    }
    compiler
        .cancel(&request.request_id)
        .await
        .map_err(failure)?;
    Ok(StatusCode::ACCEPTED)
}
