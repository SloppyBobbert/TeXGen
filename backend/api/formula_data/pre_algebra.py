"""
PRE-ALGEBRA formulas
"""

CLASS_NAME = "PRE-ALGEBRA"

FORMULAS = {
    "Order of Operations (PEMDAS)": [
        {"name": "PEMDAS Definition", "latex": r"\text{Parentheses} \to \text{Exponents} \to \text{Multiply/Divide} \to \text{Add/Subtract}"},
    ],
    "Fractions": [
        {"name": "Addition", "latex": r"\frac{a}{b}+\frac{c}{d}=\frac{ad+bc}{bd}"},
        {"name": "Subtraction", "latex": r"\frac{a}{b}-\frac{c}{d}=\frac{ad-bc}{bd}"},
        {"name": "Multiplication", "latex": r"\frac{a}{b}\cdot\frac{c}{d}=\frac{ac}{bd}"},
        {"name": "Division", "latex": r"\frac{a}{b}\div\frac{c}{d}=\frac{a}{b}\cdot\frac{d}{c}=\frac{ad}{bc}"},
    ],
    "Ratios and Proportions": [
        {"name": "Proportion", "latex": r"\frac{a}{b}=\frac{c}{d}\implies ad=bc"},
        {"name": "Unit Rate", "latex": r"\text{Unit Rate}=\frac{\text{Total}}{\text{Number of Units}}"},
    ],
    "Properties of Numbers": [
        {"name": "Commutative", "latex": r"a+b=b+a"},
        {"name": "Associative", "latex": r"(a+b)+c=a+(b+c)"},
        {"name": "Distributive", "latex": r"a(b+c)=ab+ac"},
        {"name": "Identity", "latex": r"a+0=a"},
        {"name": "Inverse", "latex": r"a+(-a)=0"},
    ],
    "Area and Perimeter": [
        {"name": "Rectangle Area/Perimeter", "latex": r"A_{\text{rect}}=lw \quad\quad P_{\text{rect}}=2l+2w"},
        {"name": "Triangle Area", "latex": r"A_{\text{tri}}=\frac{1}{2}bh"},
        {"name": "Circle Area/Circumference", "latex": r"A_{\text{circle}}=\pi r^2 \quad\quad C=2\pi r"},
        {"name": "Rectangular Prism Volume", "latex": r"V_{\text{rect prism}}=lwh"},
    ],
    "Solving Equations": [
        {"name": "Linear Solution", "latex": r"ax+b=c \implies x=\frac{c-b}{a}"},
        {"name": "Absolute Value", "latex": r"|x|=a \implies x=a \text{ or } x=-a"},
        {"name": "Transitive Property", "latex": r"\text{If } a=b \text{ and } b=c, \text{ then } a=c"},
    ],
}
