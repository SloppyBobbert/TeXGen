""" LINEAR ALGEBRA I formulas """
CLASS_NAME = "LINEAR ALGEBRA I"

FORMULAS = {
    "Vector Basics": [
        { "id": "linear-algebra-i.vector-addition","name": "Vector Addition", "latex": r"\mathbf{u} + \mathbf{v} = \langle u_1+v_1, u_2+v_2 \rangle"},
        { "id": "linear-algebra-i.scalar-multiplication","name": "Scalar Multiplication", "latex": r"k\mathbf{u} = \langle ku_1, ku_2 \rangle"},
        { "id": "linear-algebra-i.magnitude-l2-norm","name": "Magnitude (L2 Norm)", "latex": r"\|\mathbf{v}\| = \sqrt{v_1^2 + v_2^2 + \dots + v_n^2}"},
        { "id": "linear-algebra-i.dot-product","name": "Dot Product", "latex": r"\mathbf{u} \cdot \mathbf{v} = u_1v_1 + u_2v_2 + \dots + u_nv_n"},
    ],
    "Matrix Operations": [
        { "id": "linear-algebra-i.matrix-addition","name": "Matrix Addition", "latex": r"A + B = [a_{ij} + b_{ij}]"},
        { "id": "linear-algebra-i.matrix-vector-multiplication","name": "Matrix-Vector Multiplication", "latex": r"A\mathbf{x} = \mathbf{b}"},
        { "id": "linear-algebra-i.transpose","name": "Transpose", "latex": r"(A^T)_{ij} = A_{ji}"},
    ],
    "2x2 Systems": [
        { "id": "linear-algebra-i.2x2-determinant","name": "2x2 Determinant", "latex": r"\det(A) = ad - bc"},
        { "id": "linear-algebra-i.2x2-inverse","name": "2x2 Inverse", "latex": r"A^{-1} = \frac{1}{ad-bc} \begin{bmatrix} d & -b \\ -c & a \end{bmatrix}"},
    ]
}