export type Field =
  | { id: string; kind: "text"; label: string; value?: string; placeholder?: string; secret?: boolean }
  /** `detail` is a second line under the checkbox's label. */
  | { id: string; kind: "checkbox"; label: string; value?: boolean; detail?: string }
  | { id: string; kind: "select"; label: string; value?: string; options: { value: string; label: string }[] }
  /** A list of rows to choose one from (a release picker). */
  | { id: string; kind: "choice"; label?: string; value?: string; options: { value: string; label: string; detail?: string; disabled?: boolean }[] }
  /** Checkboxes to pick any number from; its value is the checked option values, in option order. */
  | { id: string; kind: "multi"; label?: string; value?: string[]; options: { value: string; label: string; detail?: string; disabled?: boolean }[] };

/** What a form resolves to: each field's value by id (text, select and choice: a string; checkbox: a boolean; multi: a string array). */
export type FieldValues = Record<string, string | boolean | string[]>;
