export const createUniqueId = (existing: Iterable<string>) => {
  const taken = new Set(existing);
  const generator = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 9);
  let candidate = generator();
  while (taken.has(candidate)) candidate = generator();
  return candidate;
};

export const formatIdHint = (id: string, length = 8) => {
  if (!id) return "";
  const trimmed = id.slice(0, Math.max(1, length));
  return `(${trimmed})`;
};
