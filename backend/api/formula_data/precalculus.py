"""
PRECALCULUS formulas
"""

CLASS_NAME = "PRECALCULUS"

FORMULAS = {
    "Functions": [
        {"name": "Composition", "latex": r"(f\circ g)(x)=f(g(x))"},
        {"name": "Inverse Property", "latex": r"f^{-1}(f(x))=x,\ f(f^{-1}(x))=x"},
        {"name": "Finding Inverse", "latex": r"\text{Inverse: swap }x,y\text{ then solve for }y"},
    ],
    "Conic Sections": [
        {"name": "Circle", "latex": r"(x-h)^2+(y-k)^2=r^2"},
        {"name": "Ellipse", "latex": r"\frac{(x-h)^2}{a^2}+\frac{(y-k)^2}{b^2}=1"},
        {"name": "Parabola", "latex": r"(x-h)^2=4p(y-k)\text{ or }(y-k)^2=4p(x-h)"},
        {"name": "Hyperbola", "latex": r"\frac{(x-h)^2}{a^2}-\frac{(y-k)^2}{b^2}=1"},
        {"name": "Eccentricity", "latex": r"c^2=a^2+b^2\ (\text{hyperbola/ellipse}),\ e=\frac{c}{a}"},
    ],
    "Sequences, Series, and Binomial Theorem": [
        {"name": "Arithmetic Sequence", "latex": r"a_n=a_1+(n-1)d"},
        {"name": "Arithmetic Series", "latex": r"S_n=\tfrac{n}{2}(a_1+a_n)"},
        {"name": "Geometric Sequence", "latex": r"a_n=a_1r^{n-1}"},
        {"name": "Geometric Series", "latex": r"S_n=\frac{a_1(1-r^n)}{1-r}"},
        {"name": "Infinite Geometric Series", "latex": r"S_\infty=\frac{a_1}{1-r},\ |r|<1"},
        {"name": "Binomial Expansion", "latex": r"(a+b)^n=\sum_{k=0}^{n}\binom{n}{k}a^{n-k}b^k"},
        {"name": "Binomial Coefficient", "latex": r"\binom{n}{k}=\frac{n!}{k!(n-k)!}"},
    ],
    "Polar & Complex Polar": [
        {"name": "Rectangular to Polar", "latex": r"x=r\cos\theta,\ y=r\sin\theta,\ r=\sqrt{x^2+y^2},\ \theta=\arctan\!\left(\tfrac{y}{x}\right)"},
        {"name": "Euler's Form", "latex": r"r(\cos\theta+i\sin\theta)=re^{i\theta}"},
        {"name": "De Moivre's Theorem", "latex": r"[r(\cos\theta+i\sin\theta)]^n=r^n(\cos n\theta+i\sin n\theta)"},
    ],
}
