"""
GEOMETRY formulas
"""

CLASS_NAME = "GEOMETRY"

FORMULAS = {
    "Basic Angle Relationships": [
        { "id": "geometry.supplementary","name": "Supplementary", "latex": r"\text{Supplementary: } a+b=180^\circ"},
        { "id": "geometry.complementary","name": "Complementary", "latex": r"\text{Complementary: } a+b=90^\circ"},
        { "id": "geometry.vertical-angles","name": "Vertical Angles", "latex": r"\text{Vertical angles are congruent}"},
        { "id": "geometry.linear-pair","name": "Linear Pair", "latex": r"\text{Linear pair: supplementary and adjacent}"},
    ],
    "Parallel Lines and Transversals": [
        { "id": "geometry.corresponding-angles","name": "Corresponding Angles", "latex": r"\text{Corresponding angles are congruent}"},
        { "id": "geometry.alternate-interior","name": "Alternate Interior", "latex": r"\text{Alternate interior angles are congruent}"},
        { "id": "geometry.alternate-exterior","name": "Alternate Exterior", "latex": r"\text{Alternate exterior angles are congruent}"},
        { "id": "geometry.co-interior","name": "Co-interior", "latex": r"\text{Co-interior (same-side interior) angles are supplementary}"},
    ],
    "Triangles": [
        { "id": "geometry.angle-sum","name": "Angle Sum", "latex": r"A+B+C=180^\circ"},
        { "id": "geometry.exterior-angle","name": "Exterior Angle", "latex": r"\text{Exterior angle} = \text{sum of two remote interior angles}"},
        { "id": "geometry.area","name": "Area", "latex": r"A=\frac{1}{2}bh"},
        { "id": "geometry.heron-s-formula","name": "Heron's Formula", "latex": r"A=\sqrt{s(s-a)(s-b)(s-c)} \quad s=\frac{a+b+c}{2}"},
        { "id": "geometry.triangle-inequality","name": "Triangle Inequality", "latex": r"a+b>c"},
    ],
    "Pythagorean Theorem": [
        { "id": "geometry.theorem","name": "Theorem", "latex": r"a^2+b^2=c^2"},
        { "id": "geometry.solve-for-c","name": "Solve for c", "latex": r"c=\sqrt{a^2+b^2}"},
        { "id": "geometry.common-triples","name": "Common Triples", "latex": r"\text{Common triples: } (3,4,5),\;(5,12,13),\;(8,15,17),\;(7,24,25)"},
    ],
    "Similar and Congruent Triangles": [
        { "id": "geometry.congruence-rules","name": "Congruence Rules", "latex": r"\text{Congruence: SSS, SAS, ASA, AAS, HL}"},
        { "id": "geometry.similarity-rules","name": "Similarity Rules", "latex": r"\text{Similarity: AA, SAS, SSS}"},
        { "id": "geometry.proportional-sides","name": "Proportional Sides", "latex": r"\frac{a_1}{a_2}=\frac{b_1}{b_2}=\frac{c_1}{c_2}"},
        { "id": "geometry.area-ratio","name": "Area Ratio", "latex": r"\frac{A_1}{A_2}=\left(\frac{s_1}{s_2}\right)^2"},
    ],
    "Quadrilaterals": [
        { "id": "geometry.interior-angles","name": "Interior Angles", "latex": r"\text{Sum of interior angles} = 360^\circ"},
        { "id": "geometry.rectangle-square","name": "Rectangle/Square", "latex": r"A_{\text{rect}}=lw \quad\quad A_{\text{square}}=s^2"},
        { "id": "geometry.parallelogram","name": "Parallelogram", "latex": r"A_{\text{parallelogram}}=bh"},
        { "id": "geometry.trapezoid","name": "Trapezoid", "latex": r"A_{\text{trapezoid}}=\frac{1}{2}(b_1+b_2)h"},
        { "id": "geometry.rhombus","name": "Rhombus", "latex": r"A_{\text{rhombus}}=\frac{1}{2}d_1 d_2"},
    ],
    "Polygons": [
        { "id": "geometry.interior-sum","name": "Interior Sum", "latex": r"\text{Sum of interior angles}=(n-2)\cdot 180^\circ"},
        { "id": "geometry.interior-angle","name": "Interior Angle", "latex": r"\text{Each interior angle (regular)}=\frac{(n-2)\cdot 180^\circ}{n}"},
        { "id": "geometry.exterior-angle-polygons","name": "Exterior Angle", "latex": r"\text{Each exterior angle (regular)}=\frac{360^\circ}{n}"},
        { "id": "geometry.diagonals","name": "Diagonals", "latex": r"\text{Number of diagonals}=\frac{n(n-3)}{2}"},
    ],
    "Circles": [
        { "id": "geometry.circumference","name": "Circumference", "latex": r"C=2\pi r=\pi d"},
        { "id": "geometry.area-circles","name": "Area", "latex": r"A=\pi r^2"},
        { "id": "geometry.arc-length","name": "Arc Length", "latex": r"\text{Arc length}=\frac{\theta}{360}\cdot 2\pi r"},
        { "id": "geometry.sector-area","name": "Sector Area", "latex": r"\text{Sector area}=\frac{\theta}{360}\cdot\pi r^2"},
        { "id": "geometry.inscribed-angle","name": "Inscribed Angle", "latex": r"\text{Inscribed angle}=\frac{1}{2}\text{(intercepted arc)}"},
        { "id": "geometry.central-angle","name": "Central Angle", "latex": r"\text{Central angle}=\text{intercepted arc}"},
    ],
    "Circle Theorems": [
        { "id": "geometry.tangent-radius","name": "Tangent-Radius", "latex": r"\text{Tangent} \perp \text{radius at point of tangency}"},
        { "id": "geometry.equal-tangents","name": "Equal Tangents", "latex": r"\text{Two tangents from external point are equal}"},
        { "id": "geometry.intersecting-chords","name": "Intersecting Chords", "latex": r"\text{Intersecting chords: } (a)(b)=(c)(d)"},
        { "id": "geometry.secant-secant","name": "Secant-Secant", "latex": r"\text{Secant-secant: } a(a+b)=c(c+d)"},
        { "id": "geometry.secant-tangent","name": "Secant-Tangent", "latex": r"\text{Secant-tangent: } t^2=a(a+b)"},
    ],
    "Coordinate Geometry": [
        { "id": "geometry.distance-formula","name": "Distance Formula", "latex": r"d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}"},
        { "id": "geometry.midpoint-formula","name": "Midpoint Formula", "latex": r"M=\left(\frac{x_1+x_2}{2},\;\frac{y_1+y_2}{2}\right)"},
        { "id": "geometry.circle-equation","name": "Circle Equation", "latex": r"(x-h)^2+(y-k)^2=r^2"},
    ],
    "Surface Area and Volume": [
        { "id": "geometry.prism","name": "Prism", "latex": r"V_{\text{prism}}=Bh \quad\quad SA_{\text{prism}}=2B+Ph"},
        { "id": "geometry.cylinder","name": "Cylinder", "latex": r"V_{\text{cylinder}}=\pi r^2 h \quad\quad SA_{\text{cylinder}}=2\pi r^2+2\pi rh"},
        { "id": "geometry.pyramid","name": "Pyramid", "latex": r"V_{\text{pyramid}}=\frac{1}{3}Bh"},
        { "id": "geometry.cone","name": "Cone", "latex": r"V_{\text{cone}}=\frac{1}{3}\pi r^2 h \quad\quad SA_{\text{cone}}=\pi r^2+\pi r l"},
        { "id": "geometry.sphere","name": "Sphere", "latex": r"V_{\text{sphere}}=\frac{4}{3}\pi r^3 \quad\quad SA_{\text{sphere}}=4\pi r^2"},
    ],
    "Transformations": [
        { "id": "geometry.translation","name": "Translation", "latex": r"\text{Translation: } (x,y)\to(x+a,\;y+b)"},
        { "id": "geometry.reflection-x-axis","name": "Reflection x-axis", "latex": r"\text{Reflection over } x\text{-axis: } (x,y)\to(x,-y)"},
        { "id": "geometry.reflection-y-axis","name": "Reflection y-axis", "latex": r"\text{Reflection over } y\text{-axis: } (x,y)\to(-x,y)"},
        { "id": "geometry.reflection-y-x","name": "Reflection y=x", "latex": r"\text{Reflection over } y=x\text{: } (x,y)\to(y,x)"},
        { "id": "geometry.rotation-90-ccw","name": "Rotation 90 CCW", "latex": r"\text{Rotation } 90^\circ \text{ CCW: } (x,y)\to(-y,x)"},
        { "id": "geometry.rotation-180","name": "Rotation 180", "latex": r"\text{Rotation } 180^\circ\text{: } (x,y)\to(-x,-y)"},
        { "id": "geometry.rotation-270-ccw","name": "Rotation 270 CCW", "latex": r"\text{Rotation } 270^\circ \text{ CCW: } (x,y)\to(y,-x)"},
        { "id": "geometry.dilation","name": "Dilation", "latex": r"\text{Dilation: } (x,y)\to(kx,ky)"},
    ],
}
