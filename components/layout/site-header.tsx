"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Calendar, MapPin, List, Loader2, AlertCircle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserNav } from "@/components/auth/user-nav";
import { LanguageSwitcher } from "@/components/language-switcher";

import { useI18n } from "@/lib/i18n/context";
import { useLocation } from "@/lib/location-context";
import { getUserLocation } from "@/lib/user-location";

const LOCATION_FAILURE_HINT =
  "Location can be unreliable on some desktops. Enter your city or suburb instead.";

export function SiteHeader() {
  const { t } = useI18n();
  const tCommon = t("common");
  const { defaultLocation, isLoadingLocation: contextLoadingLocation, clearDefaultLocation, setDefaultLocation, requestUserLocation, lastLocationError, setLastLocationError } = useLocation();
  const [manualLoadingLocation, setManualLoadingLocation] = useState(false);
  const [enterCityOpen, setEnterCityOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [citySearchError, setCitySearchError] = useState<string | null>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const lastAutoOpenedForErrorRef = useRef<string | null>(null);

  const isLoadingLocation = manualLoadingLocation;

  const openManualLocationEntry = useCallback((source: "banner_cta" | "auto_after_failure") => {
    console.log("[LocationUX] manual_entry_opened", { source });
    setEnterCityOpen(true);
    setCitySearchError(null);
    const stored = getUserLocation();
    if (stored?.city && stored.city !== "Unknown location" && stored.city !== "Current location") {
      setCityInput((prev) =>
        prev.trim() ? prev : `${stored.city}${stored.country ? `, ${stored.country}` : ""}`,
      );
    }
    requestAnimationFrame(() => {
      window.setTimeout(() => cityInputRef.current?.focus(), 150);
    });
  }, []);

  useEffect(() => {
    if (!lastLocationError) {
      lastAutoOpenedForErrorRef.current = null;
      return;
    }
    if (lastAutoOpenedForErrorRef.current === lastLocationError) return;
    lastAutoOpenedForErrorRef.current = lastLocationError;
    console.log("[LocationUX] geolocation_failed", { bannerShown: true });
    openManualLocationEntry("auto_after_failure");
  }, [lastLocationError, openManualLocationEntry]);

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

          {/* Location: detect or enter city (popover anchors to map control for banner-driven open on mobile) */}
          <Popover open={enterCityOpen} onOpenChange={setEnterCityOpen}>
            <div className="flex items-center gap-1">
              <PopoverAnchor className="inline-flex shrink-0">
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
              </PopoverAnchor>
              <PopoverTrigger asChild>
                <span className="hidden sm:inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] text-muted-foreground hover:text-foreground"
                    aria-label="Enter city"
                  >
                    Enter city
                  </Button>
                </span>
              </PopoverTrigger>
            </div>
            <PopoverContent className="w-80" align="end">
                <form onSubmit={handleEnterCity} className="space-y-3">
                  <label htmlFor="header-city-input" className="text-sm font-medium">
                    City or place
                  </label>
                  <Input
                    ref={cityInputRef}
                    id="header-city-input"
                    type="text"
                    placeholder="e.g. Berlin, London"
                    value={cityInput}
                    onChange={(e) => {
                      setCityInput(e.target.value);
                      setCitySearchError(null);
                    }}
                    disabled={citySearchLoading}
                    autoFocus={enterCityOpen}
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

          {/* Language selector */}
          <LanguageSwitcher />

          {/* User login dropdown */}
          <UserNav />
        </div>
      </div>

      {/* Single location error banner (context-driven; avoids duplicate with search bar) */}
      {lastLocationError && (
        <div className="container mx-auto px-4 pb-2" data-testid="location-error-banner">
          <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm flex flex-col gap-2">
              <span>{lastLocationError}</span>
              <p className="text-xs text-amber-900/85 dark:text-amber-100/90" data-testid="location-failure-hint">
                {LOCATION_FAILURE_HINT}
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="w-fit"
                  onClick={() => openManualLocationEntry("banner_cta")}
                >
                  Enter city
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  onClick={handleLocationRequest}
                >
                  Try again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </header>
  );
}
