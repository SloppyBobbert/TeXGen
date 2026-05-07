""" LINEAR ALGEBRA II formulas """
CLASS_NAME = "LINEAR ALGEBRA II"

FORMULAS = {
    "Matrix Properties": [
        {"name": "Invertibility Condition", "latex": r"A \text{ is invertible iff } \det(A) \neq 0"},
        {"name": "Matrix Multiplication Property", "latex": r"(AB)^{-1} = B^{-1}A^{-1}"},
        {"name": "Orthogonality", "latex": r"Q^T Q = I"},
    ],
    "Eigenvalues & Eigenvectors": [
        {"name": "Characteristic Equation", "latex": r"\det(A - \lambda I) = 0"},
        {"name": "Eigenvector Definition", "latex": r"A\mathbf{v} = \lambda\mathbf{v}"},
    ],
    "Decompositions & Spaces": [
        {"name": "Diagonalization", "latex": r"A = PDP^{-1}"},
        {"name": "Rank-Nullity Theorem", "latex": r"\text{rank}(A) + \text{nullity}(A) = n"},
        {"name": "Projection Formula", "latex": r"\text{proj}_{\mathbf{u}}(\mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|^2}\mathbf{u}"},
    ]
}