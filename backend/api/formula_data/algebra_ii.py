"""
ALGEBRA II formulas
"""

CLASS_NAME = "ALGEBRA II"

FORMULAS = {
    "Complex Numbers": [
        { "id": "algebra-ii.imaginary-unit","name": "Imaginary Unit", "latex": r"i=\sqrt{-1} \quad\quad i^2=-1"},
        { "id": "algebra-ii.addition","name": "Addition", "latex": r"(a+bi)+(c+di)=(a+c)+(b+d)i"},
        { "id": "algebra-ii.multiplication","name": "Multiplication", "latex": r"(a+bi)(c+di)=(ac-bd)+(ad+bc)i"},
        { "id": "algebra-ii.magnitude","name": "Magnitude", "latex": r"|a+bi|=\sqrt{a^2+b^2}"},
    ],
    "Logarithms": [
        { "id": "algebra-ii.definition","name": "Definition", "latex": r"\log_b(a)=c \iff b^c=a"},
        { "id": "algebra-ii.product-rule","name": "Product Rule", "latex": r"\log_b(xy)=\log_b(x)+\log_b(y)"},
        { "id": "algebra-ii.quotient-rule","name": "Quotient Rule", "latex": r"\log_b\!\left(\frac{x}{y}\right)=\log_b(x)-\log_b(y)"},
        { "id": "algebra-ii.power-rule","name": "Power Rule", "latex": r"\log_b(x^n)=n\log_b(x)"},
        { "id": "algebra-ii.change-of-base","name": "Change of Base", "latex": r"\log_b(a)=\frac{\ln(a)}{\ln(b)}"},
        { "id": "algebra-ii.special-values","name": "Special Values", "latex": r"\log_b(1)=0 \quad\quad \log_b(b)=1"},
    ],
    "Exponential Functions": [
        { "id": "algebra-ii.basic-form","name": "Basic Form", "latex": r"y=ab^x"},
        { "id": "algebra-ii.compound-interest","name": "Compound Interest", "latex": r"A=P\!\left(1+\frac{r}{n}\right)^{nt}"},
        { "id": "algebra-ii.continuous-growth","name": "Continuous Growth", "latex": r"A=Pe^{rt}"},
        { "id": "algebra-ii.growth-decay","name": "Growth/Decay", "latex": r"y=ae^{kx} \quad (k>0 \text{ growth}, \; k<0 \text{ decay})"},
    ],
    "Polynomial Theorems and Binomial Expansion": [
        { "id": "algebra-ii.remainder-theorem","name": "Remainder Theorem", "latex": r"\text{Remainder Thm: } f(a)=\text{remainder of } f(x)\div(x-a)"},
        { "id": "algebra-ii.factor-theorem","name": "Factor Theorem", "latex": r"\text{Factor Thm: } f(a)=0 \implies (x-a) \text{ is a factor}"},
        { "id": "algebra-ii.rational-root-theorem","name": "Rational Root Theorem", "latex": r"\text{Rational Root Thm: } \frac{p}{q}, \; p\mid a_0, \; q\mid a_n"},
        { "id": "algebra-ii.descartes-rule","name": "Descartes' Rule", "latex": r"\text{Descartes' Rule: sign changes} \to \text{positive roots}"},
        { "id": "algebra-ii.fundamental-theorem","name": "Fundamental Theorem", "latex": r"\text{Degree } n \text{ polynomial has at most } n \text{ roots}"},
        { "id": "algebra-ii.expansion","name": "Expansion", "latex": r"(a+b)^n=\sum_{k=0}^{n}\binom{n}{k}a^{n-k}b^k"},
        { "id": "algebra-ii.binomial-coefficient","name": "Binomial Coefficient", "latex": r"\binom{n}{k}=\frac{n!}{k!(n-k)!}"},
        { "id": "algebra-ii.factorial","name": "Factorial", "latex": r"n!=n(n-1)(n-2)\cdots(2)(1) \quad\quad 0!=1"},
    ],
    "Conic Sections": [
        { "id": "algebra-ii.circle","name": "Circle", "latex": r"(x-h)^2+(y-k)^2=r^2"},
        { "id": "algebra-ii.ellipse","name": "Ellipse", "latex": r"\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1"},
        { "id": "algebra-ii.hyperbola","name": "Hyperbola", "latex": r"\frac{(x-h)^2}{a^2}-\frac{(y-k)^2}{b^2}=1"},
        { "id": "algebra-ii.parabola","name": "Parabola", "latex": r"y=a(x-h)^2+k"},
        { "id": "algebra-ii.focal-distance","name": "Focal Distance", "latex": r"c^2=a^2-b^2 \;\text{(Ellipse)} \quad c^2=a^2+b^2 \;\text{(Hyperbola)}"},
    ],
    "Sequences and Series": [
        { "id": "algebra-ii.arithmetic-sequence","name": "Arithmetic Sequence", "latex": r"a_n=a_1+(n-1)d"},
        { "id": "algebra-ii.arithmetic-sum","name": "Arithmetic Sum", "latex": r"S_n=\frac{n}{2}(a_1+a_n)"},
        { "id": "algebra-ii.geometric-sequence","name": "Geometric Sequence", "latex": r"a_n=a_1 r^{n-1}"},
        { "id": "algebra-ii.geometric-sum","name": "Geometric Sum", "latex": r"S_n=a_1\frac{1-r^n}{1-r}"},
        { "id": "algebra-ii.infinite-geometric-sum","name": "Infinite Geometric Sum", "latex": r"S_\infty=\frac{a_1}{1-r} \quad |r|<1"},
    ],
    "Matrices": [
        { "id": "algebra-ii.2x2-inverse","name": "2x2 Inverse", "latex": r"\begin{bmatrix}a&b\\c&d\end{bmatrix}^{-1}=\frac{1}{ad-bc}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}"},
        { "id": "algebra-ii.determinant","name": "Determinant", "latex": r"\det\begin{bmatrix}a&b\\c&d\end{bmatrix}=ad-bc"},
        { "id": "algebra-ii.identity-property","name": "Identity Property", "latex": r"A\cdot A^{-1}=I"},
    ],
}
