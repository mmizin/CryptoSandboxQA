/**
 * Client-side login field validation (`validateEmail` / `validatePassword` from `authFieldConstraints`).
 *
 * The login form uses `<input type="email">` and `<input minLength={6}>`, so the browser often runs
 * constraint validation before React `onSubmit`. In those cases the app does not render
 * `login-email-error` / `login-password-error`; the browser shows its native hint instead. Tests assert
 * either the React message (when visible) or `validity.valid === false` on the relevant input.
 *
 * The email field has `maxLength={EMAIL_MAX_LENGTH}`, so values longer than the max never reach React;
 * the "email too long" rows assert the value is capped instead of expecting an inline message.
 *
 * API errors after submit live in `loginInvalidCredentials.scenarios.ts`.
 */
import {
    AuthMessages,
    EMAIL_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
} from 'frontend/lib/authFieldConstraints';

import * as allure from "allure-js-commons";
import { test, expect } from '@/fixtures';

/** Messages intended for the email field (React `login-email-error` when native validation does not run first). */
const EMAIL_FIELD_MESSAGES = new Set<string>([
    AuthMessages.emailRequired,
    AuthMessages.emailInvalid,
    AuthMessages.emailTooLong,
]);

/** One character over `EMAIL_MAX_LENGTH`; local part is valid per `validateEmail` regex if length were allowed */
const EMAIL_ONE_CHAR_OVER_MAX =
    'a'.repeat(EMAIL_MAX_LENGTH + 1 - '@b.co'.length) + '@b.co';

export const testLoginInputFieldsScenarios = [
    // --- emailRequired ---
    {
        name: `${AuthMessages.emailRequired}: Empty email`,
        email: '',
        password: '123456',
        expected: [AuthMessages.emailRequired]
    },
    {
        name: `${AuthMessages.emailRequired}: Whitespace only — trim() is empty`,
        email: '   ',
        password: '123456',
        expected: [AuthMessages.emailRequired]
    },

    // --- emailTooLong ---
    {
        name: `${AuthMessages.emailTooLong}: One character over max length (rejects before format check)`,
        email: EMAIL_ONE_CHAR_OVER_MAX,
        password: '123456',
        expected: [AuthMessages.emailTooLong]
    },
    {
        name: `${AuthMessages.emailTooLong}: Very long value (truncation / buffer risk in logs or proxies)`,
        email: 'a'.repeat(500) + '@b.co',
        password: '123456',
        expected: [AuthMessages.emailTooLong]
    },

    // --- emailInvalid ---
    {
        name: `${AuthMessages.emailInvalid}: Local part missing @ — common typo; wrong routing risk`,
        email: 'userdomain.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Missing domain after @ — incomplete address`,
        email: 'user@',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Missing local part before @ — invalid shape`,
        email: '@example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Multiple @ — parser ambiguity; metrics mis-bucketing`,
        email: 'user@@example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Internal whitespace — duplicate-account risk if trim differs`,
        email: 'user @example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Double dot in domain — DNS-invalid`,
        email: 'user@example..com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Trailing dot on domain — invalid host`,
        email: 'user@example.com.',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Comma in local part — not allowed by regex`,
        email: 'user,name@example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Tab in local part — not allowed by regex`,
        email: 'user\t@example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Angle brackets / markup — XSS or broken HTML if echoed unsanitized`,
        email: 'user<tag>@example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Newline in value — header / log injection if concatenated unsafely`,
        email: 'user\n@example.com',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },
    {
        name: `${AuthMessages.emailInvalid}: Generic invalid email — non-RFC string`,
        email: 'invalid-email',
        password: '123456',
        expected: [AuthMessages.emailInvalid]
    },

    // --- passwordRequired ---
    // validatePassword: falsy → passwordRequired (only ''). Non-empty short passwords → passwordTooShort.
    {
        name: `${AuthMessages.passwordRequired}: Empty password with valid email`,
        email: 'user@example.com',
        password: '',
        expected: [AuthMessages.passwordRequired]
    },

    // --- passwordTooShort ---
    // Non-empty and length < PASSWORD_MIN_LENGTH (6). Not the same as passwordRequired ('' is falsy).
    {
        name: `${AuthMessages.passwordTooShort}: One character — shortest non-empty that is still too short`,
        email: 'user@example.com',
        password: 'a',
        expected: [AuthMessages.passwordTooShort]
    },
    {
        name: `${AuthMessages.passwordTooShort}: Length ${PASSWORD_MIN_LENGTH - 1} — one below minimum (boundary vs length ${PASSWORD_MIN_LENGTH})`,
        email: 'user@example.com',
        password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
        expected: [AuthMessages.passwordTooShort]
    },
    {
        name: `${AuthMessages.passwordTooShort}: Only spaces, length ${PASSWORD_MIN_LENGTH - 1} — truthy, not empty (differs from passwordRequired)`,
        email: 'user@example.com',
        password: ' '.repeat(PASSWORD_MIN_LENGTH - 1),
        expected: [AuthMessages.passwordTooShort]
    },
]

test.describe("Login field validation (client)", { tag: ["@client-validation", "@merge-gate"] }, () => {
    test.beforeEach(async () => {
        await allure.epic("Authentication");
        await allure.feature("Login client validation");
    });

    testLoginInputFieldsScenarios.forEach(({ name, email, password, expected }) => {
        test(name, async ({ pages }) => {
            const [message] = expected;
            await pages.login.goto();
            await pages.login.emailInput.fill(email);
            await pages.login.passwordInput.fill(password);
            await pages.login.submitButton.click();

            if (message === AuthMessages.emailTooLong) {
                const value = await pages.login.emailInput.inputValue();
                expect(value.length).toBe(EMAIL_MAX_LENGTH);
                expect(email.length).toBeGreaterThan(EMAIL_MAX_LENGTH);
                await expect(pages.login.emailError).toHaveCount(0);
                return;
            }

            const useEmailField = EMAIL_FIELD_MESSAGES.has(message);
            const errorLocator = useEmailField
                ? pages.login.emailError
                : pages.login.passwordError;
            const inputLocator = useEmailField
                ? pages.login.emailInput
                : pages.login.passwordInput;

            if (await errorLocator.isVisible()) {
                await expect(errorLocator).toHaveText(message);
                return;
            }

            await expect
                .poll(async () =>
                    inputLocator.evaluate((el: HTMLInputElement) => el.validity.valid),
                )
                .toBe(false);
        });
    });
});
