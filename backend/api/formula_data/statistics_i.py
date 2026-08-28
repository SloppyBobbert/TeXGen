""" STATISTICS I formulas """

CLASS_NAME = "STATISTICS I"

FORMULAS = {
    "Descriptive Statistics": [
        { "id": "statistics-i.sample-mean","name": "Sample Mean", "latex": r"\bar{x} = \frac{\sum x_i}{n}"},
        { "id": "statistics-i.population-mean","name": "Population Mean", "latex": r"\mu = \frac{\sum x_i}{N}"},
        { "id": "statistics-i.sample-standard-deviation","name": "Sample Standard Deviation", "latex": r"s = \sqrt{\frac{\sum (x_i - \bar{x})^2}{n-1}}"},
        { "id": "statistics-i.z-score","name": "Z-Score", "latex": r"z = \frac{x - \mu}{\sigma}"},
    ],
    "Probability": [
        { "id": "statistics-i.addition-rule","name": "Addition Rule", "latex": r"P(A \cup B) = P(A) + P(B) - P(A \cap B)"},
        { "id": "statistics-i.multiplication-rule","name": "Multiplication Rule", "latex": r"P(A \cap B) = P(A) \cdot P(B|A)"},
        { "id": "statistics-i.conditional-probability","name": "Conditional Probability", "latex": r"P(A|B) = \frac{P(A \cap B)}{P(B)}"},
        { "id": "statistics-i.expected-value","name": "Expected Value", "latex": r"E(X) = \mu_X = \sum [x_i \cdot P(x_i)]"},
    ],
    "Distributions": [
        { "id": "statistics-i.binomial-probability","name": "Binomial Probability", "latex": r"P(X=k) = \binom{n}{k} p^k (1-p)^{n-k}"},
        { "id": "statistics-i.mean-of-binomial-dist","name": "Mean of Binomial Dist.", "latex": r"\mu_X = np"},
        { "id": "statistics-i.standard-dev-of-binomial","name": "Standard Dev. of Binomial", "latex": r"\sigma_X = \sqrt{np(1-p)}"},
    ],
    "Inferential Statistics": [
        { "id": "statistics-i.confidence-interval-mean","name": "Confidence Interval (Mean)", "latex": r"\bar{x} \pm z^* \frac{\sigma}{\sqrt{n}}"},
        { "id": "statistics-i.confidence-interval-proportion","name": "Confidence Interval (Proportion)", "latex": r"\hat{p} \pm z^* \sqrt{\frac{\hat{p}(1-\hat{p})}{n}}"},
        { "id": "statistics-i.margin-of-error","name": "Margin of Error", "latex": r"ME = z^* \frac{\sigma}{\sqrt{n}}"},
    ]
}