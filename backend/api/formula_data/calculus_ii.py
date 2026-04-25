"""
CALCULUS II formulas
"""

CLASS_NAME = "CALCULUS II"

FORMULAS = {
    "Integration Techniques and Improper Integrals": [
        {"name": "U-Substitution", "latex": r"\int f(g(x))g'(x)\,dx=\int f(u)\,du\ (u=g(x))"},
        {"name": "Integration by Parts", "latex": r"\int u\,dv=uv-\int v\,du"},
        {"name": "Trig Substitution 1", "latex": r"\sqrt{a^2-x^2}\to x=a\sin\theta"},
        {"name": "Trig Substitution 2", "latex": r"\sqrt{a^2+x^2}\to x=a\tan\theta"},
        {"name": "Trig Substitution 3", "latex": r"\sqrt{x^2-a^2}\to x=a\sec\theta"},
        {"name": "Partial Fractions", "latex": r"\frac{p(x)}{(x-a)(x-b)}=\frac{A}{x-a}+\frac{B}{x-b}"},
        {"name": "Infinite Upper Bound", "latex": r"\int_a^{\infty}f\,dx=\lim_{t\to\infty}\int_a^t f\,dx"},
        {"name": "Infinite Both Bounds", "latex": r"\int_{-\infty}^{\infty}f\,dx=\int_{-\infty}^c f\,dx+\int_c^{\infty}f\,dx"},
        {"name": "Unbounded Integrand", "latex": r"\int_a^b f\,dx=\lim_{t\to c}\int_a^t f\,dx\text{ if }f\text{ unbounded at }c"},
    ],
    "Applications of Integration": [
        {"name": "Area Between Curves", "latex": r"A=\int_a^b[f(x)-g(x)]\,dx"},
        {"name": "Disk Method", "latex": r"V=\pi\int_a^b[f(x)]^2\,dx"},
        {"name": "Washer Method", "latex": r"V=\pi\int_a^b([f(x)]^2-[g(x)]^2)dx"},
        {"name": "Shell Method", "latex": r"V=2\pi\int_a^b x\,f(x)\,dx"},
        {"name": "Arc Length", "latex": r"L=\int_a^b\sqrt{1+[f'(x)]^2}\,dx"},
        {"name": "Surface of Revolution", "latex": r"S=2\pi\int_a^b f(x)\sqrt{1+[f'(x)]^2}\,dx"},
    ],
    "Sequences & Series": [
        {"name": "Geometric Series", "latex": r"\sum_{n=0}^{\infty}ar^n=\frac{a}{1-r},\ |r|<1"},
        {"name": "P-Series", "latex": r"\sum_{n=1}^{\infty}\frac{1}{n^p}\text{ converges iff }p>1"},
        {"name": "Ratio Test", "latex": r"\lim_{n\to\infty}\left|\frac{a_{n+1}}{a_n}\right|=L;\ L<1\text{ conv.},\ L>1\text{ div.}"},
        {"name": "Root Test", "latex": r"\lim_{n\to\infty}\sqrt[n]{|a_n|}=L;\ L<1\text{ conv.},\ L>1\text{ div.}"},
    ],
    "Power & Taylor Series": [
        {"name": "Taylor Series", "latex": r"f(x)=\sum_{n=0}^{\infty}\frac{f^{(n)}(a)}{n!}(x-a)^n"},
        {"name": "e^x Series", "latex": r"e^x=\sum_{n=0}^{\infty}\frac{x^n}{n!}"},
        {"name": "Sine Series", "latex": r"\sin x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n+1}}{(2n+1)!}"},
        {"name": "Cosine Series", "latex": r"\cos x=\sum_{n=0}^{\infty}\frac{(-1)^nx^{2n}}{(2n)!}"},
        {"name": "Geometric Series (1/(1-x))", "latex": r"\frac{1}{1-x}=\sum_{n=0}^{\infty}x^n,\ |x|<1"},
        {"name": "ln(1+x) Series", "latex": r"\ln(1+x)=\sum_{n=1}^{\infty}\frac{(-1)^{n+1}x^n}{n},\ |x|\leq1"},
        {"name": "Radius of Convergence", "latex": r"R=\frac{1}{\limsup_{n\to\infty}\sqrt[n]{|a_n|}}"},
    ],
    "Parametric & Polar": [
        {"name": "Derivative (Parametric)", "latex": r"\frac{dy}{dx}=\frac{dy/dt}{dx/dt}"},
        {"name": "Second Derivative (Parametric)", "latex": r"\frac{d^2y}{dx^2}=\frac{d(dy/dx)/dt}{dx/dt}"},
        {"name": "Arc Length (Parametric)", "latex": r"L=\int_a^b\sqrt{\left(\frac{dx}{dt}\right)^2+\left(\frac{dy}{dt}\right)^2}\,dt"},
        {"name": "Polar Area", "latex": r"A=\frac{1}{2}\int_\alpha^\beta r^2\,d\theta"},
        {"name": "Polar Arc Length", "latex": r"L=\int_\alpha^\beta\sqrt{r^2+\left(\frac{dr}{d\theta}\right)^2}\,d\theta"},
    ],
}
