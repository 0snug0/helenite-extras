export type Field =
  | { id: string; kind: "text"; label: string; value?: string; placeholder?: string; secret?: boolean }
  | { id: string; kind: "checkbox"; label: string; value?: boolean }
  | { id: string; kind: "select"; label: string; value?: string; options: { value: string; label: string }[] }
  /** A list of rows to choose one from (a release picker). */
  | { id: string; kind: "choice"; label?: string; value?: string; options: { value: string; label: string; detail?: string; disabled?: boolean }[] };
