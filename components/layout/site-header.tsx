"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, List, Loader2, AlertCircle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserNav } from "@/components/auth/user-nav";
import { LanguageSwitcher } from "@/components/language-switcher";

import { useI18n } from "@/lib/i18n/context";
import { useLocation } from "@/lib/location-context";

export function SiteHeader() {
  const { t } = useI18n();
  const tCommon = t("common");
  const { defaultLocation, isLoadingLocation: contextLoadingLocation, clearDefaultLocation, setDefaultLocation, requestUserLocation, lastLocationError, setLastLocationError } = useLocation();
  const [manualLoadingLocation, setManualLoadingLocation] = useState(false);
  const [enterCityOpen, setEnterCityOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [citySearchError, setCitySearchError] = useState<string | null>(null);

  const isLoadingLocation = manualLoadingLocation;

  const handleLocationRequest = async () => {
    if (defaultLocation) {
      clearDefaultLocation();
      setLastLocationError(null);
      return;
    }
    setManualLoadingLocation(true);
    setLastLocationError(null);
    try {
      await requestUserLocation({ maxRetries: 4 });
    } catch (err) {
      console.error("[Header] requestUserLocation threw:", err);
      setLastLocationError("We couldn't determine your location. You can still search by city name.");
    } finally {
      setManualLoadingLocation(false);
    }
  };

  const handleEnterCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = cityInput.trim();
    if (!query) return;
    setCitySearchError(null);
    setCitySearchLoading(true);
    try {
      const res = await fetch(`/api/geocode/forward?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data.code as string | undefined;
        const message =
          res.status === 503 || code === "SERVICE_UNAVAILABLE"
            ? "Location search is not available right now. Please try again later."
            : res.status === 404 || code === "NO_RESULTS"
              ? "No results found. Try another city or place name."
              : (data.error as string) || `Search failed (${res.status})`;
        setCitySearchError(message);
        return;
      }
      setDefaultLocation(
        {
          city: data.city,
          country: data.country,
          lat: data.lat,
          lng: data.lng,
          source: "manual",
        },
        "manual"
      );
      setLastLocationError(null);
      setCityInput("");
      setEnterCityOpen(false);
    } catch (err) {
      setCitySearchError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setCitySearchLoading(false);
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo + Home link */}
        <Link href="/" className="flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          <h1 className="text-xl font-bold">Eventa</h1>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Browse button (desktop and larger mobiles only) */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent hidden sm:inline-flex"
            asChild
          >
            <Link href="/events">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{tCommon("browse")}</span>
            </Link>
          </Button>

          {/* Location: detect or enter city */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 min-h-[44px] touch-manipulation active:scale-95 ${
                defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location"
                  ? "bg-primary/10 border-primary/20"
                  : "bg-transparent"
              }`}
              onClick={handleLocationRequest}
              disabled={isLoadingLocation}
              title={
                defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location"
                  ? `Location: ${defaultLocation.city}${defaultLocation.country ? `, ${defaultLocation.country}` : ""}. Click to clear.`
                  : "Detect my location"
              }
              aria-label={
                defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location"
                  ? `Clear location: ${defaultLocation.city}`
                  : "Detect my location"
              }
              type="button"
              style={{
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {isLoadingLocation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Finding your location…</span>
                </>
              ) : defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location" ? (
                <>
                  <Check className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline">
                    {defaultLocation.city}
                    {defaultLocation.country ? `, ${defaultLocation.country}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">{tCommon("location")}</span>
                </>
              )}
            </Button>
            <Popover open={enterCityOpen} onOpenChange={setEnterCityOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex min-h-[44px] text-muted-foreground hover:text-foreground"
                  aria-label="Enter city"
                >
                  Enter city
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <form onSubmit={handleEnterCity} className="space-y-3">
                  <label htmlFor="header-city-input" className="text-sm font-medium">
                    City or place
                  </label>
                  <Input
                    id="header-city-input"
                    type="text"
                    placeholder="e.g. Berlin, London"
                    value={cityInput}
                    onChange={(e) => {
                      setCityInput(e.target.value);
                      setCitySearchError(null);
                    }}
                    disabled={citySearchLoading}
                    autoFocus
                    className="h-9"
                  />
                  {citySearchError && (
                    <p className="text-xs text-destructive">{citySearchError}</p>
                  )}
                  <Button type="submit" size="sm" disabled={citySearchLoading || !cityInput.trim()}>
                    {citySearchLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching…
                      </>
                    ) : (
                      "Set location"
                    )}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          </div>

          {/* Language selector */}
          <LanguageSwitcher />

          {/* User login dropdown */}
          <UserNav />
        </div>
      </div>

      {/* Single location error banner (context-driven; avoids duplicate with search bar) */}
      {lastLocationError && (
        <div className="container mx-auto px-4 pb-2">
          <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm flex flex-col gap-2">
              <span>{lastLocationError}</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  onClick={handleLocationRequest}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  onClick={() => {
                    setEnterCityOpen(true);
                  }}
                >
                  Enter city
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </header>
  );
}
