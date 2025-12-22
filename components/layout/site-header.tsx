"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, List, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/auth/user-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { VersionBadge } from "@/components/version-badge";

import { useI18n } from "@/lib/i18n/context";
import { getUserLocation, storeUserLocation, clearUserLocation, type UserLocation } from "@/lib/user-location";
import { reverseGeocodeDebounced } from "@/lib/geocoding";

export function SiteHeader() {
  const { t } = useI18n();
  const tCommon = t("common");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Load stored location on mount
  useEffect(() => {
    const stored = getUserLocation();
    if (stored) {
      setUserLocation(stored);
    }
  }, []);

  const handleLocationRequest = async () => {
    if (userLocation) {
      // If location exists, clear it
      clearUserLocation();
      setUserLocation(null);
      return;
    }

    setIsLoadingLocation(true);

    if (!navigator.geolocation) {
      setIsLoadingLocation(false);
      return;
    }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Reverse geocode to get city name and country
          try {
            const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
            if (response.ok) {
              const data = await response.json();
              const city = data.city;
              const country = data.country;

              if (city) {
                const location = { lat, lng, city, country };
                storeUserLocation(location);
                setUserLocation({ ...location, timestamp: Date.now() });
              }
            } else {
              // Fallback to old method if API fails
              const city = await reverseGeocodeDebounced(lat, lng);
              if (city) {
                const location = { lat, lng, city };
                storeUserLocation(location);
                setUserLocation({ ...location, timestamp: Date.now() });
              }
            }
          } catch (error) {
            console.error("[Header] Reverse geocoding error:", error);
            // Fallback to old method
            const city = await reverseGeocodeDebounced(lat, lng);
            if (city) {
              const location = { lat, lng, city };
              storeUserLocation(location);
              setUserLocation({ ...location, timestamp: Date.now() });
            }
          }

          setIsLoadingLocation(false);
        },
      (error) => {
        console.log("[Header] Geolocation error:", error.message);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
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
            className="gap-2 bg-transparent"
            onClick={handleLocationRequest}
            disabled={isLoadingLocation}
            title={userLocation ? `Location: ${userLocation.city}. Click to clear.` : "Detect my location"}
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
    </header>
  );
}
