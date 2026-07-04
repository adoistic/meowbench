// Hand-written interim stub for Task 7 (vote/standings handlers).
// Task 8 runs `wrangler types` to regenerate this file with the full binding
// set from wrangler.jsonc; that generation showed IP_SALT (a secret) is not
// included automatically, so Task 8 will still need to extend Env with it
// (or otherwise reconcile) after regenerating.
interface Env {
  DB: D1Database
  IP_SALT: string
}
