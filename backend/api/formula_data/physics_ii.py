""" PHYSICS II formulas """

CLASS_NAME = "PHYSICS II"

FORMULAS = {
    "Electrostatics": [
        { "id": "physics-ii.coulomb-s-law","name": "Coulomb's Law", "latex": r"F_e = k \frac{|q_1 q_2|}{r^2}"},
        { "id": "physics-ii.electric-field","name": "Electric Field", "latex": r"E = \frac{F_e}{q}"},
        { "id": "physics-ii.electric-potential-voltage","name": "Electric Potential (Voltage)", "latex": r"V = \frac{k q}{r}"},
        { "id": "physics-ii.capacitance","name": "Capacitance", "latex": r"C = \frac{Q}{V}"},
    ],
    "Circuits": [
        { "id": "physics-ii.ohm-s-law","name": "Ohm's Law", "latex": r"V = IR"},
        { "id": "physics-ii.equivalent-resistance-series","name": "Equivalent Resistance (Series)", "latex": r"R_{eq} = R_1 + R_2 + ..."},
        { "id": "physics-ii.equivalent-resistance-parallel","name": "Equivalent Resistance (Parallel)", "latex": r"\frac{1}{R_{eq}} = \frac{1}{R_1} + \frac{1}{R_2} + ..."},
        { "id": "physics-ii.electrical-power","name": "Electrical Power", "latex": r"P = IV = I^2R = \frac{V^2}{R}"},
    ],
    "Magnetism": [
        { "id": "physics-ii.magnetic-force-on-a-charge","name": "Magnetic Force on a Charge", "latex": r"F_B = qvB \sin(\theta)"},
        { "id": "physics-ii.magnetic-force-on-a-wire","name": "Magnetic Force on a Wire", "latex": r"F_B = ILB \sin(\theta)"},
        { "id": "physics-ii.magnetic-field-of-a-wire","name": "Magnetic Field of a Wire", "latex": r"B = \frac{\mu_0 I}{2\pi r}"},
        { "id": "physics-ii.magnetic-flux","name": "Magnetic Flux", "latex": r"\Phi_B = BA \cos(\theta)"},
    ],
    "Waves & Optics": [
        { "id": "physics-ii.index-of-refraction","name": "Index of Refraction", "latex": r"n = \frac{c}{v}"},
        { "id": "physics-ii.snell-s-law","name": "Snell's Law", "latex": r"n_1 \sin(\theta_1) = n_2 \sin(\theta_2)"},
        { "id": "physics-ii.thin-lens-equation","name": "Thin Lens Equation", "latex": r"\frac{1}{f} = \frac{1}{d_o} + \frac{1}{d_i}"},
        { "id": "physics-ii.magnification","name": "Magnification", "latex": r"m = \frac{h_i}{h_o} = -\frac{d_i}{d_o}"},
    ]
}