use std::{collections::HashSet, sync::OnceLock};

use serde::{Deserialize, Serialize};

use crate::document::{FormulaBody, PlainText, valid_id, validate_label};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub version: u16,
    pub subjects: Vec<Subject>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Subject {
    pub id: String,
    pub label: PlainText,
    pub categories: Vec<Category>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Category {
    pub id: String,
    pub label: PlainText,
    pub formulas: Vec<Formula>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Formula {
    pub id: String,
    pub label: PlainText,
    pub body: FormulaBody,
}

static CATALOG: OnceLock<Catalog> = OnceLock::new();

pub fn bundled() -> &'static Catalog {
    CATALOG.get_or_init(|| {
        load(include_str!("../data/catalog.json"))
            .expect("The bundled catalog must pass the catalog verification tests.")
    })
}

pub fn load(source: &str) -> Result<Catalog, String> {
    let catalog: Catalog = serde_json::from_str(source)
        .map_err(|error| format!("The catalog JSON is invalid: {error}"))?;
    if catalog.version != 1 || catalog.subjects.is_empty() {
        return Err("The catalog version or subject list is invalid.".into());
    }
    let mut ids = HashSet::new();
    for subject in &catalog.subjects {
        insert_identity(&mut ids, &subject.id, &subject.label)?;
        if subject.categories.is_empty() {
            return Err("A catalog subject must contain a category.".into());
        }
        for category in &subject.categories {
            insert_identity(&mut ids, &category.id, &category.label)?;
            if category.formulas.is_empty() {
                return Err("A catalog category must contain a formula.".into());
            }
            for formula in &category.formulas {
                insert_identity(&mut ids, &formula.id, &formula.label)?;
                formula.body.validate()?;
                if formula.body.latex().0.is_empty() {
                    return Err("A catalog formula cannot have empty content.".into());
                }
            }
        }
    }
    Ok(catalog)
}

fn insert_identity<'a>(
    ids: &mut HashSet<&'a str>,
    id: &'a str,
    label: &PlainText,
) -> Result<(), String> {
    if !valid_id(id) || !ids.insert(id) || label.0.is_empty() {
        return Err("Catalog IDs must be valid and unique. Labels must not be empty.".into());
    }
    validate_label(label)
}
