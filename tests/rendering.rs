use texgen::{
    catalog,
    document::{Block, Content, Document, FormulaBlock, FormulaBody, Latex, PlainText},
    render,
};

fn fixture() -> Document {
    serde_json::from_str(include_str!("fixtures/document.json")).unwrap()
}

#[test]
fn structured_tex_is_deterministic_and_matches_the_reviewed_golden() {
    let document = fixture();
    let first = render::tex(&document).unwrap();
    assert_eq!(first, render::tex(&document).unwrap());
    assert_eq!(first, include_str!("fixtures/document.tex"));
    assert!(!first.contains("RECOVERY_ONLY_MARKER"));
    assert!(!first.contains("adjustbox"));
    assert!(!first.contains("resizebox"));
}

#[test]
fn plain_text_is_escaped_but_manual_equation_breaks_remain_raw() {
    let source = render::tex(&fixture()).unwrap();
    assert!(source.contains(r"Calculus \& algebra\_100\% \#1 \$ \{x\}"));
    assert!(source.contains("x=1\\\\\nx=2"));
    assert!(source.contains(r"\int_0^1 x^2\,dx=\frac{1}{3}"));
    assert!(source.contains(r"\$x\$"));
    assert!(source.contains(r"\textbackslash{}"));
}

#[test]
fn duplicate_labels_are_not_identifiers_and_block_order_is_preserved() {
    let mut document = fixture();
    let Content::Structured { blocks } = &mut document.content else {
        panic!("fixture")
    };
    blocks.remove(0);
    blocks.swap(0, 1);
    let source = render::tex(&document).unwrap();
    assert!(!source.contains("% Block first-formula"));
    assert!(source.contains("Keep my notes"));
    assert!(source.contains("% Block manual-math"));
    assert!(
        source.find("% Block second-formula").unwrap()
            < source.find("% Block manual-notes").unwrap()
    );
    assert!(
        source.find("% Block manual-notes").unwrap() < source.find("% Block manual-math").unwrap()
    );
}

#[test]
fn every_formula_is_a_complete_unsplit_block_without_reordering_topics() {
    let source = render::tex(&fixture()).unwrap();
    assert_eq!(source.matches("\\begin{minipage}{\\linewidth}").count(), 3);
    assert_eq!(source.matches("\\end{minipage}").count(), 3);
    assert_eq!(
        source
            .matches("\\textbf{ALGEBRA I: Linear Equations}")
            .count(),
        1
    );
    assert!(source.contains("\\begin{multicols}{2}"));
}

#[test]
fn raw_mode_is_byte_exact_and_recovery_is_never_rendered() {
    let mut document = fixture();
    let raw = "\r\n% manual wrapper\n\\documentclass{article}\n\\begin{document}\n\\smash{x}\n\\end{document}\r\n";
    document.content = Content::Raw {
        source: Latex(raw.into()),
    };
    assert_eq!(render::tex(&document).unwrap().as_bytes(), raw.as_bytes());
}

#[test]
fn unit_circle_fragment_is_preserved_and_local_changes_do_not_mutate_the_catalog() {
    let source = catalog::bundled();
    assert_eq!(source.subjects.len(), 14);
    assert_eq!(
        source
            .subjects
            .iter()
            .map(|subject| subject.categories.len())
            .sum::<usize>(),
        76
    );
    assert_eq!(
        source
            .subjects
            .iter()
            .flat_map(|subject| &subject.categories)
            .map(|category| category.formulas.len())
            .sum::<usize>(),
        385
    );
    let subject = source
        .subjects
        .iter()
        .find(|subject| subject.id == "subject-unit-circle")
        .unwrap();
    let category = &subject.categories[0];
    let formula = &category.formulas[0];
    assert!(matches!(formula.body, FormulaBody::Fragment { .. }));
    let original_latex = formula.body.latex().0.clone();
    let mut document = fixture();
    document.layout.columns = 1;
    document.content = Content::Structured {
        blocks: vec![Block::Formula(FormulaBlock {
            id: "local-unit-circle".into(),
            catalog_id: formula.id.clone(),
            topic_id: category.id.clone(),
            topic_label: subject.label.clone(),
            label: formula.label.clone(),
            body: formula.body.clone(),
        })],
    };
    let tex = render::tex(&document).unwrap();
    assert!(tex.contains(&original_latex));
    assert!(!tex.contains("\\begin{multicols}"));
    if let Content::Structured { blocks } = &mut document.content {
        let Block::Formula(local) = &mut blocks[0] else {
            panic!("fixture")
        };
        local.label = PlainText("Local label".into());
        local.body = FormulaBody::Fragment {
            latex: Latex("manual fragment".into()),
        };
        assert_eq!(local.catalog_id, formula.id);
    }
    assert_eq!(formula.body.latex().0, original_latex);
    assert!(render::tex(&document).unwrap().contains("manual fragment"));
}

#[test]
fn duplicate_catalog_ids_are_rejected() {
    let mut value: serde_json::Value =
        serde_json::from_str(include_str!("../data/catalog.json")).unwrap();
    let id = value["subjects"][0]["id"].clone();
    value["subjects"][0]["categories"][0]["id"] = id;
    assert!(catalog::load(&value.to_string()).is_err());
}

#[test]
fn page_allowance_never_changes_or_truncates_source() {
    let mut document = fixture();
    document.page_allowance = 1;
    let one_page_target = render::tex(&document).unwrap();
    document.page_allowance = 99;
    assert_eq!(one_page_target, render::tex(&document).unwrap());
}

#[test]
fn saved_formulas_render_without_a_current_catalog_entry() {
    let mut document = fixture();
    let Content::Structured { blocks } = &mut document.content else {
        panic!("fixture")
    };
    let Block::Formula(formula) = &mut blocks[0] else {
        panic!("fixture")
    };
    formula.catalog_id = "retired-catalog-entry".into();
    assert_eq!(
        render::tex(&document).unwrap(),
        include_str!("fixtures/document.tex")
    );
}

#[test]
fn a_local_topic_label_change_is_preserved_without_changing_its_identity() {
    let mut document = fixture();
    let Content::Structured { blocks } = &mut document.content else {
        panic!("fixture")
    };
    let Block::Formula(formula) = &mut blocks[2] else {
        panic!("fixture")
    };
    let original_id = formula.topic_id.clone();
    formula.topic_label = PlainText("Local topic heading".into());
    assert_eq!(formula.topic_id, original_id);
    let source = render::tex(&document).unwrap();
    assert!(source.contains("Local topic heading"));
    assert!(source.contains("ALGEBRA I: Linear Equations"));
}

#[test]
fn invalid_layout_cannot_produce_a_successful_tex_render() {
    let mut document = fixture();
    document.layout.columns = 0;
    assert!(render::tex(&document).is_err());
}
