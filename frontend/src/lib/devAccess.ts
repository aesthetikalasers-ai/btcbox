/**
 * Local-development escape hatch for account-scoped screens.
 *
 * `vite dev` compiles `import.meta.env.DEV` to `true`; a production build
 * compiles it to `false` and the branch is dropped, so a deployed bundle can
 * never open an account page without a session.
 *
 * This only bypasses client-side rendering. Every account endpoint still answers
 * `AUTH_REQUIRED`, so no balance, order or profile can be read, and no order,
 * deposit or withdrawal can be posted, until a real session exists.
 */
export const DEV_OPEN_ACCOUNT_PAGES: boolean = import.meta.env.DEV;

/**
 * Layout placeholder used by `/me` while the page is opened locally without a
 * session. Every field is empty, so the UI renders em dashes instead of values;
 * no name, e-mail, UID or balance is invented.
 */
export const DEV_ACCOUNT_PLACEHOLDER = {
  uid: "",
  username: "",
  email: "",
  balances: {},
  kyc: { status: "not_submitted" },
  twofa_enabled: false,
} as const;