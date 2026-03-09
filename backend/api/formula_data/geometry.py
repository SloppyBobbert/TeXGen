"""
GEOMETRY formulas
"""

CLASS_NAME = "GEOMETRY"

FORMULAS = {
    "Basic Angle Relationships": [
        {"name": "Supplementary", "latex": r"\text{Supplementary: } a+b=180^\circ"},
        {"name": "Complementary", "latex": r"\text{Complementary: } a+b=90^\circ"},
        {"name": "Vertical Angles", "latex": r"\text{Vertical angles are congruent}"},
        {"name": "Linear Pair", "latex": r"\text{Linear pair: supplementary and adjacent}"},
    ],
    "Parallel Lines and Transversals": [
        {"name": "Corresponding Angles", "latex": r"\text{Corresponding angles are congruent}"},
        {"name": "Alternate Interior", "latex": r"\text{Alternate interior angles are congruent}"},
        {"name": "Alternate Exterior", "latex": r"\text{Alternate exterior angles are congruent}"},
        {"name": "Co-interior", "latex": r"\text{Co-interior (same-side interior) angles are supplementary}"},
    ],
    "Triangles": [
        {"name": "Angle Sum", "latex": r"A+B+C=180^\circ"},
        {"name": "Exterior Angle", "latex": r"\text{Exterior angle} = \text{sum of two remote interior angles}"},
        {"name": "Area", "latex": r"A=\frac{1}{2}bh"},
        {"name": "Heron's Formula", "latex": r"A=\sqrt{s(s-a)(s-b)(s-c)} \quad s=\frac{a+b+c}{2}"},
        {"name": "Triangle Inequality", "latex": r"a+b>c"},
    ],
    "Pythagorean Theorem": [
        {"name": "Theorem", "latex": r"a^2+b^2=c^2"},
        {"name": "Solve for c", "latex": r"c=\sqrt{a^2+b^2}"},
        {"name": "Common Triples", "latex": r"\text{Common triples: } (3,4,5),\;(5,12,13),\;(8,15,17),\;(7,24,25)"},
    ],
    "Similar and Congruent Triangles": [
        {"name": "Congruence Rules", "latex": r"\text{Congruence: SSS, SAS, ASA, AAS, HL}"},
        {"name": "Similarity Rules", "latex": r"\text{Similarity: AA, SAS, SSS}"},
        {"name": "Proportional Sides", "latex": r"\frac{a_1}{a_2}=\frac{b_1}{b_2}=\frac{c_1}{c_2}"},
        {"name": "Area Ratio", "latex": r"\frac{A_1}{A_2}=\left(\frac{s_1}{s_2}\right)^2"},
    ],
    "Quadrilaterals": [
        {"name": "Interior Angles", "latex": r"\text{Sum of interior angles} = 360^\circ"},
        {"name": "Rectangle/Square", "latex": r"A_{\text{rect}}=lw \quad\quad A_{\text{square}}=s^2"},
        {"name": "Parallelogram", "latex": r"A_{\text{parallelogram}}=bh"},
        {"name": "Trapezoid", "latex": r"A_{\text{trapezoid}}=\frac{1}{2}(b_1+b_2)h"},
        {"name": "Rhombus", "latex": r"A_{\text{rhombus}}=\frac{1}{2}d_1 d_2"},
    ],
    "Polygons": [
        {"name": "Interior Sum", "latex": r"\text{Sum of interior angles}=(n-2)\cdot 180^\circ"},
        {"name": "Interior Angle", "latex": r"\text{Each interior angle (regular)}=\frac{(n-2)\cdot 180^\circ}{n}"},
        {"name": "Exterior Angle", "latex": r"\text{Each exterior angle (regular)}=\frac{360^\circ}{n}"},
        {"name": "Diagonals", "latex": r"\text{Number of diagonals}=\frac{n(n-3)}{2}"},
    ],
    "Circles": [
        {"name": "Circumference", "latex": r"C=2\pi r=\pi d"},
        {"name": "Area", "latex": r"A=\pi r^2"},
        {"name": "Arc Length", "latex": r"\text{Arc length}=\frac{\theta}{360}\cdot 2\pi r"},
        {"name": "Sector Area", "latex": r"\text{Sector area}=\frac{\theta}{360}\cdot\pi r^2"},
        {"name": "Inscribed Angle", "latex": r"\text{Inscribed angle}=\frac{1}{2}\text{(intercepted arc)}"},
        {"name": "Central Angle", "latex": r"\text{Central angle}=\text{intercepted arc}"},
    ],
    "Circle Theorems": [
        {"name": "Tangent-Radius", "latex": r"\text{Tangent} \perp \text{radius at point of tangency}"},
        {"name": "Equal Tangents", "latex": r"\text{Two tangents from external point are equal}"},
        {"name": "Intersecting Chords", "latex": r"\text{Intersecting chords: } (a)(b)=(c)(d)"},
        {"name": "Secant-Secant", "latex": r"\text{Secant-secant: } a(a+b)=c(c+d)"},
        {"name": "Secant-Tangent", "latex": r"\text{Secant-tangent: } t^2=a(a+b)"},
    ],
    "Coordinate Geometry": [
        {"name": "Distance Formula", "latex": r"d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}"},
        {"name": "Midpoint Formula", "latex": r"M=\left(\frac{x_1+x_2}{2},\;\frac{y_1+y_2}{2}\right)"},
        {"name": "Circle Equation", "latex": r"(x-h)^2+(y-k)^2=r^2"},
    ],
    "Surface Area and Volume": [
        {"name": "Prism", "latex": r"V_{\text{prism}}=Bh \quad\quad SA_{\text{prism}}=2B+Ph"},
        {"name": "Cylinder", "latex": r"V_{\text{cylinder}}=\pi r^2 h \quad\quad SA_{\text{cylinder}}=2\pi r^2+2\pi rh"},
        {"name": "Pyramid", "latex": r"V_{\text{pyramid}}=\frac{1}{3}Bh"},
        {"name": "Cone", "latex": r"V_{\text{cone}}=\frac{1}{3}\pi r^2 h \quad\quad SA_{\text{cone}}=\pi r^2+\pi r l"},
        {"name": "Sphere", "latex": r"V_{\text{sphere}}=\frac{4}{3}\pi r^3 \quad\quad SA_{\text{sphere}}=4\pi r^2"},
    ],
    "Transformations": [
        {"name": "Translation", "latex": r"\text{Translation: } (x,y)\to(x+a,\;y+b)"},
        {"name": "Reflection x-axis", "latex": r"\text{Reflection over } x\text{-axis: } (x,y)\to(x,-y)"},
        {"name": "Reflection y-axis", "latex": r"\text{Reflection over } y\text{-axis: } (x,y)\to(-x,y)"},
        {"name": "Reflection y=x", "latex": r"\text{Reflection over } y=x\text{: } (x,y)\to(y,x)"},
        {"name": "Rotation 90 CCW", "latex": r"\text{Rotation } 90^\circ \text{ CCW: } (x,y)\to(-y,x)"},
        {"name": "Rotation 180", "latex": r"\text{Rotation } 180^\circ\text{: } (x,y)\to(-x,-y)"},
        {"name": "Rotation 270 CCW", "latex": r"\text{Rotation } 270^\circ \text{ CCW: } (x,y)\to(y,-x)"},
        {"name": "Dilation", "latex": r"\text{Dilation: } (x,y)\to(kx,ky)"},
    ],
}
