"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, List, Loader2, X, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserNav } from "@/components/auth/user-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { VersionBadge } from "@/components/version-badge";

import { useI18n } from "@/lib/i18n/context";
import { getUserLocation, storeUserLocation, clearUserLocation, type UserLocation } from "@/lib/user-location";
import { reverseGeocodeDebounced } from "@/lib/geocoding";

type GeolocationErrorCode = "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "NOT_SUPPORTED" | "HTTPS_REQUIRED" | null;

export function SiteHeader() {
  const { t } = useI18n();
  const tCommon = t("common");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [geolocationError, setGeolocationError] = useState<GeolocationErrorCode>(null);

  // Load stored location on mount
  useEffect(() => {
    const stored = getUserLocation();
    if (stored) {
      setUserLocation(stored);
    }
  }, []);

  // Helper to detect if we're on localhost
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || 
     window.location.hostname === "127.0.0.1" || 
     window.location.hostname.startsWith("192.168.") ||
     window.location.hostname.startsWith("10."));

  const handleLocationRequest = async () => {
    console.log("[Header] Location button clicked", { userLocation, isLoadingLocation });
    
    try {
      if (userLocation) {
        // If location exists, clear it
        console.log("[Header] Clearing existing location");
        clearUserLocation();
        setUserLocation(null);
        setGeolocationError(null);
        return;
      }

      console.log("[Header] Starting location detection");
      setIsLoadingLocation(true);
      setGeolocationError(null); // Clear previous errors

      // Check if geolocation is available
      if (!navigator.geolocation) {
        console.warn("[Header] Geolocation API not available");
        setIsLoadingLocation(false);
        setGeolocationError("NOT_SUPPORTED");
        return;
      }

      // Check HTTPS requirement (skip on localhost - expected to fail there)
      if (!isLocalhost && typeof window !== "undefined" && window.location.protocol !== "https:") {
        console.warn("[Header] Geolocation requires HTTPS (non-localhost)");
        setIsLoadingLocation(false);
        setGeolocationError("HTTPS_REQUIRED");
        return;
      }

      // On localhost, expect geolocation to fail gracefully
      if (isLocalhost) {
        console.log("[Header] Localhost detected - geolocation may fail (expected)");
      }

      console.log("[Header] Requesting geolocation permission");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log("[Header] Geolocation success:", position.coords);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Reverse geocode to get city name and country
          try {
            console.log("[Header] Reverse geocoding coordinates:", { lat, lng });
            const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
            if (response.ok) {
              const data = await response.json();
              const city = data.city;
              const country = data.country;

              console.log("[Header] Reverse geocoding result:", { city, country });

              if (city) {
                const location = { lat, lng, city, country };
                storeUserLocation(location);
                setUserLocation({ ...location, timestamp: Date.now() });
                console.log("[Header] Location stored successfully:", city);
              } else {
                console.warn("[Header] No city found in reverse geocoding result");
              }
            } else {
              console.warn("[Header] Reverse geocoding API failed, trying fallback");
              // Fallback to old method if API fails
              const city = await reverseGeocodeDebounced(lat, lng);
              if (city) {
                const location = { lat, lng, city };
                storeUserLocation(location);
                setUserLocation({ ...location, timestamp: Date.now() });
                console.log("[Header] Fallback geocoding successful:", city);
              }
            }
          } catch (error) {
            console.error("[Header] Reverse geocoding error:", error);
            // Fallback to old method
            try {
              const city = await reverseGeocodeDebounced(lat, lng);
              if (city) {
                const location = { lat, lng, city };
                storeUserLocation(location);
                setUserLocation({ ...location, timestamp: Date.now() });
                console.log("[Header] Fallback geocoding successful:", city);
              }
            } catch (fallbackError) {
              console.error("[Header] Fallback geocoding also failed:", fallbackError);
            }
          }

          setIsLoadingLocation(false);
          setGeolocationError(null); // Clear any previous errors on success
        },
        (error) => {
          // Map error codes to our error type
          let errorCode: GeolocationErrorCode = null;
          
          if (error.code === error.PERMISSION_DENIED) {
            errorCode = "PERMISSION_DENIED";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorCode = "POSITION_UNAVAILABLE";
          } else if (error.code === error.TIMEOUT) {
            errorCode = "TIMEOUT";
          }

          console.warn("[Header] Geolocation error:", {
            code: error.code,
            message: error.message,
            errorCode,
            isLocalhost,
          });
          
          // On localhost, this is expected - don't show error to user
          if (isLocalhost) {
            console.log("[Header] Geolocation failed on localhost (expected behavior)");
            setIsLoadingLocation(false);
            setGeolocationError(null); // Don't show error on localhost
            return;
          }

          // On production, show user-friendly error message
          setGeolocationError(errorCode);
          setIsLoadingLocation(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // Cache for 5 minutes
        }
      );
    } catch (error) {
      console.error("[Header] Unexpected error in handleLocationRequest:", error);
      setIsLoadingLocation(false);
      // Don't show error for unexpected errors - just log and continue
      // Search still works without location
    }
  };

  // Get user-friendly error message
  const getErrorMessage = (errorCode: GeolocationErrorCode): string => {
    switch (errorCode) {
      case "PERMISSION_DENIED":
        return "Location permission was denied. You can still search by entering a city name.";
      case "POSITION_UNAVAILABLE":
        return "Location information is unavailable. You can still search by entering a city name.";
      case "TIMEOUT":
        return "Location request timed out. You can still search by entering a city name.";
      case "NOT_SUPPORTED":
        return "Location detection is not supported in your browser. You can still search by entering a city name.";
      case "HTTPS_REQUIRED":
        return "Location detection requires a secure connection (HTTPS). You can still search by entering a city name.";
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
            className="gap-2 bg-transparent min-h-[44px] min-w-[44px] touch-manipulation active:scale-95"
            onClick={handleLocationRequest}
            disabled={isLoadingLocation}
            title={userLocation ? `Location: ${userLocation.city}. Click to clear.` : "Detect my location"}
            aria-label={userLocation ? `Clear location: ${userLocation.city}` : "Detect my location"}
            type="button"
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            {isLoadingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : userLocation ? (
              <X className="h-4 w-4" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {userLocation ? userLocation.city : tCommon("location")}
            </span>
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
