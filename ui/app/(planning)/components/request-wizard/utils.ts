export const createUniqueId = (prefix: string, existing: Iterable<string>) => {
  const taken = new Set(existing);
  const generate = () =>
    `${prefix}-${
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 9)
    }`;
  let candidate = generate();
  while (taken.has(candidate)) {
    candidate = generate();
  }
  return candidate;
};

export const toNumberList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
