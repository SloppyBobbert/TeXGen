"""
ALGEBRA II formulas
"""

CLASS_NAME = "ALGEBRA II"

FORMULAS = {
    "Complex Numbers": [
        {"name": "Imaginary Unit", "latex": r"i=\sqrt{-1} \quad\quad i^2=-1"},
        {"name": "Addition", "latex": r"(a+bi)+(c+di)=(a+c)+(b+d)i"},
        {"name": "Multiplication", "latex": r"(a+bi)(c+di)=(ac-bd)+(ad+bc)i"},
        {"name": "Magnitude", "latex": r"|a+bi|=\sqrt{a^2+b^2}"},
    ],
    "Logarithms": [
        {"name": "Definition", "latex": r"\log_b(a)=c \iff b^c=a"},
        {"name": "Product Rule", "latex": r"\log_b(xy)=\log_b(x)+\log_b(y)"},
        {"name": "Quotient Rule", "latex": r"\log_b\!\left(\frac{x}{y}\right)=\log_b(x)-\log_b(y)"},
        {"name": "Power Rule", "latex": r"\log_b(x^n)=n\log_b(x)"},
        {"name": "Change of Base", "latex": r"\log_b(a)=\frac{\ln(a)}{\ln(b)}"},
        {"name": "Special Values", "latex": r"\log_b(1)=0 \quad\quad \log_b(b)=1"},
    ],
    "Exponential Functions": [
        {"name": "Basic Form", "latex": r"y=ab^x"},
        {"name": "Compound Interest", "latex": r"A=P\!\left(1+\frac{r}{n}\right)^{nt}"},
        {"name": "Continuous Growth", "latex": r"A=Pe^{rt}"},
        {"name": "Growth/Decay", "latex": r"y=ae^{kx} \quad (k>0 \text{ growth}, \; k<0 \text{ decay})"},
    ],
    "Polynomial Theorems": [
        {"name": "Remainder Theorem", "latex": r"\text{Remainder Thm: } f(a)=\text{remainder of } f(x)\div(x-a)"},
        {"name": "Factor Theorem", "latex": r"\text{Factor Thm: } f(a)=0 \implies (x-a) \text{ is a factor}"},
        {"name": "Rational Root Theorem", "latex": r"\text{Rational Root Thm: } \frac{p}{q}, \; p\mid a_0, \; q\mid a_n"},
        {"name": "Descartes' Rule", "latex": r"\text{Descartes' Rule: sign changes} \to \text{positive roots}"},
        {"name": "Fundamental Theorem", "latex": r"\text{Degree } n \text{ polynomial has at most } n \text{ roots}"},
    ],
    "Conic Sections": [
        {"name": "Circle", "latex": r"(x-h)^2+(y-k)^2=r^2"},
        {"name": "Ellipse", "latex": r"\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1"},
        {"name": "Hyperbola", "latex": r"\frac{(x-h)^2}{a^2}-\frac{(y-k)^2}{b^2}=1"},
        {"name": "Parabola", "latex": r"y=a(x-h)^2+k"},
        {"name": "Focal Distance", "latex": r"c^2=a^2-b^2 \;\text{(Ellipse)} \quad c^2=a^2+b^2 \;\text{(Hyperbola)}"},
    ],
    "Sequences and Series": [
        {"name": "Arithmetic Sequence", "latex": r"a_n=a_1+(n-1)d"},
        {"name": "Arithmetic Sum", "latex": r"S_n=\frac{n}{2}(a_1+a_n)"},
        {"name": "Geometric Sequence", "latex": r"a_n=a_1 r^{n-1}"},
        {"name": "Geometric Sum", "latex": r"S_n=a_1\frac{1-r^n}{1-r}"},
        {"name": "Infinite Geometric Sum", "latex": r"S_\infty=\frac{a_1}{1-r} \quad |r|<1"},
    ],
    "Matrices": [
        {"name": "2x2 Inverse", "latex": r"\begin{bmatrix}a&b\\c&d\end{bmatrix}^{-1}=\frac{1}{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}"},
        {"name": "Determinant", "latex": r"\det\begin{bmatrix}a&b\\c&d\end{bmatrix}=ad-bc"},
        {"name": "Identity Property", "latex": r"A\cdot A^{-1}=I"},
    ],
    "Binomial Theorem": [
        {"name": "Expansion", "latex": r"(a+b)^n=\sum_{k=0}^{n}\binom{n}{k}a^{n-k}b^k"},
        {"name": "Binomial Coefficient", "latex": r"\binom{n}{k}=\frac{n!}{k!(n-k)!}"},
        {"name": "Factorial", "latex": r"n!=n(n-1)(n-2)\cdots(2)(1) \quad\quad 0!=1"},
    ],
}
