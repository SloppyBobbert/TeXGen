from decimal import Decimal, InvalidOperation

from django.db import migrations


FROZEN_LEGACY_FORMULA_ENTRIES = ((('ALGEBRA I', 'Absolute Value', 'Definition'), 'algebra-i.definition'),
 (('ALGEBRA I', 'Absolute Value', 'Product'), 'algebra-i.product'),
 (('ALGEBRA I', 'Absolute Value', 'Quotient'), 'algebra-i.quotient'),
 (('ALGEBRA I', 'Absolute Value', 'Triangle Inequality'), 'algebra-i.triangle-inequality'),
 (('ALGEBRA I', 'Decimals and Percents', 'Decimal to Percent'), 'algebra-i.decimal-to-percent'),
 (('ALGEBRA I', 'Decimals and Percents', 'Part Formula'), 'algebra-i.part-formula'),
 (('ALGEBRA I', 'Decimals and Percents', 'Percent Formula'), 'algebra-i.percent-formula'),
 (('ALGEBRA I', 'Decimals and Percents', 'Percent to Decimal'), 'algebra-i.percent-to-decimal'),
 (('ALGEBRA I', 'Exponents', 'Negative Exponent'), 'algebra-i.negative-exponent'),
 (('ALGEBRA I', 'Exponents', 'Power Rule'), 'algebra-i.power-rule'),
 (('ALGEBRA I', 'Exponents', 'Product Rule'), 'algebra-i.product-rule'),
 (('ALGEBRA I', 'Exponents', 'Quotient Rule'), 'algebra-i.quotient-rule'),
 (('ALGEBRA I', 'Exponents', 'Radical to Exponent'), 'algebra-i.radical-to-exponent'),
 (('ALGEBRA I', 'Exponents', 'Zero Exponent'), 'algebra-i.zero-exponent'),
 (('ALGEBRA I', 'Functions', 'Domain'), 'algebra-i.domain'),
 (('ALGEBRA I', 'Functions', 'Function Notation'), 'algebra-i.function-notation'),
 (('ALGEBRA I', 'Functions', 'Range'), 'algebra-i.range'),
 (('ALGEBRA I', 'Functions', 'Vertical Line Test'), 'algebra-i.vertical-line-test'),
 (('ALGEBRA I', 'Inequalities', 'Absolute Greater Than'), 'algebra-i.absolute-greater-than'),
 (('ALGEBRA I', 'Inequalities', 'Absolute Less Than'), 'algebra-i.absolute-less-than'),
 (('ALGEBRA I', 'Inequalities', 'Multiply by Negative'), 'algebra-i.multiply-by-negative'),
 (('ALGEBRA I', 'Inequalities', 'Multiply by Positive'), 'algebra-i.multiply-by-positive'),
 (('ALGEBRA I', 'Integer Rules', 'Negative x Negative'), 'algebra-i.negative-x-negative'),
 (('ALGEBRA I', 'Integer Rules', 'Negative x Positive'), 'algebra-i.negative-x-positive'),
 (('ALGEBRA I', 'Integer Rules', 'Positive x Negative'), 'algebra-i.positive-x-negative'),
 (('ALGEBRA I', 'Integer Rules', 'Positive x Positive'), 'algebra-i.positive-x-positive'),
 (('ALGEBRA I', 'Integer Rules', 'Subtracting Negatives'), 'algebra-i.subtracting-negatives'),
 (('ALGEBRA I', 'Linear Equations', 'Point-Slope Form'), 'algebra-i.point-slope-form'),
 (('ALGEBRA I', 'Linear Equations', 'Slope Formula'), 'algebra-i.slope-formula'),
 (('ALGEBRA I', 'Linear Equations', 'Slope-Intercept Form'), 'algebra-i.slope-intercept-form'),
 (('ALGEBRA I', 'Linear Equations', 'Standard Form'), 'algebra-i.standard-form'),
 (('ALGEBRA I', 'Mean, Median, Mode', 'Mean'), 'algebra-i.mean'),
 (('ALGEBRA I', 'Mean, Median, Mode', 'Median'), 'algebra-i.median'),
 (('ALGEBRA I', 'Mean, Median, Mode', 'Mode'), 'algebra-i.mode'),
 (('ALGEBRA I', 'Polynomials', 'Difference of Squares'), 'algebra-i.difference-of-squares'),
 (('ALGEBRA I', 'Polynomials', 'FOIL'), 'algebra-i.foil'),
 (('ALGEBRA I', 'Polynomials', 'Perfect Square (Addition)'), 'algebra-i.perfect-square-addition'),
 (('ALGEBRA I', 'Polynomials', 'Perfect Square (Subtraction)'), 'algebra-i.perfect-square-subtraction'),
 (('ALGEBRA I', 'Quadratic Equations', 'Axis of Symmetry'), 'algebra-i.axis-of-symmetry'),
 (('ALGEBRA I', 'Quadratic Equations', 'Quadratic Formula'), 'algebra-i.quadratic-formula'),
 (('ALGEBRA I', 'Quadratic Equations', 'Standard Form'), 'algebra-i.standard-form-quadratic-equations'),
 (('ALGEBRA I', 'Quadratic Equations', 'Vertex Form'), 'algebra-i.vertex-form'),
 (('ALGEBRA I', 'Radicals', 'Like Radicals'), 'algebra-i.like-radicals'),
 (('ALGEBRA I', 'Radicals', 'Product Rule'), 'algebra-i.product-rule-radicals'),
 (('ALGEBRA I', 'Radicals', 'Quotient Rule'), 'algebra-i.quotient-rule-radicals'),
 (('ALGEBRA I', 'Radicals', 'Square of Square Root'), 'algebra-i.square-of-square-root'),
 (('ALGEBRA I', 'Rational Expressions', 'Division'), 'algebra-i.division'),
 (('ALGEBRA I', 'Rational Expressions', 'Multiplication'), 'algebra-i.multiplication'),
 (('ALGEBRA II', 'Complex Numbers', 'Addition'), 'algebra-ii.addition'),
 (('ALGEBRA II', 'Complex Numbers', 'Imaginary Unit'), 'algebra-ii.imaginary-unit'),
 (('ALGEBRA II', 'Complex Numbers', 'Magnitude'), 'algebra-ii.magnitude'),
 (('ALGEBRA II', 'Complex Numbers', 'Multiplication'), 'algebra-ii.multiplication'),
 (('ALGEBRA II', 'Conic Sections', 'Circle'), 'algebra-ii.circle'),
 (('ALGEBRA II', 'Conic Sections', 'Ellipse'), 'algebra-ii.ellipse'),
 (('ALGEBRA II', 'Conic Sections', 'Focal Distance'), 'algebra-ii.focal-distance'),
 (('ALGEBRA II', 'Conic Sections', 'Hyperbola'), 'algebra-ii.hyperbola'),
 (('ALGEBRA II', 'Conic Sections', 'Parabola'), 'algebra-ii.parabola'),
 (('ALGEBRA II', 'Exponential Functions', 'Basic Form'), 'algebra-ii.basic-form'),
 (('ALGEBRA II', 'Exponential Functions', 'Compound Interest'), 'algebra-ii.compound-interest'),
 (('ALGEBRA II', 'Exponential Functions', 'Continuous Growth'), 'algebra-ii.continuous-growth'),
 (('ALGEBRA II', 'Exponential Functions', 'Growth/Decay'), 'algebra-ii.growth-decay'),
 (('ALGEBRA II', 'Logarithms', 'Change of Base'), 'algebra-ii.change-of-base'),
 (('ALGEBRA II', 'Logarithms', 'Definition'), 'algebra-ii.definition'),
 (('ALGEBRA II', 'Logarithms', 'Power Rule'), 'algebra-ii.power-rule'),
 (('ALGEBRA II', 'Logarithms', 'Product Rule'), 'algebra-ii.product-rule'),
 (('ALGEBRA II', 'Logarithms', 'Quotient Rule'), 'algebra-ii.quotient-rule'),
 (('ALGEBRA II', 'Logarithms', 'Special Values'), 'algebra-ii.special-values'),
 (('ALGEBRA II', 'Matrices', '2x2 Inverse'), 'algebra-ii.2x2-inverse'),
 (('ALGEBRA II', 'Matrices', 'Determinant'), 'algebra-ii.determinant'),
 (('ALGEBRA II', 'Matrices', 'Identity Property'), 'algebra-ii.identity-property'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Binomial Coefficient'),
  'algebra-ii.binomial-coefficient'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', "Descartes' Rule"), 'algebra-ii.descartes-rule'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Expansion'), 'algebra-ii.expansion'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Factor Theorem'), 'algebra-ii.factor-theorem'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Factorial'), 'algebra-ii.factorial'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Fundamental Theorem'),
  'algebra-ii.fundamental-theorem'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Rational Root Theorem'),
  'algebra-ii.rational-root-theorem'),
 (('ALGEBRA II', 'Polynomial Theorems and Binomial Expansion', 'Remainder Theorem'), 'algebra-ii.remainder-theorem'),
 (('ALGEBRA II', 'Sequences and Series', 'Arithmetic Sequence'), 'algebra-ii.arithmetic-sequence'),
 (('ALGEBRA II', 'Sequences and Series', 'Arithmetic Sum'), 'algebra-ii.arithmetic-sum'),
 (('ALGEBRA II', 'Sequences and Series', 'Geometric Sequence'), 'algebra-ii.geometric-sequence'),
 (('ALGEBRA II', 'Sequences and Series', 'Geometric Sum'), 'algebra-ii.geometric-sum'),
 (('ALGEBRA II', 'Sequences and Series', 'Infinite Geometric Sum'), 'algebra-ii.infinite-geometric-sum'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Exponential'), 'calculus-i.exponential-basic-antiderivatives'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Inverse Trig'), 'calculus-i.inverse-trig'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Power Rule'), 'calculus-i.power-rule-basic-antiderivatives'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Reciprocal'), 'calculus-i.reciprocal'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Trig Basic'), 'calculus-i.trig-basic'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Trig Product'), 'calculus-i.trig-product'),
 (('CALCULUS I', 'Basic Antiderivatives', 'Trig Square'), 'calculus-i.trig-square'),
 (('CALCULUS I', 'Common Derivatives', 'Arcsin/Arccos'), 'calculus-i.arcsin-arccos'),
 (('CALCULUS I', 'Common Derivatives', 'Arctan'), 'calculus-i.arctan'),
 (('CALCULUS I', 'Common Derivatives', 'Exponential'), 'calculus-i.exponential'),
 (('CALCULUS I', 'Common Derivatives', 'Logarithmic'), 'calculus-i.logarithmic'),
 (('CALCULUS I', 'Common Derivatives', 'Power Rule'), 'calculus-i.power-rule'),
 (('CALCULUS I', 'Common Derivatives', 'Secant/Cosecant'), 'calculus-i.secant-cosecant'),
 (('CALCULUS I', 'Common Derivatives', 'Sine/Cosine'), 'calculus-i.sine-cosine'),
 (('CALCULUS I', 'Common Derivatives', 'Tangent/Cotangent'), 'calculus-i.tangent-cotangent'),
 (('CALCULUS I', 'Core Theorems of Calculus', 'Intermediate Value Theorem'), 'calculus-i.intermediate-value-theorem'),
 (('CALCULUS I', 'Core Theorems of Calculus', 'Mean Value Theorem'), 'calculus-i.mean-value-theorem'),
 (('CALCULUS I', 'Core Theorems of Calculus', 'Part 1 (Leibniz)'), 'calculus-i.part-1-leibniz'),
 (('CALCULUS I', 'Core Theorems of Calculus', 'Part 2 (Evaluation)'), 'calculus-i.part-2-evaluation'),
 (('CALCULUS I', 'Core Theorems of Calculus', "Rolle's Theorem"), 'calculus-i.rolle-s-theorem'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Alternate Definition'), 'calculus-i.alternate-definition'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Chain Rule'), 'calculus-i.chain-rule'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Constant Multiple'), 'calculus-i.constant-multiple'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Limit Definition'), 'calculus-i.limit-definition'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Product Rule'), 'calculus-i.product-rule'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Quotient Rule'), 'calculus-i.quotient-rule'),
 (('CALCULUS I', 'Derivative Definitions and Rules', 'Sum/Diff Rule'), 'calculus-i.sum-diff-rule'),
 (('CALCULUS I', 'Limits', 'Important Limit 1'), 'calculus-i.important-limit-1'),
 (('CALCULUS I', 'Limits', 'Important Limit 2'), 'calculus-i.important-limit-2'),
 (('CALCULUS I', 'Limits', 'Infinity Limit'), 'calculus-i.infinity-limit'),
 (('CALCULUS I', 'Limits', 'Power Limit'), 'calculus-i.power-limit'),
 (('CALCULUS I', 'Limits', 'Product Limit'), 'calculus-i.product-limit'),
 (('CALCULUS I', 'Limits', 'Quotient Limit'), 'calculus-i.quotient-limit'),
 (('CALCULUS I', 'Limits', 'Sum/Diff Limit'), 'calculus-i.sum-diff-limit'),
 (('CALCULUS I', 'Limits', 'e Definition'), 'calculus-i.e-definition'),
 (('CALCULUS II', 'Applications of Integration', 'Arc Length'), 'calculus-ii.arc-length'),
 (('CALCULUS II', 'Applications of Integration', 'Area Between Curves'), 'calculus-ii.area-between-curves'),
 (('CALCULUS II', 'Applications of Integration', 'Disk Method'), 'calculus-ii.disk-method'),
 (('CALCULUS II', 'Applications of Integration', 'Shell Method'), 'calculus-ii.shell-method'),
 (('CALCULUS II', 'Applications of Integration', 'Surface of Revolution'), 'calculus-ii.surface-of-revolution'),
 (('CALCULUS II', 'Applications of Integration', 'Washer Method'), 'calculus-ii.washer-method'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Infinite Both Bounds'),
  'calculus-ii.infinite-both-bounds'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Infinite Upper Bound'),
  'calculus-ii.infinite-upper-bound'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Integration by Parts'),
  'calculus-ii.integration-by-parts'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Partial Fractions'),
  'calculus-ii.partial-fractions'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Trig Substitution 1'),
  'calculus-ii.trig-substitution-1'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Trig Substitution 2'),
  'calculus-ii.trig-substitution-2'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Trig Substitution 3'),
  'calculus-ii.trig-substitution-3'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'U-Substitution'), 'calculus-ii.u-substitution'),
 (('CALCULUS II', 'Integration Techniques and Improper Integrals', 'Unbounded Integrand'),
  'calculus-ii.unbounded-integrand'),
 (('CALCULUS II', 'Parametric & Polar', 'Arc Length (Parametric)'), 'calculus-ii.arc-length-parametric'),
 (('CALCULUS II', 'Parametric & Polar', 'Derivative (Parametric)'), 'calculus-ii.derivative-parametric'),
 (('CALCULUS II', 'Parametric & Polar', 'Polar Arc Length'), 'calculus-ii.polar-arc-length'),
 (('CALCULUS II', 'Parametric & Polar', 'Polar Area'), 'calculus-ii.polar-area'),
 (('CALCULUS II', 'Parametric & Polar', 'Second Derivative (Parametric)'), 'calculus-ii.second-derivative-parametric'),
 (('CALCULUS II', 'Power & Taylor Series', 'Cosine Series'), 'calculus-ii.cosine-series'),
 (('CALCULUS II', 'Power & Taylor Series', 'Geometric Series (1/(1-x))'), 'calculus-ii.geometric-series-1-1-x'),
 (('CALCULUS II', 'Power & Taylor Series', 'Radius of Convergence'), 'calculus-ii.radius-of-convergence'),
 (('CALCULUS II', 'Power & Taylor Series', 'Sine Series'), 'calculus-ii.sine-series'),
 (('CALCULUS II', 'Power & Taylor Series', 'Taylor Series'), 'calculus-ii.taylor-series'),
 (('CALCULUS II', 'Power & Taylor Series', 'e^x Series'), 'calculus-ii.e-x-series'),
 (('CALCULUS II', 'Power & Taylor Series', 'ln(1+x) Series'), 'calculus-ii.ln-1-x-series'),
 (('CALCULUS II', 'Sequences & Series', 'Geometric Series'), 'calculus-ii.geometric-series'),
 (('CALCULUS II', 'Sequences & Series', 'P-Series'), 'calculus-ii.p-series'),
 (('CALCULUS II', 'Sequences & Series', 'Ratio Test'), 'calculus-ii.ratio-test'),
 (('CALCULUS II', 'Sequences & Series', 'Root Test'), 'calculus-ii.root-test'),
 (('CALCULUS III', 'Multiple Integrals', 'Cylindrical Coordinates'), 'calculus-iii.cylindrical-coordinates'),
 (('CALCULUS III', 'Multiple Integrals', "Fubini's Theorem"), 'calculus-iii.fubini-s-theorem'),
 (('CALCULUS III', 'Multiple Integrals', 'Jacobian'), 'calculus-iii.jacobian'),
 (('CALCULUS III', 'Multiple Integrals', 'Polar Coordinates'), 'calculus-iii.polar-coordinates'),
 (('CALCULUS III', 'Multiple Integrals', 'Spherical Coordinates'), 'calculus-iii.spherical-coordinates'),
 (('CALCULUS III', 'Multiple Integrals', 'Spherical Volume Element'), 'calculus-iii.spherical-volume-element'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Chain Rule'), 'calculus-iii.chain-rule'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Definition'), 'calculus-iii.definition'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Directional Derivative'),
  'calculus-iii.directional-derivative'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Gradient'), 'calculus-iii.gradient'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Lagrange Multipliers'),
  'calculus-iii.lagrange-multipliers'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Local Extremes'), 'calculus-iii.local-extremes'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Second Derivative Test'),
  'calculus-iii.second-derivative-test'),
 (('CALCULUS III', 'Partial Derivatives and Optimization', 'Total Differential'), 'calculus-iii.total-differential'),
 (('CALCULUS III', 'Vector Formulas', 'Component'), 'calculus-iii.component'),
 (('CALCULUS III', 'Vector Formulas', 'Cross Product'), 'calculus-iii.cross-product'),
 (('CALCULUS III', 'Vector Formulas', 'Curl'), 'calculus-iii.curl'),
 (('CALCULUS III', 'Vector Formulas', 'Divergence'), 'calculus-iii.divergence'),
 (('CALCULUS III', 'Vector Formulas', 'Divergence Theorem'), 'calculus-iii.divergence-theorem'),
 (('CALCULUS III', 'Vector Formulas', 'Dot Product'), 'calculus-iii.dot-product'),
 (('CALCULUS III', 'Vector Formulas', 'Fundamental Theorem for Line Integrals'),
  'calculus-iii.fundamental-theorem-for-line-integrals'),
 (('CALCULUS III', 'Vector Formulas', "Green's Theorem"), 'calculus-iii.green-s-theorem'),
 (('CALCULUS III', 'Vector Formulas', 'Line Equation'), 'calculus-iii.line-equation'),
 (('CALCULUS III', 'Vector Formulas', 'Line Integral'), 'calculus-iii.line-integral'),
 (('CALCULUS III', 'Vector Formulas', 'Plane Equation'), 'calculus-iii.plane-equation'),
 (('CALCULUS III', 'Vector Formulas', 'Projection'), 'calculus-iii.projection'),
 (('CALCULUS III', 'Vector Formulas', "Stokes' Theorem"), 'calculus-iii.stokes-theorem'),
 (('GEOMETRY', 'Basic Angle Relationships', 'Complementary'), 'geometry.complementary'),
 (('GEOMETRY', 'Basic Angle Relationships', 'Linear Pair'), 'geometry.linear-pair'),
 (('GEOMETRY', 'Basic Angle Relationships', 'Supplementary'), 'geometry.supplementary'),
 (('GEOMETRY', 'Basic Angle Relationships', 'Vertical Angles'), 'geometry.vertical-angles'),
 (('GEOMETRY', 'Circle Theorems', 'Equal Tangents'), 'geometry.equal-tangents'),
 (('GEOMETRY', 'Circle Theorems', 'Intersecting Chords'), 'geometry.intersecting-chords'),
 (('GEOMETRY', 'Circle Theorems', 'Secant-Secant'), 'geometry.secant-secant'),
 (('GEOMETRY', 'Circle Theorems', 'Secant-Tangent'), 'geometry.secant-tangent'),
 (('GEOMETRY', 'Circle Theorems', 'Tangent-Radius'), 'geometry.tangent-radius'),
 (('GEOMETRY', 'Circles', 'Arc Length'), 'geometry.arc-length'),
 (('GEOMETRY', 'Circles', 'Area'), 'geometry.area-circles'),
 (('GEOMETRY', 'Circles', 'Central Angle'), 'geometry.central-angle'),
 (('GEOMETRY', 'Circles', 'Circumference'), 'geometry.circumference'),
 (('GEOMETRY', 'Circles', 'Inscribed Angle'), 'geometry.inscribed-angle'),
 (('GEOMETRY', 'Circles', 'Sector Area'), 'geometry.sector-area'),
 (('GEOMETRY', 'Coordinate Geometry', 'Circle Equation'), 'geometry.circle-equation'),
 (('GEOMETRY', 'Coordinate Geometry', 'Distance Formula'), 'geometry.distance-formula'),
 (('GEOMETRY', 'Coordinate Geometry', 'Midpoint Formula'), 'geometry.midpoint-formula'),
 (('GEOMETRY', 'Parallel Lines and Transversals', 'Alternate Exterior'), 'geometry.alternate-exterior'),
 (('GEOMETRY', 'Parallel Lines and Transversals', 'Alternate Interior'), 'geometry.alternate-interior'),
 (('GEOMETRY', 'Parallel Lines and Transversals', 'Co-interior'), 'geometry.co-interior'),
 (('GEOMETRY', 'Parallel Lines and Transversals', 'Corresponding Angles'), 'geometry.corresponding-angles'),
 (('GEOMETRY', 'Polygons', 'Diagonals'), 'geometry.diagonals'),
 (('GEOMETRY', 'Polygons', 'Exterior Angle'), 'geometry.exterior-angle-polygons'),
 (('GEOMETRY', 'Polygons', 'Interior Angle'), 'geometry.interior-angle'),
 (('GEOMETRY', 'Polygons', 'Interior Sum'), 'geometry.interior-sum'),
 (('GEOMETRY', 'Pythagorean Theorem', 'Common Triples'), 'geometry.common-triples'),
 (('GEOMETRY', 'Pythagorean Theorem', 'Solve for c'), 'geometry.solve-for-c'),
 (('GEOMETRY', 'Pythagorean Theorem', 'Theorem'), 'geometry.theorem'),
 (('GEOMETRY', 'Quadrilaterals', 'Interior Angles'), 'geometry.interior-angles'),
 (('GEOMETRY', 'Quadrilaterals', 'Parallelogram'), 'geometry.parallelogram'),
 (('GEOMETRY', 'Quadrilaterals', 'Rectangle/Square'), 'geometry.rectangle-square'),
 (('GEOMETRY', 'Quadrilaterals', 'Rhombus'), 'geometry.rhombus'),
 (('GEOMETRY', 'Quadrilaterals', 'Trapezoid'), 'geometry.trapezoid'),
 (('GEOMETRY', 'Similar and Congruent Triangles', 'Area Ratio'), 'geometry.area-ratio'),
 (('GEOMETRY', 'Similar and Congruent Triangles', 'Congruence Rules'), 'geometry.congruence-rules'),
 (('GEOMETRY', 'Similar and Congruent Triangles', 'Proportional Sides'), 'geometry.proportional-sides'),
 (('GEOMETRY', 'Similar and Congruent Triangles', 'Similarity Rules'), 'geometry.similarity-rules'),
 (('GEOMETRY', 'Surface Area and Volume', 'Cone'), 'geometry.cone'),
 (('GEOMETRY', 'Surface Area and Volume', 'Cylinder'), 'geometry.cylinder'),
 (('GEOMETRY', 'Surface Area and Volume', 'Prism'), 'geometry.prism'),
 (('GEOMETRY', 'Surface Area and Volume', 'Pyramid'), 'geometry.pyramid'),
 (('GEOMETRY', 'Surface Area and Volume', 'Sphere'), 'geometry.sphere'),
 (('GEOMETRY', 'Transformations', 'Dilation'), 'geometry.dilation'),
 (('GEOMETRY', 'Transformations', 'Reflection x-axis'), 'geometry.reflection-x-axis'),
 (('GEOMETRY', 'Transformations', 'Reflection y-axis'), 'geometry.reflection-y-axis'),
 (('GEOMETRY', 'Transformations', 'Reflection y=x'), 'geometry.reflection-y-x'),
 (('GEOMETRY', 'Transformations', 'Rotation 180'), 'geometry.rotation-180'),
 (('GEOMETRY', 'Transformations', 'Rotation 270 CCW'), 'geometry.rotation-270-ccw'),
 (('GEOMETRY', 'Transformations', 'Rotation 90 CCW'), 'geometry.rotation-90-ccw'),
 (('GEOMETRY', 'Transformations', 'Translation'), 'geometry.translation'),
 (('GEOMETRY', 'Triangles', 'Angle Sum'), 'geometry.angle-sum'),
 (('GEOMETRY', 'Triangles', 'Area'), 'geometry.area'),
 (('GEOMETRY', 'Triangles', 'Exterior Angle'), 'geometry.exterior-angle'),
 (('GEOMETRY', 'Triangles', "Heron's Formula"), 'geometry.heron-s-formula'),
 (('GEOMETRY', 'Triangles', 'Triangle Inequality'), 'geometry.triangle-inequality'),
 (('LINEAR ALGEBRA I', '2x2 Systems', '2x2 Determinant'), 'linear-algebra-i.2x2-determinant'),
 (('LINEAR ALGEBRA I', '2x2 Systems', '2x2 Inverse'), 'linear-algebra-i.2x2-inverse'),
 (('LINEAR ALGEBRA I', 'Matrix Operations', 'Matrix Addition'), 'linear-algebra-i.matrix-addition'),
 (('LINEAR ALGEBRA I', 'Matrix Operations', 'Matrix-Vector Multiplication'),
  'linear-algebra-i.matrix-vector-multiplication'),
 (('LINEAR ALGEBRA I', 'Matrix Operations', 'Transpose'), 'linear-algebra-i.transpose'),
 (('LINEAR ALGEBRA I', 'Vector Basics', 'Dot Product'), 'linear-algebra-i.dot-product'),
 (('LINEAR ALGEBRA I', 'Vector Basics', 'Magnitude (L2 Norm)'), 'linear-algebra-i.magnitude-l2-norm'),
 (('LINEAR ALGEBRA I', 'Vector Basics', 'Scalar Multiplication'), 'linear-algebra-i.scalar-multiplication'),
 (('LINEAR ALGEBRA I', 'Vector Basics', 'Vector Addition'), 'linear-algebra-i.vector-addition'),
 (('LINEAR ALGEBRA II', 'Decompositions & Spaces', 'Diagonalization'), 'linear-algebra-ii.diagonalization'),
 (('LINEAR ALGEBRA II', 'Decompositions & Spaces', 'Projection Formula'), 'linear-algebra-ii.projection-formula'),
 (('LINEAR ALGEBRA II', 'Decompositions & Spaces', 'Rank-Nullity Theorem'), 'linear-algebra-ii.rank-nullity-theorem'),
 (('LINEAR ALGEBRA II', 'Eigenvalues & Eigenvectors', 'Characteristic Equation'),
  'linear-algebra-ii.characteristic-equation'),
 (('LINEAR ALGEBRA II', 'Eigenvalues & Eigenvectors', 'Eigenvector Definition'),
  'linear-algebra-ii.eigenvector-definition'),
 (('LINEAR ALGEBRA II', 'Matrix Properties', 'Invertibility Condition'), 'linear-algebra-ii.invertibility-condition'),
 (('LINEAR ALGEBRA II', 'Matrix Properties', 'Matrix Multiplication Property'),
  'linear-algebra-ii.matrix-multiplication-property'),
 (('LINEAR ALGEBRA II', 'Matrix Properties', 'Orthogonality'), 'linear-algebra-ii.orthogonality'),
 (('PHYSICS I', 'Dynamics (Forces)', 'Force of Gravity (Weight)'), 'physics-i.force-of-gravity-weight'),
 (('PHYSICS I', 'Dynamics (Forces)', "Hooke's Law (Springs)"), 'physics-i.hooke-s-law-springs'),
 (('PHYSICS I', 'Dynamics (Forces)', 'Kinetic Friction'), 'physics-i.kinetic-friction'),
 (('PHYSICS I', 'Dynamics (Forces)', "Newton's Second Law"), 'physics-i.newton-s-second-law'),
 (('PHYSICS I', 'Dynamics (Forces)', 'Static Friction'), 'physics-i.static-friction'),
 (('PHYSICS I', 'Electricity & Waves', 'Electrical Power'), 'physics-i.electrical-power'),
 (('PHYSICS I', 'Electricity & Waves', "Ohm's Law"), 'physics-i.ohm-s-law'),
 (('PHYSICS I', 'Electricity & Waves', 'Period and Frequency'), 'physics-i.period-and-frequency'),
 (('PHYSICS I', 'Electricity & Waves', 'Wave Speed'), 'physics-i.wave-speed'),
 (('PHYSICS I', 'Kinematics (Motion)', 'Average Acceleration'), 'physics-i.average-acceleration'),
 (('PHYSICS I', 'Kinematics (Motion)', 'Average Velocity'), 'physics-i.average-velocity'),
 (('PHYSICS I', 'Kinematics (Motion)', 'Kinematics 1 (Velocity)'), 'physics-i.kinematics-1-velocity'),
 (('PHYSICS I', 'Kinematics (Motion)', 'Kinematics 2 (Position)'), 'physics-i.kinematics-2-position'),
 (('PHYSICS I', 'Kinematics (Motion)', 'Kinematics 3 (Velocity Squared)'), 'physics-i.kinematics-3-velocity-squared'),
 (('PHYSICS I', 'Momentum & Collisions', 'Conservation of Momentum'), 'physics-i.conservation-of-momentum'),
 (('PHYSICS I', 'Momentum & Collisions', 'Impulse-Momentum Theorem'), 'physics-i.impulse-momentum-theorem'),
 (('PHYSICS I', 'Momentum & Collisions', 'Momentum'), 'physics-i.momentum'),
 (('PHYSICS I', 'Work, Energy & Power', 'Elastic Potential Energy'), 'physics-i.elastic-potential-energy'),
 (('PHYSICS I', 'Work, Energy & Power', 'Gravitational Potential Energy'), 'physics-i.gravitational-potential-energy'),
 (('PHYSICS I', 'Work, Energy & Power', 'Kinetic Energy'), 'physics-i.kinetic-energy'),
 (('PHYSICS I', 'Work, Energy & Power', 'Power'), 'physics-i.power'),
 (('PHYSICS I', 'Work, Energy & Power', 'Work'), 'physics-i.work'),
 (('PHYSICS II', 'Circuits', 'Electrical Power'), 'physics-ii.electrical-power'),
 (('PHYSICS II', 'Circuits', 'Equivalent Resistance (Parallel)'), 'physics-ii.equivalent-resistance-parallel'),
 (('PHYSICS II', 'Circuits', 'Equivalent Resistance (Series)'), 'physics-ii.equivalent-resistance-series'),
 (('PHYSICS II', 'Circuits', "Ohm's Law"), 'physics-ii.ohm-s-law'),
 (('PHYSICS II', 'Electrostatics', 'Capacitance'), 'physics-ii.capacitance'),
 (('PHYSICS II', 'Electrostatics', "Coulomb's Law"), 'physics-ii.coulomb-s-law'),
 (('PHYSICS II', 'Electrostatics', 'Electric Field'), 'physics-ii.electric-field'),
 (('PHYSICS II', 'Electrostatics', 'Electric Potential (Voltage)'), 'physics-ii.electric-potential-voltage'),
 (('PHYSICS II', 'Magnetism', 'Magnetic Field of a Wire'), 'physics-ii.magnetic-field-of-a-wire'),
 (('PHYSICS II', 'Magnetism', 'Magnetic Flux'), 'physics-ii.magnetic-flux'),
 (('PHYSICS II', 'Magnetism', 'Magnetic Force on a Charge'), 'physics-ii.magnetic-force-on-a-charge'),
 (('PHYSICS II', 'Magnetism', 'Magnetic Force on a Wire'), 'physics-ii.magnetic-force-on-a-wire'),
 (('PHYSICS II', 'Waves & Optics', 'Index of Refraction'), 'physics-ii.index-of-refraction'),
 (('PHYSICS II', 'Waves & Optics', 'Magnification'), 'physics-ii.magnification'),
 (('PHYSICS II', 'Waves & Optics', "Snell's Law"), 'physics-ii.snell-s-law'),
 (('PHYSICS II', 'Waves & Optics', 'Thin Lens Equation'), 'physics-ii.thin-lens-equation'),
 (('PRE-ALGEBRA', 'Area and Perimeter', 'Circle Area/Circumference'), 'pre-algebra.circle-area-circumference'),
 (('PRE-ALGEBRA', 'Area and Perimeter', 'Rectangle Area/Perimeter'), 'pre-algebra.rectangle-area-perimeter'),
 (('PRE-ALGEBRA', 'Area and Perimeter', 'Rectangular Prism Volume'), 'pre-algebra.rectangular-prism-volume'),
 (('PRE-ALGEBRA', 'Area and Perimeter', 'Triangle Area'), 'pre-algebra.triangle-area'),
 (('PRE-ALGEBRA', 'Fractions, Ratios, and Proportions', 'Addition'), 'pre-algebra.addition'),
 (('PRE-ALGEBRA', 'Fractions, Ratios, and Proportions', 'Division'), 'pre-algebra.division'),
 (('PRE-ALGEBRA', 'Fractions, Ratios, and Proportions', 'Multiplication'), 'pre-algebra.multiplication'),
 (('PRE-ALGEBRA', 'Fractions, Ratios, and Proportions', 'Proportion'), 'pre-algebra.proportion'),
 (('PRE-ALGEBRA', 'Fractions, Ratios, and Proportions', 'Subtraction'), 'pre-algebra.subtraction'),
 (('PRE-ALGEBRA', 'Fractions, Ratios, and Proportions', 'Unit Rate'), 'pre-algebra.unit-rate'),
 (('PRE-ALGEBRA', 'Operations and Properties', 'Associative'), 'pre-algebra.associative'),
 (('PRE-ALGEBRA', 'Operations and Properties', 'Commutative'), 'pre-algebra.commutative'),
 (('PRE-ALGEBRA', 'Operations and Properties', 'Distributive'), 'pre-algebra.distributive'),
 (('PRE-ALGEBRA', 'Operations and Properties', 'Identity'), 'pre-algebra.identity'),
 (('PRE-ALGEBRA', 'Operations and Properties', 'Inverse'), 'pre-algebra.inverse'),
 (('PRE-ALGEBRA', 'Operations and Properties', 'PEMDAS Definition'), 'pre-algebra.pemdas-definition'),
 (('PRE-ALGEBRA', 'Solving Equations', 'Absolute Value'), 'pre-algebra.absolute-value'),
 (('PRE-ALGEBRA', 'Solving Equations', 'Linear Solution'), 'pre-algebra.linear-solution'),
 (('PRE-ALGEBRA', 'Solving Equations', 'Transitive Property'), 'pre-algebra.transitive-property'),
 (('PRECALCULUS', 'Conic Sections', 'Circle'), 'precalculus.circle'),
 (('PRECALCULUS', 'Conic Sections', 'Eccentricity'), 'precalculus.eccentricity'),
 (('PRECALCULUS', 'Conic Sections', 'Ellipse'), 'precalculus.ellipse'),
 (('PRECALCULUS', 'Conic Sections', 'Hyperbola'), 'precalculus.hyperbola'),
 (('PRECALCULUS', 'Conic Sections', 'Parabola'), 'precalculus.parabola'),
 (('PRECALCULUS', 'Functions', 'Composition'), 'precalculus.composition'),
 (('PRECALCULUS', 'Functions', 'Finding Inverse'), 'precalculus.finding-inverse'),
 (('PRECALCULUS', 'Functions', 'Inverse Property'), 'precalculus.inverse-property'),
 (('PRECALCULUS', 'Polar & Complex Polar', "De Moivre's Theorem"), 'precalculus.de-moivre-s-theorem'),
 (('PRECALCULUS', 'Polar & Complex Polar', "Euler's Form"), 'precalculus.euler-s-form'),
 (('PRECALCULUS', 'Polar & Complex Polar', 'Rectangular to Polar'), 'precalculus.rectangular-to-polar'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Arithmetic Sequence'), 'precalculus.arithmetic-sequence'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Arithmetic Series'), 'precalculus.arithmetic-series'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Binomial Coefficient'),
  'precalculus.binomial-coefficient'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Binomial Expansion'), 'precalculus.binomial-expansion'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Geometric Sequence'), 'precalculus.geometric-sequence'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Geometric Series'), 'precalculus.geometric-series'),
 (('PRECALCULUS', 'Sequences, Series, and Binomial Theorem', 'Infinite Geometric Series'),
  'precalculus.infinite-geometric-series'),
 (('STATISTICS I', 'Descriptive Statistics', 'Population Mean'), 'statistics-i.population-mean'),
 (('STATISTICS I', 'Descriptive Statistics', 'Sample Mean'), 'statistics-i.sample-mean'),
 (('STATISTICS I', 'Descriptive Statistics', 'Sample Standard Deviation'), 'statistics-i.sample-standard-deviation'),
 (('STATISTICS I', 'Descriptive Statistics', 'Z-Score'), 'statistics-i.z-score'),
 (('STATISTICS I', 'Distributions', 'Binomial Probability'), 'statistics-i.binomial-probability'),
 (('STATISTICS I', 'Distributions', 'Mean of Binomial Dist.'), 'statistics-i.mean-of-binomial-dist'),
 (('STATISTICS I', 'Distributions', 'Standard Dev. of Binomial'), 'statistics-i.standard-dev-of-binomial'),
 (('STATISTICS I', 'Inferential Statistics', 'Confidence Interval (Mean)'), 'statistics-i.confidence-interval-mean'),
 (('STATISTICS I', 'Inferential Statistics', 'Confidence Interval (Proportion)'),
  'statistics-i.confidence-interval-proportion'),
 (('STATISTICS I', 'Inferential Statistics', 'Margin of Error'), 'statistics-i.margin-of-error'),
 (('STATISTICS I', 'Probability', 'Addition Rule'), 'statistics-i.addition-rule'),
 (('STATISTICS I', 'Probability', 'Conditional Probability'), 'statistics-i.conditional-probability'),
 (('STATISTICS I', 'Probability', 'Expected Value'), 'statistics-i.expected-value'),
 (('STATISTICS I', 'Probability', 'Multiplication Rule'), 'statistics-i.multiplication-rule'),
 (('STATISTICS II', 'ANOVA (Analysis of Variance)', 'F-Statistic'), 'statistics-ii.f-statistic'),
 (('STATISTICS II', 'ANOVA (Analysis of Variance)', 'Mean Square (Error)'), 'statistics-ii.mean-square-error'),
 (('STATISTICS II', 'ANOVA (Analysis of Variance)', 'Mean Square (Groups)'), 'statistics-ii.mean-square-groups'),
 (('STATISTICS II', 'Chi-Square Tests', 'Chi-Square Statistic'), 'statistics-ii.chi-square-statistic'),
 (('STATISTICS II', 'Chi-Square Tests', 'Degrees of Freedom (Matrix)'), 'statistics-ii.degrees-of-freedom-matrix'),
 (('STATISTICS II', 'Chi-Square Tests', 'Expected Count'), 'statistics-ii.expected-count'),
 (('STATISTICS II', 'Linear Regression', 'Correlation Coefficient (r)'), 'statistics-ii.correlation-coefficient-r'),
 (('STATISTICS II', 'Linear Regression', 'Regression Line'), 'statistics-ii.regression-line'),
 (('STATISTICS II', 'Linear Regression', 'Slope of Regression'), 'statistics-ii.slope-of-regression'),
 (('STATISTICS II', 'Linear Regression', 'Y-Intercept'), 'statistics-ii.y-intercept'),
 (('STATISTICS II', 'Two-Sample Inference', 'Pooled Proportion'), 'statistics-ii.pooled-proportion'),
 (('STATISTICS II', 'Two-Sample Inference', 'Two-Sample t-Test (Means)'), 'statistics-ii.two-sample-t-test-means'),
 (('STATISTICS II', 'Two-Sample Inference', 'Two-Sample z-Test (Proportions)'),
  'statistics-ii.two-sample-z-test-proportions'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Cosine Double Angle'),
  'trigonometry.cosine-double-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Cosine Half Angle'), 'trigonometry.cosine-half-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Cosine Sum/Difference'),
  'trigonometry.cosine-sum-difference'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Cosine Triple Angle'),
  'trigonometry.cosine-triple-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Sine Double Angle'), 'trigonometry.sine-double-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Sine Half Angle'), 'trigonometry.sine-half-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Sine Sum/Difference'),
  'trigonometry.sine-sum-difference'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Sine Triple Angle'), 'trigonometry.sine-triple-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Tangent Double Angle'),
  'trigonometry.tangent-double-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Tangent Half Angle'), 'trigonometry.tangent-half-angle'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Tangent Sum/Difference'),
  'trigonometry.tangent-sum-difference'),
 (('TRIGONOMETRY', 'Angle Sum and Multiple-Angle Identities', 'Tangent Triple Angle'),
  'trigonometry.tangent-triple-angle'),
 (('TRIGONOMETRY', 'Applications', 'Arc Length'), 'trigonometry.arc-length'),
 (('TRIGONOMETRY', 'Applications', 'Area of Triangle'), 'trigonometry.area-of-triangle'),
 (('TRIGONOMETRY', 'Applications', 'Law of Cosines'), 'trigonometry.law-of-cosines'),
 (('TRIGONOMETRY', 'Applications', 'Law of Sines'), 'trigonometry.law-of-sines'),
 (('TRIGONOMETRY', 'Applications', 'Sector Area'), 'trigonometry.sector-area'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Cosine (Even)'), 'trigonometry.cosine-even'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Full Period'), 'trigonometry.full-period'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Half Period Shift'), 'trigonometry.half-period-shift'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Reciprocal Odd'), 'trigonometry.reciprocal-odd'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Secant-Cosecant'), 'trigonometry.secant-cosecant'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Sine (Odd)'), 'trigonometry.sine-odd'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Sine-Cosine'), 'trigonometry.sine-cosine'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Tangent (Odd)'), 'trigonometry.tangent-odd'),
 (('TRIGONOMETRY', 'Fundamental Identities', 'Tangent-Cotangent'), 'trigonometry.tangent-cotangent'),
 (('TRIGONOMETRY', 'Inverse Trig Identities', 'Arcsin/Arccos'), 'trigonometry.arcsin-arccos'),
 (('TRIGONOMETRY', 'Inverse Trig Identities', 'Arctan/Arccot'), 'trigonometry.arctan-arccot'),
 (('TRIGONOMETRY', 'Inverse Trig Identities', 'Inverse Relationships'), 'trigonometry.inverse-relationships'),
 (('TRIGONOMETRY', 'Inverse Trig Identities', 'Inverse Sum'), 'trigonometry.inverse-sum'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Cosine Difference'), 'trigonometry.cosine-difference'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Cosine Power-Reducing'), 'trigonometry.cosine-power-reducing'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Cosine Sum'), 'trigonometry.cosine-sum'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Cosine-Cosine Product'), 'trigonometry.cosine-cosine-product'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Cosine-Sine Product'), 'trigonometry.cosine-sine-product'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Sine Difference'), 'trigonometry.sine-difference'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Sine Power-Reducing'), 'trigonometry.sine-power-reducing'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Sine Sum'), 'trigonometry.sine-sum'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Sine-Cosine Product'), 'trigonometry.sine-cosine-product'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Sine-Sine Product'), 'trigonometry.sine-sine-product'),
 (('TRIGONOMETRY', 'Product and Power Identities', 'Tangent Power-Reducing'), 'trigonometry.tangent-power-reducing'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', '30-60-90 Triangle'),
  'trigonometry.30-60-90-triangle'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', '45-45-90 Triangle'),
  'trigonometry.45-45-90-triangle'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', '60-60-60 Triangle'),
  'trigonometry.60-60-60-triangle'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', 'Basic Trig Functions'),
  'trigonometry.basic-trig-functions'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', 'Cotangent Identity'),
  'trigonometry.cotangent-identity'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', 'Primary Identity'),
  'trigonometry.primary-identity'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', 'Quotient Identities'),
  'trigonometry.quotient-identities'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', 'Reciprocal Functions'),
  'trigonometry.reciprocal-functions'),
 (('TRIGONOMETRY', 'Special Triangles and Basic Trig Relationships', 'Tangent Identity'),
  'trigonometry.tangent-identity'),
 (('UNIT CIRCLE', 'UNIT CIRCLE', 'Unit Circle (Key Angles)'), 'unit-circle.unit-circle-key-angles'))
FROZEN_LEGACY_FORMULA_IDS = {}
for _legacy_key, _formula_id in FROZEN_LEGACY_FORMULA_ENTRIES:
    if _legacy_key in FROZEN_LEGACY_FORMULA_IDS:
        raise RuntimeError(f"Duplicate frozen legacy formula key: {_legacy_key!r}")
    FROZEN_LEGACY_FORMULA_IDS[_legacy_key] = _formula_id
if len(FROZEN_LEGACY_FORMULA_IDS) != 402:
    raise RuntimeError("Frozen legacy formula mapping is incomplete")

FROZEN_V1_LATEX_CONTENT_MAX_BYTES = 262144
FROZEN_V1_FONT_SIZES = {f"{size}pt" for size in range(8, 13)}
FROZEN_V1_SPACING_NAMES = {"tiny", "small", "medium", "large"}
FROZEN_V1_MARGINS = {"0.15in", "0.25in", "0.5in", "0.75in", "1in", "1.5in", "2in"}
FROZEN_FORMULA_IDS_BY_CLASS_AND_NAME = {}
for (_formula_class, _category, _name), _formula_id in FROZEN_LEGACY_FORMULA_ENTRIES:
    FROZEN_FORMULA_IDS_BY_CLASS_AND_NAME.setdefault((_formula_class, _name), []).append(_formula_id)


def _is_integer_in_range(value, minimum, maximum):
    return isinstance(value, int) and not isinstance(value, bool) and minimum <= value <= maximum


def _is_numeric_pt_in_range(value, minimum, maximum):
    if not isinstance(value, str) or not value.endswith("pt"):
        return False
    try:
        numeric_value = Decimal(value[:-2])
    except (InvalidOperation, ValueError):
        return False
    return numeric_value.is_finite() and Decimal(minimum) <= numeric_value <= Decimal(maximum)


def _valid_font_size(value):
    return isinstance(value, str) and (value in FROZEN_V1_FONT_SIZES or _is_numeric_pt_in_range(value, 6, 18))


def _valid_spacing(value):
    return isinstance(value, str) and (value in FROZEN_V1_SPACING_NAMES or _is_numeric_pt_in_range(value, 0, 6))


def _validate_latex_content(value, row_label, errors):
    if not isinstance(value, str):
        errors.append(f"{row_label} field=latex_content value={value!r} is not a string")
        return
    try:
        byte_length = len(value.encode("utf-8"))
    except UnicodeEncodeError:
        errors.append(f"{row_label} field=latex_content value is not UTF-8 encodable")
        return
    if byte_length > FROZEN_V1_LATEX_CONTENT_MAX_BYTES:
        errors.append(
            f"{row_label} field=latex_content bytes={byte_length} exceeds "
            f"{FROZEN_V1_LATEX_CONTENT_MAX_BYTES}"
        )


def _legacy_formula_selections(selections, row_label, errors):
    if not isinstance(selections, list):
        errors.append(f"{row_label} field=selected_formulas value={selections!r} must be a list")
        return None
    resolved = []
    resolved_ids = set()
    for index, selection in enumerate(selections):
        if not isinstance(selection, dict):
            errors.append(f"{row_label}: selection {index} field=selected_formulas index={index} value={selection!r} is not an object")
            continue
        key = (selection.get("class"), selection.get("category"), selection.get("name"))
        formula_id = FROZEN_LEGACY_FORMULA_IDS.get(key)
        if formula_id is None:
            candidates = FROZEN_FORMULA_IDS_BY_CLASS_AND_NAME.get((key[0], key[2]), [])
            if len(candidates) == 1:
                formula_id = candidates[0]
            elif candidates:
                errors.append(f"{row_label}: selection {index} field=selected_formulas index={index} value={selection!r} is ambiguous in the frozen catalog")
                continue
            else:
                errors.append(f"{row_label}: selection {index} field=selected_formulas index={index} value={selection!r} did not resolve in the frozen catalog")
                continue
        if formula_id in resolved_ids:
            errors.append(f"{row_label}: selection {index} field=selected_formulas index={index} value={selection!r} resolves to duplicate formula_id={formula_id!r}")
            continue
        resolved_ids.add(formula_id)
        resolved.append({"formula_id": formula_id})
    return resolved


def _preflight_document_persistence(CheatSheet, Template):
    errors = []
    backfill_rows = []
    for sheet in CheatSheet.objects.order_by("pk").iterator():
        row_label = f"CheatSheet id={sheet.pk}"
        if not _is_integer_in_range(sheet.columns, 1, 5):
            errors.append(f"{row_label} field=columns value={sheet.columns!r}")
        if sheet.orientation not in {"portrait", "landscape"}:
            errors.append(f"{row_label} field=orientation value={sheet.orientation!r}")
        if not _valid_font_size(sheet.font_size):
            errors.append(f"{row_label} field=font_size value={sheet.font_size!r}")
        if not _valid_spacing(sheet.spacing):
            errors.append(f"{row_label} field=spacing value={sheet.spacing!r}")
        if not isinstance(sheet.margins, str) or sheet.margins not in FROZEN_V1_MARGINS:
            errors.append(f"{row_label} field=margins value={sheet.margins!r}")
        _validate_latex_content(sheet.latex_content, row_label, errors)
        formula_selections = _legacy_formula_selections(sheet.selected_formulas, row_label, errors)
        backfill_rows.append((sheet, formula_selections))
    for template in Template.objects.order_by("pk").iterator():
        row_label = f"Template id={template.pk}"
        if not _is_integer_in_range(template.default_columns, 1, 5):
            errors.append(f"{row_label} field=default_columns value={template.default_columns!r}")
        if not isinstance(template.default_margins, str) or template.default_margins not in FROZEN_V1_MARGINS:
            errors.append(f"{row_label} field=default_margins value={template.default_margins!r}")
        _validate_latex_content(template.latex_content, row_label, errors)
        formula_selections = _legacy_formula_selections(template.selected_formulas, row_label, errors)
        backfill_rows.append((template, formula_selections))
    if errors:
        raise ValueError("Invalid legacy document persistence values: " + "; ".join(errors))
    return backfill_rows


def backfill_document_persistence(apps, schema_editor):
    CheatSheet = apps.get_model("api", "CheatSheet")
    Template = apps.get_model("api", "Template")
    backfill_rows = _preflight_document_persistence(CheatSheet, Template)
    for sheet, formula_selections in backfill_rows:
        if not isinstance(sheet, CheatSheet):
            continue
        has_content = bool((sheet.latex_content or "").strip())
        sheet.schema_version = 1
        sheet.revision = 1
        sheet.source_mode = "empty" if not has_content else "generated" if sheet.content_source == "generated" else "raw"
        sheet.formula_selections = formula_selections
        sheet.save(update_fields=["schema_version", "revision", "source_mode", "formula_selections"])
    for template, formula_selections in backfill_rows:
        if not isinstance(template, Template):
            continue
        has_content = bool((template.latex_content or "").strip())
        template.schema_version = 1
        template.revision = 1
        template.source_mode = "empty" if not has_content else "generated" if formula_selections else "raw"
        template.formula_selections = formula_selections
        template.default_font_size = "9pt"
        template.default_spacing = "small"
        template.default_orientation = "portrait"
        template.save(update_fields=["schema_version", "revision", "source_mode", "formula_selections", "default_font_size", "default_spacing", "default_orientation"])


class Migration(migrations.Migration):
    dependencies = [("api", "0010_expand_document_persistence")]
    operations = [migrations.RunPython(backfill_document_persistence, migrations.RunPython.noop)]
