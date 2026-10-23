use std::fmt::Write;

use crate::document::{Block, Content, Document, FormulaBody, Latex, PlainText};

pub fn tex(document: &Document) -> Result<String, String> {
    document.validate()?;
    let blocks = match &document.content {
        Content::Raw { source } => return Ok(source.0.clone()),
        Content::Structured { blocks } => blocks,
    };
    let layout = &document.layout;
    let mut output = format!(
        "% TeXGen document {}\n\\documentclass[a4paper]{{article}}\n\\usepackage[T1]{{fontenc}}\n\\usepackage{{lmodern}}\n\\usepackage{{amsmath,amssymb}}\n\\usepackage[a4paper,margin={}mm]{{geometry}}\n\\usepackage{{multicol}}\n\\setlength{{\\columnsep}}{{{}mm}}\n\\setlength{{\\parindent}}{{0pt}}\n\\setlength{{\\parskip}}{{0pt}}\n\\pagestyle{{empty}}\n\\begin{{document}}\n\\fontsize{{{}pt}}{{{}pt}}\\selectfont\n\\setlength{{\\abovedisplayskip}}{{0pt}}\n\\setlength{{\\belowdisplayskip}}{{0pt}}\n\\setlength{{\\abovedisplayshortskip}}{{0pt}}\n\\setlength{{\\belowdisplayshortskip}}{{0pt}}\n",
        document.id,
        dimension(layout.margins_mm),
        dimension(layout.column_gap_mm),
        dimension(layout.font_pt),
        dimension(layout.font_pt * 1.15 + layout.spacing_pt),
    );
    writeln!(
        output,
        "\\setlength{{\\jot}}{{{}pt}}",
        dimension(layout.spacing_pt)
    )
    .unwrap();
    if !document.title.0.is_empty() {
        writeln!(output, "\\textbf{{{}}}\\par", escape(&document.title)).unwrap();
    }
    if layout.columns > 1 {
        writeln!(
            output,
            "\\begin{{multicols}}{{{}}}\n\\raggedcolumns",
            layout.columns
        )
        .unwrap();
    }
    if blocks.is_empty() && document.title.0.is_empty() {
        output.push_str("\\null\n");
    }
    let mut previous_topic = None;
    for block in blocks {
        writeln!(output, "% Block {}", block.id()).unwrap();
        match block {
            Block::Formula(formula) => {
                start_block(&mut output);
                let topic = (formula.topic_id.as_str(), formula.topic_label.0.as_str());
                if let FormulaBody::Math { latex } = &formula.body {
                    if previous_topic != Some(topic) {
                        writeln!(output, "\\textbf{{{}}}\\par", escape(&formula.topic_label))
                            .unwrap();
                    }
                    writeln!(output, "{}\\par", escape(&formula.label)).unwrap();
                    math(&mut output, latex);
                } else {
                    writeln!(output, "{}", formula.body.latex().0).unwrap();
                }
                previous_topic = Some(topic);
                end_block(&mut output, layout.spacing_pt);
            }
            Block::Math { latex, .. } => {
                start_block(&mut output);
                math(&mut output, latex);
                end_block(&mut output, layout.spacing_pt);
            }
            Block::Text { text, .. } => {
                writeln!(output, "{}\\par", escape(text)).unwrap();
            }
        }
    }
    if layout.columns > 1 {
        output.push_str("\\end{multicols}\n");
    }
    output.push_str("\\end{document}\n");
    Ok(output)
}

fn start_block(output: &mut String) {
    output.push_str("\\noindent\\begin{minipage}{\\linewidth}\n");
}

fn end_block(output: &mut String, spacing: f64) {
    writeln!(
        output,
        "\\end{{minipage}}\\par\\vspace{{{}pt}}",
        dimension(spacing)
    )
    .unwrap();
}

fn math(output: &mut String, source: &Latex) {
    writeln!(
        output,
        "\\[\\begin{{gathered}}\n{}\n\\end{{gathered}}\\]",
        source.0
    )
    .unwrap();
}

fn dimension(value: f64) -> String {
    if value == 0.0 {
        return "0".into();
    }
    format!("{value:.3}")
        .trim_end_matches('0')
        .trim_end_matches('.')
        .into()
}

fn escape(text: &PlainText) -> String {
    let normalized = text.0.replace("\r\n", "\n").replace('\r', "\n");
    let mut output = String::new();
    for character in normalized.chars() {
        output.push_str(match character {
            '\\' => "\\textbackslash{}",
            '{' => "\\{",
            '}' => "\\}",
            '$' => "\\$",
            '&' => "\\&",
            '%' => "\\%",
            '#' => "\\#",
            '_' => "\\_",
            '^' => "\\textasciicircum{}",
            '~' => "\\textasciitilde{}",
            '\n' => "\\par\n",
            '\t' => " ",
            _ => {
                output.push(character);
                continue;
            }
        });
    }
    output
}
