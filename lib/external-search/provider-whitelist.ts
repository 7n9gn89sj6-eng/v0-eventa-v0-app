export const PROVIDER_WHITELIST = ["eventbrite", "meetup", "facebook_events", "google_events", "stub_web"] as const

export type ProviderName = (typeof PROVIDER_WHITELIST)[number]

export function isWhitelistedProvider(provider: string): provider is ProviderName {
  return PROVIDER_WHITELIST.includes(provider as ProviderName)
}
