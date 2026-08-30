"""
CALCULUS I formulas
"""

CLASS_NAME = "CALCULUS I"

FORMULAS = {
    "Limits": [
        { "id": "calculus-i.sum-diff-limit","name": "Sum/Diff Limit", "latex": r"\lim_{x\to a}[f(x)\pm g(x)]=L\pm M"},
        { "id": "calculus-i.product-limit","name": "Product Limit", "latex": r"\lim_{x\to a}f(x)g(x)=LM"},
        { "id": "calculus-i.quotient-limit","name": "Quotient Limit", "latex": r"\lim_{x\to a}\frac{f(x)}{g(x)}=\frac{L}{M},\ M\neq0"},
        { "id": "calculus-i.power-limit","name": "Power Limit", "latex": r"\lim_{x\to a}[f(x)]^n=L^n"},
        { "id": "calculus-i.important-limit-1","name": "Important Limit 1", "latex": r"\lim_{x\to0}\frac{\sin x}{x}=1"},
        { "id": "calculus-i.important-limit-2","name": "Important Limit 2", "latex": r"\lim_{x\to0}\frac{1-\cos x}{x}=0"},
        { "id": "calculus-i.infinity-limit","name": "Infinity Limit", "latex": r"\lim_{x\to\pm\infty}\frac{1}{x^n}=0,\ n>0"},
        { "id": "calculus-i.e-definition","name": "e Definition", "latex": r"\lim_{x\to\infty}\!\left(1+\frac{1}{x}\right)^x=e"},
    ],
    "Derivative Definitions and Rules": [
        { "id": "calculus-i.limit-definition","name": "Limit Definition", "latex": r"f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}{h}"},
        { "id": "calculus-i.alternate-definition","name": "Alternate Definition", "latex": r"f'(a)=\lim_{x\to a}\frac{f(x)-f(a)}{x-a}"},
        { "id": "calculus-i.constant-multiple","name": "Constant Multiple", "latex": r"\frac{d}{dx}[cf]=cf'"},
        { "id": "calculus-i.sum-diff-rule","name": "Sum/Diff Rule", "latex": r"\frac{d}{dx}[f\pm g]=f'\pm g'"},
        { "id": "calculus-i.product-rule","name": "Product Rule", "latex": r"\frac{d}{dx}[fg]=f'g+fg'"},
        { "id": "calculus-i.quotient-rule","name": "Quotient Rule", "latex": r"\frac{d}{dx}\!\left[\frac{f}{g}\right]=\frac{f'g-fg'}{g^2}"},
        { "id": "calculus-i.chain-rule","name": "Chain Rule", "latex": r"\frac{d}{dx}[f(g(x))]=f'(g(x))\cdot g'(x)"},
    ],
    "Common Derivatives": [
        { "id": "calculus-i.power-rule","name": "Power Rule", "latex": r"\frac{d}{dx}[x^n]=nx^{n-1}"},
        { "id": "calculus-i.exponential","name": "Exponential", "latex": r"\frac{d}{dx}[e^x]=e^x,\ \frac{d}{dx}[a^x]=a^x\ln a"},
        { "id": "calculus-i.logarithmic","name": "Logarithmic", "latex": r"\frac{d}{dx}[\ln x]=\frac{1}{x},\ \frac{d}{dx}[\log_a x]=\frac{1}{x\ln a}"},
        { "id": "calculus-i.sine-cosine","name": "Sine/Cosine", "latex": r"\frac{d}{dx}[\sin x]=\cos x,\ \frac{d}{dx}[\cos x]=-\sin x"},
        { "id": "calculus-i.tangent-cotangent","name": "Tangent/Cotangent", "latex": r"\frac{d}{dx}[\tan x]=\sec^2 x,\ \frac{d}{dx}[\cot x]=-\csc^2 x"},
        { "id": "calculus-i.secant-cosecant","name": "Secant/Cosecant", "latex": r"\frac{d}{dx}[\sec x]=\sec x\tan x,\ \frac{d}{dx}[\csc x]=-\csc x\cot x"},
        { "id": "calculus-i.arcsin-arccos","name": "Arcsin/Arccos", "latex": r"\frac{d}{dx}[\arcsin x]=\frac{1}{\sqrt{1-x^2}},\ \frac{d}{dx}[\arccos x]=\frac{-1}{\sqrt{1-x^2}}"},
        { "id": "calculus-i.arctan","name": "Arctan", "latex": r"\frac{d}{dx}[\arctan x]=\frac{1}{1+x^2}"},
    ],
    "Core Theorems of Calculus": [
        { "id": "calculus-i.mean-value-theorem","name": "Mean Value Theorem", "latex": r"\text{MVT: }f'(c)=\frac{f(b)-f(a)}{b-a}\text{ for some }c\in(a,b)"},
        { "id": "calculus-i.rolle-s-theorem","name": "Rolle's Theorem", "latex": r"\text{Rolle's: if }f(a)=f(b),\ \exists\,c\in(a,b)\text{ s.t. }f'(c)=0"},
        { "id": "calculus-i.intermediate-value-theorem","name": "Intermediate Value Theorem", "latex": r"\text{IVT: if }f\text{ is cts on }[a,b],\ f\text{ takes all values between }f(a)\text{ and }f(b)"},
        { "id": "calculus-i.part-1-leibniz","name": "Part 1 (Leibniz)", "latex": r"\frac{d}{dx}\int_a^x f(t)\,dt=f(x)"},
        { "id": "calculus-i.part-2-evaluation","name": "Part 2 (Evaluation)", "latex": r"\int_a^b f(x)\,dx=F(b)-F(a),\quad F'=f"},
    ],
    "Basic Antiderivatives": [
        { "id": "calculus-i.power-rule-basic-antiderivatives","name": "Power Rule", "latex": r"\int x^n\,dx=\frac{x^{n+1}}{n+1}+C,\ n\neq-1"},
        { "id": "calculus-i.reciprocal","name": "Reciprocal", "latex": r"\int\frac{1}{x}\,dx=\ln|x|+C"},
        { "id": "calculus-i.exponential-basic-antiderivatives","name": "Exponential", "latex": r"\int e^x\,dx=e^x+C,\ \int a^x\,dx=\frac{a^x}{\ln a}+C"},
        { "id": "calculus-i.trig-basic","name": "Trig Basic", "latex": r"\int\sin x\,dx=-\cos x+C,\ \int\cos x\,dx=\sin x+C"},
        { "id": "calculus-i.trig-square","name": "Trig Square", "latex": r"\int\sec^2 x\,dx=\tan x+C,\ \int\csc^2 x\,dx=-\cot x+C"},
        { "id": "calculus-i.trig-product","name": "Trig Product", "latex": r"\int\sec x\tan x\,dx=\sec x+C,\ \int\csc x\cot x\,dx=-\csc x+C"},
        { "id": "calculus-i.inverse-trig","name": "Inverse Trig", "latex": r"\int\frac{1}{\sqrt{1-x^2}}\,dx=\arcsin x+C,\ \int\frac{1}{1+x^2}\,dx=\arctan x+C"},
    ],
}
