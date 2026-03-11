"""
ALGEBRA I formulas
"""

CLASS_NAME = "ALGEBRA I"

FORMULAS = {
    "Linear Equations": [
        {"name": "Slope Formula", "latex": r"m=\frac{y_2-y_1}{x_2-x_1}"},
        {"name": "Point-Slope Form", "latex": r"y-y_1=m(x-x_1)"},
        {"name": "Slope-Intercept Form", "latex": r"y=mx+b"},
        {"name": "Standard Form", "latex": r"Ax+By=C"},
    ],
    "Inequalities": [
        {"name": "Multiply by Positive", "latex": r"\text{If } a>b \text{ and } c>0, \text{ then } ac>bc"},
        {"name": "Multiply by Negative", "latex": r"\text{If } a>b \text{ and } c<0, \text{ then } ac<bc"},
        {"name": "Absolute Less Than", "latex": r"|x|<a \implies -a<x<a"},
        {"name": "Absolute Greater Than", "latex": r"|x|>a \implies x>a \text{ or } x<-a"},
    ],
    "Integer Rules": [
        {"name": "Positive x Positive", "latex": r"(+)(+)=+"},
        {"name": "Negative x Negative", "latex": r"(-)(-)=+"},
        {"name": "Positive x Negative", "latex": r"(+)(-)=-"},
        {"name": "Negative x Positive", "latex": r"(-)(+)=-"},
        {"name": "Subtracting Negatives", "latex": r"a-(-b)=a+b"},
    ],
    "Decimals and Percents": [
        {"name": "Percent Formula", "latex": r"\text{Percent}=\frac{\text{Part}}{\text{Whole}}\times 100"},
        {"name": "Part Formula", "latex": r"\text{Part}=\text{Whole}\times\frac{\text{Percent}}{100}"},
        {"name": "Decimal to Percent", "latex": r"\text{Decimal to Percent: move decimal 2 places right}"},
        {"name": "Percent to Decimal", "latex": r"\text{Percent to Decimal: move decimal 2 places left}"},
    ],
    "Mean, Median, Mode": [
        {"name": "Mean", "latex": r"\text{Mean}=\frac{\text{Sum of values}}{\text{Number of values}}"},
        {"name": "Median", "latex": r"\text{Median: middle value when sorted}"},
        {"name": "Mode", "latex": r"\text{Mode: most frequently occurring value}"},
    ],
    "Quadratic Equations": [
        {"name": "Standard Form", "latex": r"ax^2+bx+c=0"},
        {"name": "Quadratic Formula", "latex": r"x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}"},
        {"name": "Vertex Form", "latex": r"y=a(x-h)^2+k"},
        {"name": "Axis of Symmetry", "latex": r"x=-\frac{b}{2a}"},
    ],
    "Polynomials": [
        {"name": "Perfect Square (Addition)", "latex": r"(a+b)^2=a^2+2ab+b^2"},
        {"name": "Perfect Square (Subtraction)", "latex": r"(a-b)^2=a^2-2ab+b^2"},
        {"name": "Difference of Squares", "latex": r"a^2-b^2=(a-b)(a+b)"},
        {"name": "FOIL", "latex": r"(a+b)(c+d)=ac+ad+bc+bd"},
    ],
    "Exponents": [
        {"name": "Product Rule", "latex": r"a^m a^n = a^{m+n}"},
        {"name": "Quotient Rule", "latex": r"\frac{a^m}{a^n}=a^{m-n}"},
        {"name": "Power Rule", "latex": r"(a^m)^n=a^{mn}"},
        {"name": "Negative Exponent", "latex": r"a^{-n}=\frac{1}{a^n}"},
        {"name": "Zero Exponent", "latex": r"a^0=1"},
        {"name": "Radical to Exponent", "latex": r"\sqrt[n]{a^m}=a^{m/n}"},
    ],
    "Radicals": [
        {"name": "Product Rule", "latex": r"\sqrt{ab}=\sqrt{a}\cdot\sqrt{b}"},
        {"name": "Quotient Rule", "latex": r"\sqrt{\frac{a}{b}}=\frac{\sqrt{a}}{\sqrt{b}}"},
        {"name": "Like Radicals", "latex": r"a\sqrt{b}+c\sqrt{b}=(a+c)\sqrt{b}"},
        {"name": "Square of Square Root", "latex": r"(\sqrt{a})^2=a"},
    ],
    "Functions": [
        {"name": "Function Notation", "latex": r"f(x)=y"},
        {"name": "Domain", "latex": r"\text{Domain: all valid input } x \text{ values}"},
        {"name": "Range", "latex": r"\text{Range: all output } y \text{ values}"},
        {"name": "Vertical Line Test", "latex": r"\text{Vertical Line Test: each } x \to \text{one } y"},
    ],
    "Absolute Value": [
        {"name": "Definition", "latex": r"|a| =\begin{cases} a & a \ge 0 \\ -a & a < 0 \end{cases}"},
        {"name": "Product", "latex": r"|a \cdot b| = |a||b|"},
        {"name": "Quotient", "latex": r"\left|\frac{a}{b}\right| = \frac{|a|}{|b|}"},
        {"name": "Triangle Inequality", "latex": r"|a+b| \le |a| + |b|"},
    ],
    "Rational Expressions": [
        {"name": "Multiplication", "latex": r"\left(\frac{a}{b}\right)\left(\frac{c}{d}\right)=\frac{ac}{bd}"},
        {"name": "Division", "latex": r"\left(\frac{a}{b}\right)\div\left(\frac{c}{d}\right)=\left(\frac{a}{b}\right)\left(\frac{d}{c}\right)=\frac{ad}{bc}"},
    ],
}
