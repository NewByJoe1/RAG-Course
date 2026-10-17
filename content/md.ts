/**
 * Tag for lesson text: keeps backslashes exactly as written (Windows paths
 * like C:\Users\Sam stay intact), while \` still writes a backtick.
 * Values interpolate as usual:  md`See ${C.permittedDisclosure.section}`
 */
export const md = (strings: TemplateStringsArray, ...values: unknown[]) =>
  String.raw({ raw: strings.raw.map((s) => s.replace(/\\`/g, "`").replace(/\\\$\{/g, "${")) }, ...values);
