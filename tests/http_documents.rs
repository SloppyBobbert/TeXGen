use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
    response::Response,
};
use serde_json::{Value, json};
use std::{path::PathBuf, sync::Arc};
use texgen::{ADDRESS, ORIGIN, session::Session, web};
use tower::ServiceExt;

async fn authorized() -> (Router, String) {
    let session = Arc::new(Session::new().unwrap());
    let token = session
        .launch_fragment()
        .trim_start_matches("#launch=")
        .to_owned();
    let app = web::app(session, PathBuf::from("ui/dist"));
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/session")
                .header("host", ADDRESS)
                .header("origin", ORIGIN)
                .header("x-texgen-client", "1")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::from("{}"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    let cookie = response.headers()["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_owned();
    (app, cookie)
}

fn request(path: &str, cookie: &str, value: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(path)
        .header("host", ADDRESS)
        .header("origin", ORIGIN)
        .header("x-texgen-client", "1")
        .header("content-type", "application/json")
        .header("cookie", cookie)
        .body(Body::from(value.to_string()))
        .unwrap()
}

async fn body(response: Response) -> Value {
    let bytes = axum::body::to_bytes(response.into_body(), 2_000_000)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/document.json")).unwrap()
}

#[tokio::test]
async fn catalog_has_the_saved_source_counts_and_requires_authorization() {
    let (app, cookie) = authorized().await;
    let get = |cookie: &str| {
        Request::builder()
            .uri("/api/catalog")
            .header("host", ADDRESS)
            .header("x-texgen-client", "1")
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap()
    };
    assert_eq!(
        app.clone().oneshot(get("")).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
    let response = app.oneshot(get(&cookie)).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let catalog = body(response).await;
    assert_eq!(catalog["subjects"].as_array().unwrap().len(), 14);
    assert_eq!(catalog["version"], 1);
}

#[tokio::test]
async fn rendering_echoes_the_document_and_revision_and_uses_the_canonical_path() {
    let (app, cookie) = authorized().await;
    let input = json!({ "document": fixture(), "revision": 7 });
    let response = app
        .clone()
        .oneshot(request("/api/render", &cookie, input.clone()))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let rendered = body(response).await;
    assert_eq!(rendered["documentId"], "doc-fixture");
    assert_eq!(rendered["revision"], 7);
    assert_eq!(rendered["source"], include_str!("fixtures/document.tex"));
    let repeated = body(
        app.oneshot(request("/api/render", &cookie, input))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(rendered, repeated);
}

#[tokio::test]
async fn format_validation_preserves_the_document_and_rejects_bad_layout_and_revision() {
    let (app, cookie) = authorized().await;
    let original = fixture();
    let response = app
        .clone()
        .oneshot(request(
            "/api/documents/validate",
            &cookie,
            json!({"document": original, "revision": 0}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        body(response).await,
        json!({"documentId":"doc-fixture", "revision":0})
    );
    let mut changed = original.clone();
    changed["layout"]["columns"] = json!(0);
    let response = app
        .clone()
        .oneshot(request(
            "/api/render",
            &cookie,
            json!({"document": changed, "revision":1}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(body(response).await.get("source").is_none());
    let response = app
        .oneshot(request(
            "/api/render",
            &cookie,
            json!({"document": original, "revision":9_007_199_254_740_992_u64}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(original, fixture());
}

#[tokio::test]
async fn raw_source_is_unchanged_and_unrelated_replaced_documents_are_not_accepted() {
    let (app, cookie) = authorized().await;
    let mut document = fixture();
    let source = "\r\n% manual source\n\\end{document}\r\n";
    document["content"] = json!({"mode":"raw", "source":source});
    let response = app
        .clone()
        .oneshot(request(
            "/api/render",
            &cookie,
            json!({"document":document, "revision":3}),
        ))
        .await
        .unwrap();
    assert_eq!(body(response).await["source"], source);
    let mut invalid = fixture();
    invalid["replacedDocument"] = fixture();
    let response = app
        .oneshot(request(
            "/api/documents/validate",
            &cookie,
            json!({"document":invalid, "revision":3}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn oversized_input_is_rejected_before_document_processing() {
    let (app, cookie) = authorized().await;
    let response = app
        .oneshot(request(
            "/api/render",
            &cookie,
            json!({"document": "x".repeat(1_048_576), "revision":1}),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}
