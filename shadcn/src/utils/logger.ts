
export const logger = {
  error(...args: unknown[]) {
    console.log(args.join(" "))
  },
  warn(...args: unknown[]) {
    console.warn(args.join(" "))
  },
  info(...args: unknown[]) {
    console.info(args.join(" "))
  },
  success(...args: unknown[]) {
    console.log(args.join(" "))
  },
  log(...args: unknown[]) {
    console.log(args.join(" "))
  },
  break() {
    console.log("")
  },
}
