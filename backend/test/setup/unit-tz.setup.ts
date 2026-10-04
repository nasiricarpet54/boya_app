/**
 * Pin the process timezone for unit tests.
 *
 * `JalaliDateService` is display-only and builds "Tehran midnight" wall clocks
 * through `date-fns-jalali`, which has no timezone of its own (see README). Its
 * specs assert Tehran-derived UTC instants, so the suite matches its expectations
 * only when Node runs in Asia/Tehran. CI images default to UTC, so pin TZ here
 * rather than trusting the host.
 */
process.env.TZ = 'Asia/Tehran';