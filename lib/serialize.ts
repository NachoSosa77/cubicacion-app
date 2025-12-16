export function toPlain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
