""" PHYSICS formulas """

CLASS_NAME = "PHYSICS I"

FORMULAS = {
    "Kinematics (Motion)": [
        { "id": "physics-i.average-velocity","name": "Average Velocity", "latex": r"v = \frac{\Delta x}{\Delta t}"},
        { "id": "physics-i.average-acceleration","name": "Average Acceleration", "latex": r"a = \frac{\Delta v}{\Delta t}"},
        { "id": "physics-i.kinematics-1-velocity","name": "Kinematics 1 (Velocity)", "latex": r"v = v_0 + at"},
        { "id": "physics-i.kinematics-2-position","name": "Kinematics 2 (Position)", "latex": r"\Delta x = v_0 t + \frac{1}{2}at^2"},
        { "id": "physics-i.kinematics-3-velocity-squared","name": "Kinematics 3 (Velocity Squared)", "latex": r"v^2 = v_0^2 + 2a\Delta x"},
    ],
    "Dynamics (Forces)": [
        { "id": "physics-i.newton-s-second-law","name": "Newton's Second Law", "latex": r"F_{net} = ma"},
        { "id": "physics-i.force-of-gravity-weight","name": "Force of Gravity (Weight)", "latex": r"F_g = mg"},
        { "id": "physics-i.kinetic-friction","name": "Kinetic Friction", "latex": r"f_k = \mu_k F_N"},
        { "id": "physics-i.static-friction","name": "Static Friction", "latex": r"f_s \le \mu_s F_N"},
        { "id": "physics-i.hooke-s-law-springs","name": "Hooke's Law (Springs)", "latex": r"F_s = -kx"},
    ],
    "Work, Energy & Power": [
        { "id": "physics-i.work","name": "Work", "latex": r"W = Fd \cos(\theta)"},
        { "id": "physics-i.kinetic-energy","name": "Kinetic Energy", "latex": r"KE = \frac{1}{2}mv^2"},
        { "id": "physics-i.gravitational-potential-energy","name": "Gravitational Potential Energy", "latex": r"PE = mgh"},
        { "id": "physics-i.elastic-potential-energy","name": "Elastic Potential Energy", "latex": r"PE_s = \frac{1}{2}kx^2"},
        { "id": "physics-i.power","name": "Power", "latex": r"P = \frac{W}{\Delta t}"},
    ],
    "Momentum & Collisions": [
        { "id": "physics-i.momentum","name": "Momentum", "latex": r"p = mv"},
        { "id": "physics-i.impulse-momentum-theorem","name": "Impulse-Momentum Theorem", "latex": r"J = F \Delta t = \Delta p"},
        { "id": "physics-i.conservation-of-momentum","name": "Conservation of Momentum", "latex": r"m_1 v_{1i} + m_2 v_{2i} = m_1 v_{1f} + m_2 v_{2f}"},
    ],
    "Electricity & Waves": [
        { "id": "physics-i.ohm-s-law","name": "Ohm's Law", "latex": r"V = IR"},
        { "id": "physics-i.electrical-power","name": "Electrical Power", "latex": r"P = IV = I^2R = \frac{V^2}{R}"},
        { "id": "physics-i.wave-speed","name": "Wave Speed", "latex": r"v = f \lambda"},
        { "id": "physics-i.period-and-frequency","name": "Period and Frequency", "latex": r"T = \frac{1}{f}"},
    ],
}