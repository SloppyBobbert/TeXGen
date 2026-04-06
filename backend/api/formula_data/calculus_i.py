"""
CALCULUS I formulas
"""

CLASS_NAME = "CALCULUS I"

FORMULAS = {
    "Limits": [
        {"name": "Sum/Diff Limit", "latex": r"\lim_{x\to a}[f(x)\pm g(x)]=L\pm M"},
        {"name": "Product Limit", "latex": r"\lim_{x\to a}f(x)g(x)=LM"},
        {"name": "Quotient Limit", "latex": r"\lim_{x\to a}\frac{f(x)}{g(x)}=\frac{L}{M},\ M\neq0"},
        {"name": "Power Limit", "latex": r"\lim_{x\to a}[f(x)]^n=L^n"},
        {"name": "Important Limit 1", "latex": r"\lim_{x\to0}\frac{\sin x}{x}=1"},
        {"name": "Important Limit 2", "latex": r"\lim_{x\to0}\frac{1-\cos x}{x}=0"},
        {"name": "Infinity Limit", "latex": r"\lim_{x\to\pm\infty}\frac{1}{x^n}=0,\ n>0"},
        {"name": "e Definition", "latex": r"\lim_{x\to\infty}\!\left(1+\frac{1}{x}\right)^x=e"},
    ],
    "Derivative Definition": [
        {"name": "Limit Definition", "latex": r"f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}{h}"},
        {"name": "Alternate Definition", "latex": r"f'(a)=\lim_{x\to a}\frac{f(x)-f(a)}{x-a}"},
    ],
    "Differentiation Rules": [
        {"name": "Constant Multiple", "latex": r"\frac{d}{dx}[cf]=cf'"},
        {"name": "Sum/Diff Rule", "latex": r"\frac{d}{dx}[f\pm g]=f'\pm g'"},
        {"name": "Product Rule", "latex": r"\frac{d}{dx}[fg]=f'g+fg'"},
        {"name": "Quotient Rule", "latex": r"\frac{d}{dx}\!\left[\frac{f}{g}\right]=\frac{f'g-fg'}{g^2}"},
        {"name": "Chain Rule", "latex": r"\frac{d}{dx}[f(g(x))]=f'(g(x))\cdot g'(x)"},
    ],
    "Common Derivatives": [
        {"name": "Power Rule", "latex": r"\frac{d}{dx}[x^n]=nx^{n-1}"},
        {"name": "Exponential", "latex": r"\frac{d}{dx}[e^x]=e^x,\ \frac{d}{dx}[a^x]=a^x\ln a"},
        {"name": "Logarithmic", "latex": r"\frac{d}{dx}[\ln x]=\frac{1}{x},\ \frac{d}{dx}[\log_a x]=\frac{1}{x\ln a}"},
        {"name": "Sine/Cosine", "latex": r"\frac{d}{dx}[\sin x]=\cos x,\ \frac{d}{dx}[\cos x]=-\sin x"},
        {"name": "Tangent/Cotangent", "latex": r"\frac{d}{dx}[\tan x]=\sec^2 x,\ \frac{d}{dx}[\cot x]=-\csc^2 x"},
        {"name": "Secant/Cosecant", "latex": r"\frac{d}{dx}[\sec x]=\sec x\tan x,\ \frac{d}{dx}[\csc x]=-\csc x\cot x"},
        {"name": "Arcsin/Arccos", "latex": r"\frac{d}{dx}[\arcsin x]=\frac{1}{\sqrt{1-x^2}},\ \frac{d}{dx}[\arccos x]=\frac{-1}{\sqrt{1-x^2}}"},
        {"name": "Arctan", "latex": r"\frac{d}{dx}[\arctan x]=\frac{1}{1+x^2}"},
    ],
    "Theorems": [
        {"name": "Mean Value Theorem", "latex": r"\text{MVT: }f'(c)=\frac{f(b)-f(a)}{b-a}\text{ for some }c\in(a,b)"},
        {"name": "Rolle's Theorem", "latex": r"\text{Rolle's: if }f(a)=f(b),\ \exists\,c\in(a,b)\text{ s.t. }f'(c)=0"},
        {"name": "Intermediate Value Theorem", "latex": r"\text{IVT: if }f\text{ is cts on }[a,b],\ f\text{ takes all values between }f(a)\text{ and }f(b)"},
    ],
    "Fundamental Theorem of Calculus": [
        {"name": "Part 1 (Leibniz)", "latex": r"\frac{d}{dx}\int_a^x f(t)\,dt=f(x)"},
        {"name": "Part 2 (Evaluation)", "latex": r"\int_a^b f(x)\,dx=F(b)-F(a),\quad F'=f"},
    ],
    "Basic Antiderivatives": [
        {"name": "Power Rule", "latex": r"\int x^n\,dx=\frac{x^{n+1}}{n+1}+C,\ n\neq-1"},
        {"name": "Reciprocal", "latex": r"\int\frac{1}{x}\,dx=\ln|x|+C"},
        {"name": "Exponential", "latex": r"\int e^x\,dx=e^x+C,\ \int a^x\,dx=\frac{a^x}{\ln a}+C"},
        {"name": "Trig Basic", "latex": r"\int\sin x\,dx=-\cos x+C,\ \int\cos x\,dx=\sin x+C"},
        {"name": "Trig Square", "latex": r"\int\sec^2 x\,dx=\tan x+C,\ \int\csc^2 x\,dx=-\cot x+C"},
        {"name": "Trig Product", "latex": r"\int\sec x\tan x\,dx=\sec x+C,\ \int\csc x\cot x\,dx=-\csc x+C"},
        {"name": "Inverse Trig", "latex": r"\int\frac{1}{\sqrt{1-x^2}}\,dx=\arcsin x+C,\ \int\frac{1}{1+x^2}\,dx=\arctan x+C"},
    ],
}