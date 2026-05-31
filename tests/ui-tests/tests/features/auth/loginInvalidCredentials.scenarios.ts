/**
 * Backend login failure: `AuthService.login` throws `UnauthorizedException` with this exact string when
 * `validateUser` returns null — either no user for that email, or `bcrypt.compare` failed (wrong password).
 * Same message in both cases (no account enumeration). Not client `AuthMessages`; unrelated to
 * `testLoginInputFieldsScenarios` (field validation before submit).
 *
 * @see backend/src/auth/auth.service.ts (`login`, `validateUser`)
 */
export const LOGIN_INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password' as const;

/**
 * API-level cases: inputs must already pass client validation (`validateEmail` / `validatePassword`).
 * The “wrong password” row needs an email that exists in the DB (e.g. UserFactory in e2e).
 */
export const testLoginInvalidCredentialsScenarios = [
  {
    name: `${LOGIN_INVALID_CREDENTIALS_MESSAGE}: No user for this email (valid format)`,
    email: 'unregistered-login@example.com',
    password: 'ValidPass1!',
    expected: [LOGIN_INVALID_CREDENTIALS_MESSAGE],
  },
  {
    name: `${LOGIN_INVALID_CREDENTIALS_MESSAGE}: User exists but password does not match`,
    email: 'user@example.com',
    password: 'DefinitelyWrongPassword123!',
    expected: [LOGIN_INVALID_CREDENTIALS_MESSAGE],
  },
];
