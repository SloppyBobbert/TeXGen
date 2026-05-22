export type Orientation = "portrait" | "landscape"
export type ColumnCount = 1 | 2 | 3 | 4
export type TypographyPreset = "compact" | "standard" | "large"
export type SpacingPreset = "tight" | "balanced" | "roomy"

export class BuilderSection {
  id: string
  title: string
  selected = $state(false)

  constructor(input: { id: string; title: string; selected?: boolean }) {
    this.id = input.id
    this.title = input.title
    this.selected = input.selected ?? false
  }
}

export class BuilderClass {
  id: string
  title: string
  sections: BuilderSection[] = $state([])

  constructor(input: { id: string; title: string; sections: BuilderSection[] }) {
    this.id = input.id
    this.title = input.title
    this.sections = input.sections
  }

  get selectedCount() {
    return this.sections.filter((section) => section.selected).length
  }

  get checked() {
    return this.sections.length > 0 && this.selectedCount === this.sections.length
  }

  set checked(selected: boolean) {
    for (const section of this.sections) {
      section.selected = selected
    }
  }

  get indeterminate() {
    return this.selectedCount > 0 && this.selectedCount < this.sections.length
  }
}

export const builderState = $state({
  content: {
    classes: [
      new BuilderClass({
        id: "calculus",
        title: "Calculus",
        sections: [
          new BuilderSection({ id: "limits", title: "Limits", selected: true }),
          new BuilderSection({ id: "derivatives", title: "Derivatives", selected: true }),
          new BuilderSection({ id: "integrals", title: "Integrals" }),
          new BuilderSection({ id: "series", title: "Series" }),
          new BuilderSection({ id: "optimization", title: "Optimization" }),
        ],
      }),
      new BuilderClass({
        id: "linear-algebra",
        title: "Linear Algebra",
        sections: [
          new BuilderSection({ id: "vectors", title: "Vectors", selected: true }),
          new BuilderSection({ id: "matrices", title: "Matrices", selected: true }),
          new BuilderSection({ id: "determinants", title: "Determinants", selected: true }),
          new BuilderSection({ id: "eigenvalues", title: "Eigenvalues", selected: true }),
          new BuilderSection({ id: "orthogonality", title: "Orthogonality", selected: true }),
        ],
      }),
      new BuilderClass({
        id: "probability",
        title: "Probability",
        sections: [
          new BuilderSection({ id: "counting", title: "Counting" }),
          new BuilderSection({ id: "conditional-probability", title: "Conditional Probability" }),
          new BuilderSection({ id: "random-variables", title: "Random Variables", selected: true }),
          new BuilderSection({ id: "distributions", title: "Distributions" }),
          new BuilderSection({ id: "expectation", title: "Expectation" }),
        ],
      }),
      new BuilderClass({
        id: "differential-equations",
        title: "Differential Equations",
        sections: [
          new BuilderSection({
            id: "separable-equations",
            title: "Separable Equations",
            selected: true,
          }),
          new BuilderSection({ id: "linear-first-order", title: "Linear First-Order" }),
          new BuilderSection({ id: "homogeneous-equations", title: "Homogeneous Equations" }),
          new BuilderSection({ id: "laplace-transforms", title: "Laplace Transforms" }),
          new BuilderSection({ id: "systems-of-odes", title: "Systems of ODEs" }),
          new BuilderSection({ id: "phase-planes", title: "Phase Planes" }),
        ],
      }),
      new BuilderClass({
        id: "discrete-math",
        title: "Discrete Math",
        sections: [
          new BuilderSection({ id: "logic", title: "Logic" }),
          new BuilderSection({ id: "proof-techniques", title: "Proof Techniques", selected: true }),
          new BuilderSection({ id: "sets", title: "Sets" }),
          new BuilderSection({ id: "relations", title: "Relations" }),
          new BuilderSection({ id: "graphs", title: "Graphs" }),
          new BuilderSection({ id: "recurrence-relations", title: "Recurrence Relations" }),
        ],
      }),
      new BuilderClass({
        id: "statistics",
        title: "Statistics",
        sections: [
          new BuilderSection({ id: "descriptive-statistics", title: "Descriptive Statistics" }),
          new BuilderSection({ id: "sampling", title: "Sampling" }),
          new BuilderSection({
            id: "confidence-intervals",
            title: "Confidence Intervals",
            selected: true,
          }),
          new BuilderSection({ id: "hypothesis-tests", title: "Hypothesis Tests", selected: true }),
          new BuilderSection({ id: "regression", title: "Regression" }),
          new BuilderSection({ id: "anova", title: "ANOVA" }),
        ],
      }),
      new BuilderClass({
        id: "physics-mechanics",
        title: "Physics: Mechanics",
        sections: [
          new BuilderSection({ id: "kinematics", title: "Kinematics" }),
          new BuilderSection({ id: "newtons-laws", title: "Newton's Laws" }),
          new BuilderSection({ id: "work-energy", title: "Work and Energy" }),
          new BuilderSection({ id: "momentum", title: "Momentum" }),
          new BuilderSection({ id: "rotation", title: "Rotation" }),
          new BuilderSection({ id: "oscillations", title: "Oscillations" }),
        ],
      }),
      new BuilderClass({
        id: "computer-science",
        title: "Computer Science",
        sections: [
          new BuilderSection({ id: "big-o", title: "Big-O Notation", selected: true }),
          new BuilderSection({ id: "arrays-and-lists", title: "Arrays and Lists" }),
          new BuilderSection({ id: "trees", title: "Trees" }),
          new BuilderSection({ id: "hash-tables", title: "Hash Tables" }),
          new BuilderSection({ id: "sorting", title: "Sorting Algorithms" }),
          new BuilderSection({ id: "dynamic-programming", title: "Dynamic Programming" }),
          new BuilderSection({ id: "graph-algorithms", title: "Graph Algorithms" }),
        ],
      }),
    ],
  },
  design: {
    orientation: "portrait" as Orientation,
    columns: 2 as ColumnCount,
    typography: "standard" as TypographyPreset,
    spacing: "balanced" as SpacingPreset,
  },
})
