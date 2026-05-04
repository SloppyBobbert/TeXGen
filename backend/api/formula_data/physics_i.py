""" PHYSICS formulas """

CLASS_NAME = "PHYSICS I"

FORMULAS = {
    "Kinematics (Motion)": [
        {"name": "Average Velocity", "latex": r"v = \frac{\Delta x}{\Delta t}"},
        {"name": "Average Acceleration", "latex": r"a = \frac{\Delta v}{\Delta t}"},
        {"name": "Kinematics 1 (Velocity)", "latex": r"v = v_0 + at"},
        {"name": "Kinematics 2 (Position)", "latex": r"\Delta x = v_0 t + \frac{1}{2}at^2"},
        {"name": "Kinematics 3 (Velocity Squared)", "latex": r"v^2 = v_0^2 + 2a\Delta x"},
    ],
    "Dynamics (Forces)": [
        {"name": "Newton's Second Law", "latex": r"F_{net} = ma"},
        {"name": "Force of Gravity (Weight)", "latex": r"F_g = mg"},
        {"name": "Kinetic Friction", "latex": r"f_k = \mu_k F_N"},
        {"name": "Static Friction", "latex": r"f_s \le \mu_s F_N"},
        {"name": "Hooke's Law (Springs)", "latex": r"F_s = -kx"},
    ],
    "Work, Energy & Power": [
        {"name": "Work", "latex": r"W = Fd \cos(\theta)"},
        {"name": "Kinetic Energy", "latex": r"KE = \frac{1}{2}mv^2"},
        {"name": "Gravitational Potential Energy", "latex": r"PE = mgh"},
        {"name": "Elastic Potential Energy", "latex": r"PE_s = \frac{1}{2}kx^2"},
        {"name": "Power", "latex": r"P = \frac{W}{\Delta t}"},
    ],
    "Momentum & Collisions": [
        {"name": "Momentum", "latex": r"p = mv"},
        {"name": "Impulse-Momentum Theorem", "latex": r"J = F \Delta t = \Delta p"},
        {"name": "Conservation of Momentum", "latex": r"m_1 v_{1i} + m_2 v_{2i} = m_1 v_{1f} + m_2 v_{2f}"},
    ],
    "Electricity & Waves": [
        {"name": "Ohm's Law", "latex": r"V = IR"},
        {"name": "Electrical Power", "latex": r"P = IV = I^2R = \frac{V^2}{R}"},
        {"name": "Wave Speed", "latex": r"v = f \lambda"},
        {"name": "Period and Frequency", "latex": r"T = \frac{1}{f}"},
    ],
}