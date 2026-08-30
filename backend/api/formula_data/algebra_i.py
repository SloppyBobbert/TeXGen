"""
ALGEBRA I formulas
"""

CLASS_NAME = "ALGEBRA I"

FORMULAS = {
    "Linear Equations": [
        { "id": "algebra-i.slope-formula","name": "Slope Formula", "latex": r"m=\frac{y_2-y_1}{x_2-x_1}"},
        { "id": "algebra-i.point-slope-form","name": "Point-Slope Form", "latex": r"y-y_1=m(x-x_1)"},
        { "id": "algebra-i.slope-intercept-form","name": "Slope-Intercept Form", "latex": r"y=mx+b"},
        { "id": "algebra-i.standard-form","name": "Standard Form", "latex": r"Ax+By=C"},
    ],
    "Inequalities": [
        { "id": "algebra-i.multiply-by-positive","name": "Multiply by Positive", "latex": r"\text{If } a>b \text{ and } c>0, \text{ then } ac>bc"},
        { "id": "algebra-i.multiply-by-negative","name": "Multiply by Negative", "latex": r"\text{If } a>b \text{ and } c<0, \text{ then } ac<bc"},
        { "id": "algebra-i.absolute-less-than","name": "Absolute Less Than", "latex": r"|x|<a \implies -a<x<a"},
        { "id": "algebra-i.absolute-greater-than","name": "Absolute Greater Than", "latex": r"|x|>a \implies x>a \text{ or } x<-a"},
    ],
    "Integer Rules": [
        { "id": "algebra-i.positive-x-positive","name": "Positive x Positive", "latex": r"(+)(+)=+"},
        { "id": "algebra-i.negative-x-negative","name": "Negative x Negative", "latex": r"(-)(-)=+"},
        { "id": "algebra-i.positive-x-negative","name": "Positive x Negative", "latex": r"(+)(-)=-"},
        { "id": "algebra-i.negative-x-positive","name": "Negative x Positive", "latex": r"(-)(+)=-"},
        { "id": "algebra-i.subtracting-negatives","name": "Subtracting Negatives", "latex": r"a-(-b)=a+b"},
    ],
    "Decimals and Percents": [
        { "id": "algebra-i.percent-formula","name": "Percent Formula", "latex": r"\text{Percent}=\frac{\text{Part}}{\text{Whole}}\times 100"},
        { "id": "algebra-i.part-formula","name": "Part Formula", "latex": r"\text{Part}=\text{Whole}\times\frac{\text{Percent}}{100}"},
        { "id": "algebra-i.decimal-to-percent","name": "Decimal to Percent", "latex": r"\text{Decimal to Percent: move decimal 2 places right}"},
        { "id": "algebra-i.percent-to-decimal","name": "Percent to Decimal", "latex": r"\text{Percent to Decimal: move decimal 2 places left}"},
    ],
    "Mean, Median, Mode": [
        { "id": "algebra-i.mean","name": "Mean", "latex": r"\text{Mean}=\frac{\text{Sum of values}}{\text{Number of values}}"},
        { "id": "algebra-i.median","name": "Median", "latex": r"\text{Median: middle value when sorted}"},
        { "id": "algebra-i.mode","name": "Mode", "latex": r"\text{Mode: most frequently occurring value}"},
    ],
    "Quadratic Equations": [
        { "id": "algebra-i.standard-form-quadratic-equations","name": "Standard Form", "latex": r"ax^2+bx+c=0"},
        { "id": "algebra-i.quadratic-formula","name": "Quadratic Formula", "latex": r"x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}"},
        { "id": "algebra-i.vertex-form","name": "Vertex Form", "latex": r"y=a(x-h)^2+k"},
        { "id": "algebra-i.axis-of-symmetry","name": "Axis of Symmetry", "latex": r"x=-\frac{b}{2a}"},
    ],
    "Polynomials": [
        { "id": "algebra-i.perfect-square-addition","name": "Perfect Square (Addition)", "latex": r"(a+b)^2=a^2+2ab+b^2"},
        { "id": "algebra-i.perfect-square-subtraction","name": "Perfect Square (Subtraction)", "latex": r"(a-b)^2=a^2-2ab+b^2"},
        { "id": "algebra-i.difference-of-squares","name": "Difference of Squares", "latex": r"a^2-b^2=(a-b)(a+b)"},
        { "id": "algebra-i.foil","name": "FOIL", "latex": r"(a+b)(c+d)=ac+ad+bc+bd"},
    ],
    "Exponents": [
        { "id": "algebra-i.product-rule","name": "Product Rule", "latex": r"a^m a^n = a^{m+n}"},
        { "id": "algebra-i.quotient-rule","name": "Quotient Rule", "latex": r"\frac{a^m}{a^n}=a^{m-n}"},
        { "id": "algebra-i.power-rule","name": "Power Rule", "latex": r"(a^m)^n=a^{mn}"},
        { "id": "algebra-i.negative-exponent","name": "Negative Exponent", "latex": r"a^{-n}=\frac{1}{a^n}"},
        { "id": "algebra-i.zero-exponent","name": "Zero Exponent", "latex": r"a^0=1"},
        { "id": "algebra-i.radical-to-exponent","name": "Radical to Exponent", "latex": r"\sqrt[n]{a^m}=a^{m/n}"},
    ],
    "Radicals": [
        { "id": "algebra-i.product-rule-radicals","name": "Product Rule", "latex": r"\sqrt{ab}=\sqrt{a}\cdot\sqrt{b}"},
        { "id": "algebra-i.quotient-rule-radicals","name": "Quotient Rule", "latex": r"\sqrt{\frac{a}{b}}=\frac{\sqrt{a}}{\sqrt{b}}"},
        { "id": "algebra-i.like-radicals","name": "Like Radicals", "latex": r"a\sqrt{b}+c\sqrt{b}=(a+c)\sqrt{b}"},
        { "id": "algebra-i.square-of-square-root","name": "Square of Square Root", "latex": r"(\sqrt{a})^2=a"},
    ],
    "Functions": [
        { "id": "algebra-i.function-notation","name": "Function Notation", "latex": r"f(x)=y"},
        { "id": "algebra-i.domain","name": "Domain", "latex": r"\text{Domain: all valid input } x \text{ values}"},
        { "id": "algebra-i.range","name": "Range", "latex": r"\text{Range: all output } y \text{ values}"},
        { "id": "algebra-i.vertical-line-test","name": "Vertical Line Test", "latex": r"\text{Vertical Line Test: each } x \to \text{one } y"},
    ],
    "Absolute Value": [
        { "id": "algebra-i.definition","name": "Definition", "latex": r"|a| =\begin{cases} a & a \ge 0 \\ -a & a < 0 \end{cases}"},
        { "id": "algebra-i.product","name": "Product", "latex": r"|a \cdot b| = |a||b|"},
        { "id": "algebra-i.quotient","name": "Quotient", "latex": r"\left|\frac{a}{b}\right| = \frac{|a|}{|b|}"},
        { "id": "algebra-i.triangle-inequality","name": "Triangle Inequality", "latex": r"|a+b| \le |a| + |b|"},
    ],
    "Rational Expressions": [
        { "id": "algebra-i.multiplication","name": "Multiplication", "latex": r"\left(\frac{a}{b}\right)\left(\frac{c}{d}\right)=\frac{ac}{bd}"},
        { "id": "algebra-i.division","name": "Division", "latex": r"\left(\frac{a}{b}\right)\div\left(\frac{c}{d}\right)=\left(\frac{a}{b}\right)\left(\frac{d}{c}\right)=\frac{ad}{bc}"},
    ],
}
