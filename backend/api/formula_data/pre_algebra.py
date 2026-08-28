"""
PRE-ALGEBRA formulas
"""

CLASS_NAME = "PRE-ALGEBRA"

FORMULAS = {
    "Operations and Properties": [
        { "id": "pre-algebra.pemdas-definition","name": "PEMDAS Definition", "latex": r"\text{Parentheses} \to \text{Exponents} \to \text{Multiply/Divide} \to \text{Add/Subtract}"},
        { "id": "pre-algebra.commutative","name": "Commutative", "latex": r"a+b=b+a"},
        { "id": "pre-algebra.associative","name": "Associative", "latex": r"(a+b)+c=a+(b+c)"},
        { "id": "pre-algebra.distributive","name": "Distributive", "latex": r"a(b+c)=ab+ac"},
        { "id": "pre-algebra.identity","name": "Identity", "latex": r"a+0=a"},
        { "id": "pre-algebra.inverse","name": "Inverse", "latex": r"a+(-a)=0"},
    ],
    "Fractions, Ratios, and Proportions": [
        { "id": "pre-algebra.addition","name": "Addition", "latex": r"\frac{a}{b}+\frac{c}{d}=\frac{ad+bc}{bd}"},
        { "id": "pre-algebra.subtraction","name": "Subtraction", "latex": r"\frac{a}{b}-\frac{c}{d}=\frac{ad-bc}{bd}"},
        { "id": "pre-algebra.multiplication","name": "Multiplication", "latex": r"\frac{a}{b}\cdot\frac{c}{d}=\frac{ac}{bd}"},
        { "id": "pre-algebra.division","name": "Division", "latex": r"\frac{a}{b}\div\frac{c}{d}=\frac{a}{b}\cdot\frac{d}{c}=\frac{ad}{bc}"},
        { "id": "pre-algebra.proportion","name": "Proportion", "latex": r"\frac{a}{b}=\frac{c}{d}\implies ad=bc"},
        { "id": "pre-algebra.unit-rate","name": "Unit Rate", "latex": r"\text{Unit Rate}=\frac{\text{Total}}{\text{Number of Units}}"},
    ],
    "Area and Perimeter": [
        { "id": "pre-algebra.rectangle-area-perimeter","name": "Rectangle Area/Perimeter", "latex": r"A_{\text{rect}}=lw \quad\quad P_{\text{rect}}=2l+2w"},
        { "id": "pre-algebra.triangle-area","name": "Triangle Area", "latex": r"A_{\text{tri}}=\frac{1}{2}bh"},
        { "id": "pre-algebra.circle-area-circumference","name": "Circle Area/Circumference", "latex": r"A_{\text{circle}}=\pi r^2 \quad\quad C=2\pi r"},
        { "id": "pre-algebra.rectangular-prism-volume","name": "Rectangular Prism Volume", "latex": r"V_{\text{rect prism}}=lwh"},
    ],
    "Solving Equations": [
        { "id": "pre-algebra.linear-solution","name": "Linear Solution", "latex": r"ax+b=c \implies x=\frac{c-b}{a}"},
        { "id": "pre-algebra.absolute-value","name": "Absolute Value", "latex": r"|x|=a \implies x=a \text{ or } x=-a"},
        { "id": "pre-algebra.transitive-property","name": "Transitive Property", "latex": r"\text{If } a=b \text{ and } b=c, \text{ then } a=c"},
    ],
}
