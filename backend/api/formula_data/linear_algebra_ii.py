""" LINEAR ALGEBRA II formulas """
CLASS_NAME = "LINEAR ALGEBRA II"

FORMULAS = {
    "Matrix Properties": [
        { "id": "linear-algebra-ii.invertibility-condition","name": "Invertibility Condition", "latex": r"A \text{ is invertible iff } \det(A) \neq 0"},
        { "id": "linear-algebra-ii.matrix-multiplication-property","name": "Matrix Multiplication Property", "latex": r"(AB)^{-1} = B^{-1}A^{-1}"},
        { "id": "linear-algebra-ii.orthogonality","name": "Orthogonality", "latex": r"Q^T Q = I"},
    ],
    "Eigenvalues & Eigenvectors": [
        { "id": "linear-algebra-ii.characteristic-equation","name": "Characteristic Equation", "latex": r"\det(A - \lambda I) = 0"},
        { "id": "linear-algebra-ii.eigenvector-definition","name": "Eigenvector Definition", "latex": r"A\mathbf{v} = \lambda\mathbf{v}"},
    ],
    "Decompositions & Spaces": [
        { "id": "linear-algebra-ii.diagonalization","name": "Diagonalization", "latex": r"A = PDP^{-1}"},
        { "id": "linear-algebra-ii.rank-nullity-theorem","name": "Rank-Nullity Theorem", "latex": r"\text{rank}(A) + \text{nullity}(A) = n"},
        { "id": "linear-algebra-ii.projection-formula","name": "Projection Formula", "latex": r"\text{proj}_{\mathbf{u}}(\mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|^2}\mathbf{u}"},
    ]
}