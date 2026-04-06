"""
TRIGONOMETRY formulas
"""

CLASS_NAME = "TRIGONOMETRY"

FORMULAS = {
    "Special Triangles": [
        {"name": "30-60-90 Triangle", "latex": r"30-60-90: 1:\sqrt{3}:2 \quad \text{short leg}=x,\ \text{long leg}=x\sqrt{3},\ \text{hyp}=2x"},
        {"name": "45-45-90 Triangle", "latex": r"45-45-90: 1:1:\sqrt{2} \quad \text{leg}=x,\ \text{hyp}=x\sqrt{2}"},
        {"name": "60-60-60 Triangle", "latex": r"60-60-60: 1:1:1 \quad \text{side}=x,\ \text{height}=\tfrac{x\sqrt{3}}{2},\ \text{area}=\tfrac{x^2\sqrt{3}}{4}"},
    ],
    "Definitions (Right Triangle)": [
        {"name": "Basic Trig Functions", "latex": r"\sin\theta=\frac{\text{opp}}{\text{hyp}},\ \cos\theta=\frac{\text{adj}}{\text{hyp}},\ \tan\theta=\frac{\text{opp}}{\text{adj}}"},
        {"name": "Reciprocal Functions", "latex": r"\csc\theta=\frac{1}{\sin\theta},\ \sec\theta=\frac{1}{\cos\theta},\ \cot\theta=\frac{1}{\tan\theta}"},
        {"name": "Quotient Identities", "latex": r"\tan\theta=\frac{\sin\theta}{\cos\theta},\ \cot\theta=\frac{\cos\theta}{\sin\theta}"},
    ],
    "Pythagorean Identities": [
        {"name": "Primary Identity", "latex": r"\sin^2\theta+\cos^2\theta=1"},
        {"name": "Tangent Identity", "latex": r"1+\tan^2\theta=\sec^2\theta"},
        {"name": "Cotangent Identity", "latex": r"1+\cot^2\theta=\csc^2\theta"},
    ],
    "Even / Odd Identities": [
        {"name": "Sine (Odd)", "latex": r"\sin(-\theta)=-\sin\theta"},
        {"name": "Cosine (Even)", "latex": r"\cos(-\theta)=\cos\theta"},
        {"name": "Tangent (Odd)", "latex": r"\tan(-\theta)=-\tan\theta"},
        {"name": "Reciprocal Odd", "latex": r"\csc(-\theta)=-\csc\theta,\ \sec(-\theta)=\sec\theta,\ \cot(-\theta)=-\cot\theta"},
    ],
    "Co-Function Identities": [
        {"name": "Sine-Cosine", "latex": r"\sin\theta=\cos\!\left(\tfrac{\pi}{2}-\theta\right),\ \cos\theta=\sin\!\left(\tfrac{\pi}{2}-\theta\right)"},
        {"name": "Tangent-Cotangent", "latex": r"\tan\theta=\cot\!\left(\tfrac{\pi}{2}-\theta\right),\ \cot\theta=\tan\!\left(\tfrac{\pi}{2}-\theta\right)"},
        {"name": "Secant-Cosecant", "latex": r"\sec\theta=\csc\!\left(\tfrac{\pi}{2}-\theta\right),\ \csc\theta=\sec\!\left(\tfrac{\pi}{2}-\theta\right)"},
    ],
    "Periodicity & Shifts": [
        {"name": "Full Period", "latex": r"\sin(\theta+2\pi)=\sin\theta,\ \cos(\theta+2\pi)=\cos\theta,\ \tan(\theta+\pi)=\tan\theta"},
        {"name": "Half Period Shift", "latex": r"\sin(\theta+\pi)=-\sin\theta,\ \cos(\theta+\pi)=-\cos\theta"},
    ],
    "Sum & Difference": [
        {"name": "Sine Sum/Difference", "latex": r"\sin(A\pm B)=\sin A\cos B\pm\cos A\sin B"},
        {"name": "Cosine Sum/Difference", "latex": r"\cos(A\pm B)=\cos A\cos B\mp\sin A\sin B"},
        {"name": "Tangent Sum/Difference", "latex": r"\tan(A\pm B)=\frac{\tan A\pm\tan B}{1\mp\tan A\tan B}"},
    ],
    "Double Angle": [
        {"name": "Sine Double Angle", "latex": r"\sin 2\theta=2\sin\theta\cos\theta"},
        {"name": "Cosine Double Angle", "latex": r"\cos 2\theta=\cos^2\theta-\sin^2\theta=1-2\sin^2\theta=2\cos^2\theta-1"},
        {"name": "Tangent Double Angle", "latex": r"\tan 2\theta=\frac{2\tan\theta}{1-\tan^2\theta}"},
    ],
    "Half Angle": [
        {"name": "Sine Half Angle", "latex": r"\sin\frac{\theta}{2}=\pm\sqrt{\frac{1-\cos\theta}{2}}"},
        {"name": "Cosine Half Angle", "latex": r"\cos\frac{\theta}{2}=\pm\sqrt{\frac{1+\cos\theta}{2}}"},
        {"name": "Tangent Half Angle", "latex": r"\tan\frac{\theta}{2}=\pm\sqrt{\frac{1-\cos\theta}{1+\cos\theta}}=\frac{\sin\theta}{1+\cos\theta}=\frac{1-\cos\theta}{\sin\theta}"},
    ],
    "Power-Reducing": [
        {"name": "Sine Power-Reducing", "latex": r"\sin^2\theta=\frac{1-\cos 2\theta}{2}"},
        {"name": "Cosine Power-Reducing", "latex": r"\cos^2\theta=\frac{1+\cos 2\theta}{2}"},
        {"name": "Tangent Power-Reducing", "latex": r"\tan^2\theta=\frac{1-\cos 2\theta}{1+\cos 2\theta}"},
    ],
    "Product-to-Sum": [
        {"name": "Sine-Sine Product", "latex": r"\sin A\sin B=\tfrac{1}{2}[\cos(A-B)-\cos(A+B)]"},
        {"name": "Cosine-Cosine Product", "latex": r"\cos A\cos B=\tfrac{1}{2}[\cos(A-B)+\cos(A+B)]"},
        {"name": "Sine-Cosine Product", "latex": r"\sin A\cos B=\tfrac{1}{2}[\sin(A+B)+\sin(A-B)]"},
        {"name": "Cosine-Sine Product", "latex": r"\cos A\sin B=\tfrac{1}{2}[\sin(A+B)-\sin(A-B)]"},
    ],
    "Sum-to-Product": [
        {"name": "Sine Sum", "latex": r"\sin A+\sin B=2\sin\!\left(\frac{A+B}{2}\right)\cos\!\left(\frac{A-B}{2}\right)"},
        {"name": "Sine Difference", "latex": r"\sin A-\sin B=2\cos\!\left(\frac{A+B}{2}\right)\sin\!\left(\frac{A-B}{2}\right)"},
        {"name": "Cosine Sum", "latex": r"\cos A+\cos B=2\cos\!\left(\frac{A+B}{2}\right)\cos\!\left(\frac{A-B}{2}\right)"},
        {"name": "Cosine Difference", "latex": r"\cos A-\cos B=-2\sin\!\left(\frac{A+B}{2}\right)\sin\!\left(\frac{A-B}{2}\right)"},
    ],
    "Triple Angle": [
        {"name": "Sine Triple Angle", "latex": r"\sin 3\theta=3\sin\theta-4\sin^3\theta"},
        {"name": "Cosine Triple Angle", "latex": r"\cos 3\theta=4\cos^3\theta-3\cos\theta"},
        {"name": "Tangent Triple Angle", "latex": r"\tan 3\theta=\frac{3\tan\theta-\tan^3\theta}{1-3\tan^2\theta}"},
    ],
    "Inverse Trig Identities": [
        {"name": "Arcsin/Arccos", "latex": r"\arcsin(-x)=-\arcsin x,\ \arccos(-x)=\pi-\arccos x"},
        {"name": "Arctan/Arccot", "latex": r"\arctan(-x)=-\arctan x,\ \arctan x+\text{arccot}\,x=\tfrac{\pi}{2}"},
        {"name": "Inverse Sum", "latex": r"\arcsin x+\arccos x=\tfrac{\pi}{2}"},
        {"name": "Inverse Relationships", "latex": r"\sin(\arccos x)=\sqrt{1-x^2},\ \cos(\arcsin x)=\sqrt{1-x^2}"},
    ],
    "Law of Sines & Cosines": [
        {"name": "Law of Sines", "latex": r"\frac{a}{\sin A}=\frac{b}{\sin B}=\frac{c}{\sin C}"},
        {"name": "Law of Cosines", "latex": r"c^2=a^2+b^2-2ab\cos C"},
        {"name": "Area of Triangle", "latex": r"A=\tfrac{1}{2}ab\sin C"},
    ],
    "Arc Length & Sector Area": [
        {"name": "Arc Length", "latex": r"s=r\theta\ (\theta\text{ in radians})"},
        {"name": "Sector Area", "latex": r"A=\tfrac{1}{2}r^2\theta\ (\theta\text{ in radians})"},
    ],
}