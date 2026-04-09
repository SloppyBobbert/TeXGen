import re

content = r"""\documentclass[10pt,fleqn]{article}
\usepackage[margin=0.25in]{geometry}
\begin{document}
\begin{multicols}{4}
\section*{ALGEBRA I}
\end{multicols}
\end{document}"""

# JS regex: /\\begin\{document\}([\s\S]*)\\end\{document\}/
# In JS, \\ in string becomes \ in the actual regex
pattern = r"\\begin\{document\}([\s\S]*)\\end\{document\}"
match = re.search(pattern, content)

print("Pattern:", repr(pattern))
print("Match found:", match is not None)
if match:
    print("Body:", match.group(1)[:100])