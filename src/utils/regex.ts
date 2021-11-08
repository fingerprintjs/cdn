export function escapeForRegex(str: string): string {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
}
