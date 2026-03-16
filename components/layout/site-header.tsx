"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, List, Loader2, X, AlertCircle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserNav } from "@/components/auth/user-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { VersionBadge } from "@/components/version-badge";

import { useI18n } from "@/lib/i18n/context";
import { useLocation } from "@/lib/location-context";
import type { GeolocationErrorCode } from "@/lib/location-context";

type HeaderGeolocationErrorCode = GeolocationErrorCode | "TIMEOUT_GRANTED";

export function SiteHeader() {
  const { t } = useI18n();
  const tCommon = t("common");
  const { defaultLocation, isLoadingLocation: contextLoadingLocation, clearDefaultLocation, requestUserLocation } = useLocation();
  const [manualLoadingLocation, setManualLoadingLocation] = useState(false);
  const [geolocationError, setGeolocationError] = useState<HeaderGeolocationErrorCode>(null);

  const isLoadingLocation = manualLoadingLocation;

  const handleLocationRequest = async () => {
    if (defaultLocation) {
      clearDefaultLocation();
      setGeolocationError(null);
      return;
    }
    setManualLoadingLocation(true);
    setGeolocationError(null);
    try {
      const result = await requestUserLocation({ maxRetries: 3 });
      if (result.success) {
        setGeolocationError(null);
      } else {
        setGeolocationError(result.errorCode);
      }
    } catch (err) {
      console.error("[Header] requestUserLocation threw:", err);
      setGeolocationError("POSITION_UNAVAILABLE");
    } finally {
      setManualLoadingLocation(false);
    }
  };

  const getErrorMessage = (errorCode: HeaderGeolocationErrorCode): string => {
    switch (errorCode) {
      case "PERMISSION_DENIED":
        return "Location permission was denied. You can still search by entering a city name.";
      case "POSITION_UNAVAILABLE":
        return "We couldn't determine your location right now (e.g. GPS off or weak signal). You can still search by city name.";
      case "TIMEOUT_GRANTED":
        return "We couldn't determine your location right now. This can happen on some networks. You can still search by city.";
      case "TIMEOUT":
        return "Location request timed out. You can still search by entering a city name.";
      case "NOT_SUPPORTED":
        return "Location detection is not supported in your browser. You can still search by entering a city name.";
      case "HTTPS_REQUIRED":
        return "Location detection requires a secure connection (HTTPS). You can still search by entering a city name.";
      case "REVERSE_GEOCODE_FAILURE":
        return "Location detected but we couldn't resolve the city name. You can still search by city.";
      default:
        return "";
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
          {/* Version badge visible on desktop */}
          <div className="hidden md:block">
            <VersionBadge />
          </div>

          {/* Browse button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            asChild
          >
            <Link href="/events">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{tCommon("browse")}</span>
            </Link>
          </Button>

          {/* Location button */}
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
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
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
                  {defaultLocation.city}{defaultLocation.country ? `, ${defaultLocation.country}` : ""}
                </span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">{tCommon("location")}</span>
              </>
            )}
          </Button>

          {/* Language selector */}
          <LanguageSwitcher />

          {/* User login dropdown */}
          <UserNav />
        </div>
      </div>

      {/* Version badge on mobile */}
      <div className="md:hidden flex justify-center pb-2">
        <VersionBadge />
      </div>

      {/* Inline geolocation error message */}
      {geolocationError && (
        <div className="container mx-auto px-4 pb-2">
          <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              {getErrorMessage(geolocationError)}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </header>
  );
}
