import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const vars = readFileSync(resolve(__dirname, "../../base-theme/css/01-variables.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rules = css.split("\n").filter((l) => /^\.hel-modal\b/.test(l));
const rule = (start: string) => rules.find((l) => l.startsWith(start)) ?? "";

describe("Finesse modal styling", () => {
  it("a modal is a ring and a drop shadow with the 12px dialog radius; its border stays, transparent, for themes", () => {
    const modal = rule(".hel-modal {");
    expect(modal).toContain("box-shadow: var(--hel-ring-overlay)");
    expect(modal).toContain("border-radius: var(--hel-dialog-radius)");
    expect(modal).toContain("solid transparent");
    expect(vars).toContain("--modal-radius: 12px;");
    expect(vars).toContain("--hel-dialog-radius: var(--modal-radius);");
  });

  it("only .hel-modal is restyled: Settings (.mod-settings) and plugins' own modals keep the base look", () => {
    expect(css).not.toMatch(/^\.modal\b/m);
    expect(css).not.toContain("mod-settings");
  });

  it("actions are right-aligned and pinned to the bottom; the danger fill (mod-warning) is kept", () => {
    const actions = rule(".hel-modal-actions {");
    expect(actions).toContain("justify-content: flex-end");
    expect(actions).toContain("position: sticky");
    expect(css).toContain("button:where(.hel-button).mod-warning { background-color: var(--background-modifier-error)");
  });

  it("the error line is a tinted alert while it has a message and gone while empty; a busy action shows progress", () => {
    expect(rule(".hel-modal-error {")).toContain("color: var(--text-error)");
    expect(css).toContain(".hel-modal-error:empty { display: none; }");
    expect(css).toContain(".hel-modal-actions:has(.hel-button.is-busy) { cursor: progress; }");
  });

  it("the close button takes the focus ring", () => {
    expect(css).toContain(".hel-modal > .modal-close-button:focus-visible { outline: none; box-shadow: var(--hel-ring-focus); }");
  });

  it("modal rules use tokens only, so light and dark follow the theme", () => {
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.join("\n")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("STYLING.md has a row for each modal part", () => {
    for (const name of ["hel-modal", "hel-modal-body", "hel-modal-title-icon", "hel-modal-message", "hel-modal-label", "hel-modal-input", "hel-modal-field", "hel-modal-check", "hel-modal-error", "hel-modal-actions", "hel-modal-choices", "hel-modal-choice"]) {
      expect(styling).toContain(`| \`${name}\` |`);
    }
    expect(styling).toMatch(/\| `hel-modal` \|[^\n]*Finesse/);
  });
});
