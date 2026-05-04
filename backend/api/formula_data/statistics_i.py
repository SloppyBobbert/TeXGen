""" STATISTICS I formulas """

CLASS_NAME = "STATISTICS I"

FORMULAS = {
    "Descriptive Statistics": [
        {"name": "Sample Mean", "latex": r"\bar{x} = \frac{\sum x_i}{n}"},
        {"name": "Population Mean", "latex": r"\mu = \frac{\sum x_i}{N}"},
        {"name": "Sample Standard Deviation", "latex": r"s = \sqrt{\frac{\sum (x_i - \bar{x})^2}{n-1}}"},
        {"name": "Z-Score", "latex": r"z = \frac{x - \mu}{\sigma}"},
    ],
    "Probability": [
        {"name": "Addition Rule", "latex": r"P(A \cup B) = P(A) + P(B) - P(A \cap B)"},
        {"name": "Multiplication Rule", "latex": r"P(A \cap B) = P(A) \cdot P(B|A)"},
        {"name": "Conditional Probability", "latex": r"P(A|B) = \frac{P(A \cap B)}{P(B)}"},
        {"name": "Expected Value", "latex": r"E(X) = \mu_X = \sum [x_i \cdot P(x_i)]"},
    ],
    "Distributions": [
        {"name": "Binomial Probability", "latex": r"P(X=k) = \binom{n}{k} p^k (1-p)^{n-k}"},
        {"name": "Mean of Binomial Dist.", "latex": r"\mu_X = np"},
        {"name": "Standard Dev. of Binomial", "latex": r"\sigma_X = \sqrt{np(1-p)}"},
    ],
    "Inferential Statistics": [
        {"name": "Confidence Interval (Mean)", "latex": r"\bar{x} \pm z^* \frac{\sigma}{\sqrt{n}}"},
        {"name": "Confidence Interval (Proportion)", "latex": r"\hat{p} \pm z^* \sqrt{\frac{\hat{p}(1-\hat{p})}{n}}"},
        {"name": "Margin of Error", "latex": r"ME = z^* \frac{\sigma}{\sqrt{n}}"},
    ]
}