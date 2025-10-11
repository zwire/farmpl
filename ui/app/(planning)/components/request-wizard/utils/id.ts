export const createUniqueId = (prefix: string, existing: Iterable<string>) => {
  const taken = new Set(existing);
  const generator = () =>
    `${prefix}-${
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 9)
    }`;
  let candidate = generator();
  while (taken.has(candidate)) candidate = generator();
  return candidate;
};
