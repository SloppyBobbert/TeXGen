""" LINEAR ALGEBRA I formulas """
CLASS_NAME = "LINEAR ALGEBRA I"

FORMULAS = {
    "Vector Basics": [
        {"name": "Vector Addition", "latex": r"\mathbf{u} + \mathbf{v} = \langle u_1+v_1, u_2+v_2 \rangle"},
        {"name": "Scalar Multiplication", "latex": r"k\mathbf{u} = \langle ku_1, ku_2 \rangle"},
        {"name": "Magnitude (L2 Norm)", "latex": r"\|\mathbf{v}\| = \sqrt{v_1^2 + v_2^2 + \dots + v_n^2}"},
        {"name": "Dot Product", "latex": r"\mathbf{u} \cdot \mathbf{v} = u_1v_1 + u_2v_2 + \dots + u_nv_n"},
    ],
    "Matrix Operations": [
        {"name": "Matrix Addition", "latex": r"A + B = [a_{ij} + b_{ij}]"},
        {"name": "Matrix-Vector Multiplication", "latex": r"A\mathbf{x} = \mathbf{b}"},
        {"name": "Transpose", "latex": r"(A^T)_{ij} = A_{ji}"},
    ],
    "2x2 Systems": [
        {"name": "2x2 Determinant", "latex": r"\det(A) = ad - bc"},
        {"name": "2x2 Inverse", "latex": r"A^{-1} = \frac{1}{ad-bc} \begin{bmatrix} d & -b \\ -c & a \end{bmatrix}"},
    ]
}