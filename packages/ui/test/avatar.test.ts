import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { avatar } from "../src";

const css = readFileSync(resolve(__dirname, "../../base-theme/css/06-design-system.css"), "utf8");
const styling = readFileSync(resolve(__dirname, "../../../docs/design-system/STYLING.md"), "utf8");
const rule = (selector: string) => css.split("\n").find((l) => l.startsWith(`${selector} {`)) ?? "";

const host = () => document.body.appendChild(document.createElement("div"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("avatar", () => {
  it("draws initials in a circle, appended to the parent, medium by default", () => {
    const h = host();
    const a = avatar(h, { text: "AB" });
    expect(h.firstElementChild).toBe(a);
    expect([...a.classList]).toEqual(["hel-avatar", "is-medium"]);
    expect(a.textContent).toBe("AB");
  });

  it("takes a size", () => {
    for (const size of ["small", "medium", "large"] as const) expect([...avatar(host(), { text: "AB", size }).classList]).toEqual(["hel-avatar", `is-${size}`]);
  });

  it("is an image named by the full text, so a screen reader hears the name and not letters", () => {
    const a = avatar(host(), { text: "  Ada Lovelace " });
    expect(a.getAttribute("role")).toBe("img");
    expect(a.getAttribute("aria-label")).toBe("Ada Lovelace");
    expect(a.title).toBe("Ada Lovelace");
  });

  it.each([
    ["Ada Lovelace", "AL"],
    ["ada king lovelace", "AL"],
    ["Ada", "A"],
    ["ab", "AB"],
    ["Q", "Q"],
    ["Ada (Countess)", "AC"],
    ["👩‍💻 Dev", "👩‍💻D"],
    ["- Ada -", "A"],
    ["émile zola", "ÉZ"],
    ["émile", "É"],
    ["山田太郎", "山"],
    ["🦊 Fox", "🦊F"],
    ["+3", "+3"],
    ["+12", "+12"],
    ["🇫🇷 Marie", "🇫🇷M"],
    ["❤️ Team", "❤️T"],
    ["Acme ®", "A"],
    ["ßa", "ßa"],
    ["?", "?"],
    ["", "?"],
    ["   ", "?"],
  ])("draws %j as %j", (text, initials) => {
    expect(avatar(host(), { text }).textContent).toBe(initials);
  });

  it("names an empty one, so the image is never unlabelled", () => {
    expect(avatar(host(), { text: " " }).getAttribute("aria-label")).toBe("?");
  });

  it("never parses its text as markup", () => {
    const a = avatar(host(), { text: "<img src=x>" });
    expect(a.children).toHaveLength(0);
  });
});

describe("avatar styles", () => {
  it("is a circle that a flex row cannot squash, tinted from the theme so light and dark follow it", () => {
    const base = rule(".hel-avatar");
    expect(base).toContain("border-radius: 50%");
    expect(base).toContain("flex: none");
    expect(base).toContain("color: var(--text-normal)");
    expect(base).toContain("var(--text-muted)");
    expect(base).not.toMatch(/#[0-9a-f]{3}/i);
  });

  it("stays hidden when hidden", () => {
    expect(rule(".hel-avatar[hidden]")).toContain("display: none");
  });

  it("has a square box per size, growing from small to large", () => {
    const px = (selector: string) => {
      const r = rule(selector);
      const w = Number(/ width: (\d+)px/.exec(r)?.[1]);
      expect(r).toContain(`height: ${w}px`);
      return w;
    };
    expect([px(".hel-avatar.is-small"), px(".hel-avatar"), px(".hel-avatar.is-large")]).toEqual([20, 28, 40]);
  });

  it("STYLING.md lists the part and its sizes", () => {
    const row = styling.split("\n").find((l) => l.startsWith("| `hel-avatar` |"))!;
    for (const word of ["ui.avatar", "is-small", "is-medium", "is-large"]) expect(row).toContain(word);
  });
});
