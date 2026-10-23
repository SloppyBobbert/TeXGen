use texgen::{
    compiler::{MAX_DIAGNOSTIC_BYTES, MAX_JOB_BYTES, MAX_PDF_BYTES, scratch_bytes},
    document::{Block, Content, Document, PlainText},
    render,
};

#[test]
fn expanded_plain_text_fits_the_job_budget_without_content_loss() {
    let mut document: Document =
        serde_json::from_str(include_str!("fixtures/document.json")).unwrap();
    document.title = PlainText(String::new());
    document.content = Content::Structured {
        blocks: (0..5)
            .map(|index| Block::Text {
                id: format!("dense-{index}"),
                // Carets use the renderer's longest plain-text escape.
                text: PlainText("^".repeat(if index < 4 { 200_000 } else { 190_000 })),
            })
            .collect(),
    };
    document.validate().unwrap();
    let original = document.clone();
    let source = render::tex(&document).unwrap();
    assert_eq!(document, original);
    assert_eq!(source.matches("\\textasciicircum{}").count(), 990_000);
    let scratch = scratch_bytes(source.len()).unwrap();
    assert!(source.len() + MAX_PDF_BYTES + MAX_DIAGNOSTIC_BYTES + scratch <= MAX_JOB_BYTES);
}
