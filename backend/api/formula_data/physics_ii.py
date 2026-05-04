""" PHYSICS II formulas """

CLASS_NAME = "PHYSICS II"

FORMULAS = {
    "Electrostatics": [
        {"name": "Coulomb's Law", "latex": r"F_e = k \frac{|q_1 q_2|}{r^2}"},
        {"name": "Electric Field", "latex": r"E = \frac{F_e}{q}"},
        {"name": "Electric Potential (Voltage)", "latex": r"V = \frac{k q}{r}"},
        {"name": "Capacitance", "latex": r"C = \frac{Q}{V}"},
    ],
    "Circuits": [
        {"name": "Ohm's Law", "latex": r"V = IR"},
        {"name": "Equivalent Resistance (Series)", "latex": r"R_{eq} = R_1 + R_2 + ..."},
        {"name": "Equivalent Resistance (Parallel)", "latex": r"\frac{1}{R_{eq}} = \frac{1}{R_1} + \frac{1}{R_2} + ..."},
        {"name": "Electrical Power", "latex": r"P = IV = I^2R = \frac{V^2}{R}"},
    ],
    "Magnetism": [
        {"name": "Magnetic Force on a Charge", "latex": r"F_B = qvB \sin(\theta)"},
        {"name": "Magnetic Force on a Wire", "latex": r"F_B = ILB \sin(\theta)"},
        {"name": "Magnetic Field of a Wire", "latex": r"B = \frac{\mu_0 I}{2\pi r}"},
        {"name": "Magnetic Flux", "latex": r"\Phi_B = BA \cos(\theta)"},
    ],
    "Waves & Optics": [
        {"name": "Index of Refraction", "latex": r"n = \frac{c}{v}"},
        {"name": "Snell's Law", "latex": r"n_1 \sin(\theta_1) = n_2 \sin(\theta_2)"},
        {"name": "Thin Lens Equation", "latex": r"\frac{1}{f} = \frac{1}{d_o} + \frac{1}{d_i}"},
        {"name": "Magnification", "latex": r"m = \frac{h_i}{h_o} = -\frac{d_i}{d_o}"},
    ]
}