use std::collections::HashSet;

use serde::{Deserialize, Serialize};

pub const VERSION: u16 = 1;
pub const MAX_DOCUMENT_BYTES: usize = 1_000_000;
pub const MAX_BLOCKS: usize = 1024;
pub const MAX_LATEX_BYTES: usize = 500_000;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PlainText(pub String);

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Latex(pub String);

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Document {
    pub version: u16,
    pub id: String,
    pub title: PlainText,
    pub page_allowance: u16,
    pub layout: Layout,
    pub content: Content,
    pub mode_recovery: Option<ModeRecovery>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Layout {
    pub paper: Paper,
    pub columns: u8,
    pub margins_mm: f64,
    pub font_pt: f64,
    pub spacing_pt: f64,
    pub column_gap_mm: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Paper {
    A4,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase", deny_unknown_fields)]
pub enum Content {
    Structured { blocks: Vec<Block> },
    Raw { source: Latex },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModeRecovery {
    pub layout: Layout,
    pub content: Content,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Block {
    Formula(FormulaBlock),
    Text { id: String, text: PlainText },
    Math { id: String, latex: Latex },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FormulaBlock {
    pub id: String,
    pub catalog_id: String,
    pub topic_id: String,
    pub topic_label: PlainText,
    pub label: PlainText,
    pub body: FormulaBody,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum FormulaBody {
    Math { latex: Latex },
    Fragment { latex: Latex },
}

impl Document {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != VERSION {
            return Err("This document version is not supported.".into());
        }
        if !valid_id(&self.id) {
            return Err("The document ID is invalid.".into());
        }
        validate_label(&self.title)?;
        if self.page_allowance == 0 {
            return Err("Select a positive page allowance for the document.".into());
        }
        self.layout.validate()?;
        self.content.validate()?;
        if let Some(recovery) = &self.mode_recovery {
            recovery.layout.validate()?;
            recovery.content.validate()?;
        }
        let bytes = serde_json::to_vec(self).map_err(|_| "The document is not valid JSON.")?;
        if bytes.len() > MAX_DOCUMENT_BYTES {
            return Err("The document and its mode recovery exceed 1,000,000 JSON bytes.".into());
        }
        Ok(())
    }
}

impl Layout {
    pub fn validate(&self) -> Result<(), String> {
        if !(1..=10).contains(&self.columns) {
            return Err("The column count must be an integer from 1 through 10.".into());
        }
        for number in [
            self.margins_mm,
            self.font_pt,
            self.spacing_pt,
            self.column_gap_mm,
        ] {
            if !number.is_finite()
                || number < 0.0
                || format!("{number:.3}").parse::<f64>().ok() != Some(number)
            {
                return Err("Layout values must be finite, nonnegative numbers with at most three decimal places.".into());
            }
        }
        if self.font_pt <= 0.0 || self.font_pt > 72.0 || self.spacing_pt > 72.0 {
            return Err(
                "The font size must be positive and at most 72 pt. Spacing must not exceed 72 pt."
                    .into(),
            );
        }
        if self.column_gap_mm > 210.0 {
            return Err("The column gap cannot exceed the A4 paper width.".into());
        }
        let usable_width =
            210.0 - 2.0 * self.margins_mm - f64::from(self.columns - 1) * self.column_gap_mm;
        if self.margins_mm >= 105.0 || usable_width <= 0.0 {
            return Err("Margins and column gaps leave no usable A4 column width.".into());
        }
        Ok(())
    }
}

impl Content {
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::Raw { source } => validate_latex(source, MAX_LATEX_BYTES),
            Self::Structured { blocks } => {
                if blocks.len() > MAX_BLOCKS {
                    return Err("A structured document cannot exceed 1,024 blocks.".into());
                }
                let mut ids = HashSet::new();
                for block in blocks {
                    if !valid_id(block.id()) || !ids.insert(block.id()) {
                        return Err(
                            "Block IDs must be valid and unique within their content copy.".into(),
                        );
                    }
                    match block {
                        Block::Formula(formula) => {
                            if !valid_id(&formula.catalog_id) || !valid_id(&formula.topic_id) {
                                return Err("Formula catalog and topic IDs are invalid.".into());
                            }
                            validate_label(&formula.topic_label)?;
                            validate_label(&formula.label)?;
                            formula.body.validate()?;
                        }
                        Block::Text { text, .. } => validate_text(text, 200_000, false)?,
                        Block::Math { latex, .. } => validate_latex(latex, 32_768)?,
                    }
                }
                Ok(())
            }
        }
    }
}

impl Block {
    pub fn id(&self) -> &str {
        match self {
            Self::Formula(formula) => &formula.id,
            Self::Text { id, .. } | Self::Math { id, .. } => id,
        }
    }
}

impl FormulaBody {
    pub fn latex(&self) -> &Latex {
        match self {
            Self::Math { latex } | Self::Fragment { latex } => latex,
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        validate_latex(self.latex(), 32_768)
    }
}

pub(crate) fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 96
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_.:".contains(&byte))
}

pub(crate) fn validate_label(text: &PlainText) -> Result<(), String> {
    validate_text(text, 512, true)
}

fn validate_text(text: &PlainText, max_bytes: usize, single_line: bool) -> Result<(), String> {
    if text.0.len() > max_bytes
        || text.0.chars().any(|character| {
            character.is_control() && (single_line || !matches!(character, '\n' | '\r' | '\t'))
        })
    {
        return Err(
            "Plain text exceeds its size limit or contains unsupported control characters.".into(),
        );
    }
    Ok(())
}

fn validate_latex(source: &Latex, max_bytes: usize) -> Result<(), String> {
    if source.0.len() > max_bytes || source.0.contains('\0') {
        return Err("LaTeX exceeds its size limit or contains a null character.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    pub fn fixture() -> Document {
        serde_json::from_str(include_str!("../tests/fixtures/document.json")).unwrap()
    }

    #[test]
    fn document_and_mode_recovery_round_trip() {
        let document = fixture();
        document.validate().unwrap();
        let encoded = serde_json::to_string(&document).unwrap();
        let restored: Document = serde_json::from_str(&encoded).unwrap();
        assert_eq!(document, restored);
        assert!(restored.mode_recovery.is_some());
    }

    #[test]
    fn invalid_document_shapes_and_unknown_versions_fail() {
        let original: Value =
            serde_json::from_str(include_str!("../tests/fixtures/document.json")).unwrap();
        for (field, value) in [
            ("version", json!(2)),
            ("pageAllowance", json!(0)),
            ("id", json!("bad/id")),
        ] {
            let mut changed = original.clone();
            changed[field] = value;
            let parsed: Document = serde_json::from_value(changed).unwrap();
            assert!(parsed.validate().is_err(), "{field}");
        }
        let mut changed = original.clone();
        changed["generatedSource"] = json!("second owner");
        assert!(serde_json::from_value::<Document>(changed).is_err());
        let mut changed = original;
        changed["layout"]["paper"] = json!("Letter");
        assert!(serde_json::from_value::<Document>(changed).is_err());
    }

    #[test]
    fn duplicate_ids_and_invalid_recovery_fail_without_modifying_the_document() {
        let original = fixture();
        let mut changed = original.clone();
        if let Content::Structured { blocks } = &mut changed.content {
            blocks.push(blocks[0].clone());
        }
        assert!(changed.validate().is_err());
        assert_eq!(original, fixture());
        let mut changed = original;
        changed.mode_recovery.as_mut().unwrap().layout.columns = 0;
        assert!(changed.validate().is_err());
    }

    #[test]
    fn layout_checks_geometry_and_numeric_precision_not_print_readability() {
        let base = fixture().layout;
        for (font, margins, gap) in [
            (0.0, 5.0, 3.0),
            (9.0, 105.0, 3.0),
            (9.0, 5.0, 210.0),
            (f64::NAN, 5.0, 3.0),
            (9.0001, 5.0, 3.0),
        ] {
            let mut layout = base.clone();
            layout.font_pt = font;
            layout.margins_mm = margins;
            layout.column_gap_mm = gap;
            assert!(layout.validate().is_err());
        }
        let mut layout = base;
        layout.font_pt = 0.001;
        layout.validate().unwrap();
    }

    #[test]
    fn single_column_gap_is_bounded_even_when_it_is_not_used() {
        let mut layout = fixture().layout;
        layout.columns = 1;
        layout.column_gap_mm = 211.0;
        assert!(layout.validate().is_err());
    }
}
