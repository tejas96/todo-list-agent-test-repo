// Test-only stand-in for the "server-only" package.
// The real package throws when imported outside the react-server condition,
// so vitest.config.mts aliases "server-only" to this empty module.
// Production builds still use the real package.
export {};
