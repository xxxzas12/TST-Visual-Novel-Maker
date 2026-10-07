let counter = 0;

/** Short, collision-resistant id. Safe to use in file names and URLs. */
export function newId(prefix = ''): string {
  counter = (counter + 1) % 1679616;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 2176782336).toString(36).padStart(6, '0');
  return `${prefix}${time}${counter.toString(36).padStart(4, '0')}${rand}`;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
