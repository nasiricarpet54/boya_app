/**
 * Ambient types for `moment-jalaali`.
 *
 * The package (0.10.5) is plain JavaScript and there is no `@types` package for
 * it on DefinitelyTyped. Rather than declaring the whole module as `any`, this
 * describes exactly the surface `lib/utils/jalali.ts` calls, so a typo in a
 * format string or a method name is still a compile error.
 */
declare module 'moment-jalaali' {
  /** Anything `moment()` accepts, plus the empty case used for "now". */
  type DateInput = Date | string | number | undefined | null;

  interface JalaliMoment {
    /** Moment is chainable: every setter returns the same instance. */
    locale(localeName: string): JalaliMoment;
    /**
     * Jalali tokens, e.g. `YYYY/MM/DD` or `HH:mm`. Token values are never
     * interpolated by the caller, so a plain `string` keeps this honest.
     */
    format(pattern: string): string;
  }

  interface JalaliMomentFactory {
    (input?: DateInput): JalaliMoment;
  }

  const moment: JalaliMomentFactory;

  export default moment;
}
