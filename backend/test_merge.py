import re

# Old content body would be extracted as everything between \begin{document} and \end{document}
old_body = r"""
\begin{multicols}{4}
\raggedcolumns
\section*{ALGEBRA I}

\subsection*{Linear Equations}

\begin{flushleft}
\textbf{Slope}
\[ \adjustbox{max width=\linewidth}{$m = \frac{a}{b}$} \]
\\[0pt]
\end{flushleft}\end{multicols}
"""

# New header from API (with 3 columns, tiny spacing)
new_latex = r"""\documentclass[10pt,fleqn]{article}
\usepackage[margin=0.25in]{geometry}
\usepackage{amsmath, amssymb}
\usepackage{enumitem}
\usepackage{multicol}
\usepackage{titlesec}
\usepackage{adjustbox}

\titleformat{\section}{\normalfont\footnotesize\bfseries}{}{0pt}{}
\titleformat{\subsection}{\normalfont\scriptsize\bfseries}{}{0pt}{}
\titlespacing*{\section}{0pt}{0pt}{0pt}
\titlespacing*{\subsection}{0pt}{0pt}{0pt}
\setlength{\baselineskip}{4pt}

\begin{document}
\scriptsize
\begin{multicols}{3}
\raggedcolumns
\end{multicols}
\end{document}"""

# Frontend merge: newHeader + \begin{document} + oldBody
new_header = new_latex.split(r'\begin{document}')[0]
merged = new_header + r'\begin{document}' + old_body

# Add \end{document} if missing
if r'\end{document}' not in merged:
    merged = merged + r'\end{document}'

print("=== MERGED OUTPUT (first 1000 chars) ===")
print(merged[:1000])
print()
print("=== KEY CHECKS ===")
print("Has multicols{3}:", r'multicols{3}' in merged)
print("Has multicols{4}:", r'multicols{4}' in merged)
print("Has baselineskip 4pt:", r'baselineskip}{4pt' in merged)