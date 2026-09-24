/**
 * Recursively freeze `value` in place. Test files are ES modules (strict
 * mode), so any later write to a frozen object throws a TypeError at the
 * offending line instead of silently corrupting shared data.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
