"""
CALCULUS II formulas
"""

CLASS_NAME = "CALCULUS II"

FORMULAS = {
    "Integration Techniques and Improper Integrals": [
        { "id": "calculus-ii.u-substitution","name": "U-Substitution", "latex": r"\int f(g(x))g'(x)\,dx=\int f(u)\,du\ (u=g(x))"},
        { "id": "calculus-ii.integration-by-parts","name": "Integration by Parts", "latex": r"\int u\,dv=uv-\int v\,du"},
        { "id": "calculus-ii.trig-substitution-1","name": "Trig Substitution 1", "latex": r"\sqrt{a^2-x^2}\to x=a\sin\theta"},
        { "id": "calculus-ii.trig-substitution-2","name": "Trig Substitution 2", "latex": r"\sqrt{a^2+x^2}\to x=a\tan\theta"},
        { "id": "calculus-ii.trig-substitution-3","name": "Trig Substitution 3", "latex": r"\sqrt{x^2-a^2}\to x=a\sec\theta"},
        { "id": "calculus-ii.partial-fractions","name": "Partial Fractions", "latex": r"\frac{p(x)}{(x-a)(x-b)}=\frac{A}{x-a}+\frac{B}{x-b}"},
        { "id": "calculus-ii.infinite-upper-bound","name": "Infinite Upper Bound", "latex": r"\int_a^{\infty}f\,dx=\lim_{t\to\infty}\int_a^t f\,dx"},
        { "id": "calculus-ii.infinite-both-bounds","name": "Infinite Both Bounds", "latex": r"\int_{-\infty}^{\infty}f\,dx=\int_{-\infty}^c f\,dx+\int_c^{\infty}f\,dx"},
        { "id": "calculus-ii.unbounded-integrand","name": "Unbounded Integrand", "latex": r"\int_a^b f\,dx=\lim_{t\to c}\int_a^t f\,dx\text{ if }f\text{ unbounded at }c"},
    ],
    "Applications of Integration": [
        { "id": "calculus-ii.area-between-curves","name": "Area Between Curves", "latex": r"A=\int_a^b[f(x)-g(x)]\,dx"},
        { "id": "calculus-ii.disk-method","name": "Disk Method", "latex": r"V=\pi\int_a^b[f(x)]^2\,dx"},
        { "id": "calculus-ii.washer-method","name": "Washer Method", "latex": r"V=\pi\int_a^b([f(x)]^2-[g(x)]^2)dx"},
        { "id": "calculus-ii.shell-method","name": "Shell Method", "latex": r"V=2\pi\int_a^b x\,f(x)\,dx"},
        { "id": "calculus-ii.arc-length","name": "Arc Length", "latex": r"L=\int_a^b\sqrt{1+[f'(x)]^2}\,dx"},
        { "id": "calculus-ii.surface-of-revolution","name": "Surface of Revolution", "latex": r"S=2\pi\int_a^b f(x)\sqrt{1+[f'(x)]^2}\,dx"},
    ],
    "Sequences & Series": [
        { "id": "calculus-ii.geometric-series","name": "Geometric Series", "latex": r"\sum_{n=0}^{\infty}ar^n=\frac{a}{1-r},\ |r|<1"},
        { "id": "calculus-ii.p-series","name": "P-Series", "latex": r"\sum_{n=1}^{\infty}\frac{1}{n^p}\text{ converges iff }p>1"},
        { "id": "calculus-ii.ratio-test","name": "Ratio Test", "latex": r"\lim_{n\to\infty}\left|\frac{a_{n+1}}{a_n}\right|=L;\ L<1\text{ conv.},\ L>1\text{ div.}"},
        { "id": "calculus-ii.root-test","name": "Root Test", "latex": r"\lim_{n\to\infty}\sqrt[n]{|a_n|}=L;\ L<1\text{ conv.},\ L>1\text{ div.}"},
    ],
    "Power & Taylor Series": [
        { "id": "calculus-ii.taylor-series","name": "Taylor Series", "latex": r"f(x)=\sum_{n=0}^{\infty}\frac{f^{(n)}(a)}{n!}(x-a)^n"},
        { "id": "calculus-ii.e-x-series","name": "e^x Series", "latex": r"e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}"},
        { "id": "calculus-ii.sine-series","name": "Sine Series", "latex": r"\sin x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n+1}}{(2n+1)!}"},
        { "id": "calculus-ii.cosine-series","name": "Cosine Series", "latex": r"\cos x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n}}{(2n)!}"},
        { "id": "calculus-ii.geometric-series-1-1-x","name": "Geometric Series (1/(1-x))", "latex": r"\frac{1}{1-x}=\sum_{n=0}^{\infty}x^n,\ |x|<1"},
        { "id": "calculus-ii.ln-1-x-series","name": "ln(1+x) Series", "latex": r"\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n+1}x^n}{n},\ |x|\leq1"},
        { "id": "calculus-ii.radius-of-convergence","name": "Radius of Convergence", "latex": r"R=\frac{1}{\limsup_{n\to\infty}\sqrt[n]{|a_n|}}"},
    ],
    "Parametric & Polar": [
        { "id": "calculus-ii.derivative-parametric","name": "Derivative (Parametric)", "latex": r"\frac{dy}{dx}=\frac{dy/dt}{dx/dt}"},
        { "id": "calculus-ii.second-derivative-parametric","name": "Second Derivative (Parametric)", "latex": r"\frac{d^2y}{dx^2}=\frac{d(dy/dx)/dt}{dx/dt}"},
        { "id": "calculus-ii.arc-length-parametric","name": "Arc Length (Parametric)", "latex": r"L=\int_a^b\sqrt{\left(\frac{dx}{dt}\right)^2+\left(\frac{dy}{dt}\right)^2}\,dt"},
        { "id": "calculus-ii.polar-area","name": "Polar Area", "latex": r"A=\frac{1}{2}\int_\alpha^\beta r^2\,d\theta"},
        { "id": "calculus-ii.polar-arc-length","name": "Polar Arc Length", "latex": r"L=\int_\alpha^\beta\sqrt{r^2+\left(\frac{dr}{d\theta}\right)^2}\,d\theta"},
    ],
}
