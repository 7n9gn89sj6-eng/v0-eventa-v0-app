// Check if authentication is enabled via public environment variable
// This ensures server and client have the same auth state
export const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"

// Alias for backwards compatibility
export const isAuthConfigured = isAuthEnabled
