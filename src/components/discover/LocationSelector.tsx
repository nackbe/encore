'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Map, Globe, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';

const LocationMap = dynamic(
  () => import('./LocationMap').then((m) => m.LocationMap),
  { ssr: false }
);

export interface LocationFilter {
  city: string;
  country: string;
  label: string;
  lat?: number;
  lng?: number;
  exactMatch?: boolean;
}

interface LocationSelectorProps {
  defaultCity: string;
  defaultCountry: string;
  availableCities: string[];
  availableCountries: string[];
  onLocationChange: (location: LocationFilter) => void;
}

/** Convert ISO code to flag emoji (renders as flag on mobile, as letter pair on Windows) */
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** Get localized country name from ISO code using Intl API */
function countryDisplayName(code: string, locale: string): string {
  if (!code || code.length !== 2) return code;
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'region' });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function LocationSelector({
  defaultCity,
  defaultCountry,
  availableCities,
  availableCountries,
  onLocationChange,
}: LocationSelectorProps) {
  const t = useTranslations('discover');
  const locale = useLocale();
  const [showMap, setShowMap] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Current selection state (code-level, not display)
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [exactMatch, setExactMatch] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pre-compute display names for search matching
  const countryDisplayMap = useMemo(() => {
    const result: Record<string, string> = {};
    availableCountries.forEach((code) => {
      result[code] = countryDisplayName(code, locale).toLowerCase();
    });
    return result;
  }, [availableCountries, locale]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Build a plain-text label for the LocationFilter (used by parent) */
  function buildLabel(city: string, country: string): string {
    const cName = country && country.length === 2 ? countryDisplayName(country, locale) : country;
    if (city && cName) return `${city}, ${cName}`;
    if (city) return city;
    if (cName) return cName;
    return t('allLocations');
  }

  /** Build the text shown in the main button */
  function currentLabelText(): string {
    if (selectedCity && selectedCountry) {
      return `${countryFlag(selectedCountry)} ${selectedCity}, ${countryDisplayName(selectedCountry, locale)}`;
    }
    if (selectedCountry) {
      return `${countryFlag(selectedCountry)} ${countryDisplayName(selectedCountry, locale)}`;
    }
    if (selectedCity) return selectedCity;
    return t('allLocations');
  }

  function selectLocation(city: string, country: string, keepMap = false) {
    setSelectedCity(city);
    setSelectedCountry(country);
    setShowDropdown(false);
    if (!keepMap) setShowMap(false);
    setSearchText('');
    onLocationChange({ city, country, label: buildLabel(city, country), exactMatch });
  }

  function handleMapSelect(location: { city: string; country: string; lat: number; lng: number }) {
    setSelectedCity(location.city);
    setSelectedCountry(location.country);
    setShowDropdown(false);
    setSearchText('');
    // Map always uses proximity (exactMatch forced off)
    setExactMatch(false);
    onLocationChange({
      city: location.city,
      country: location.country,
      label: buildLabel(location.city, location.country),
      lat: location.lat,
      lng: location.lng,
      exactMatch: false,
    });
  }

  function handleToggleExact() {
    const next = !exactMatch;
    setExactMatch(next);
    // Re-emit current location with updated exactMatch
    onLocationChange({
      city: selectedCity,
      country: selectedCountry,
      label: buildLabel(selectedCity, selectedCountry),
      exactMatch: next,
    });
  }

  // Filter cities/countries by search (match against display name, not just code)
  const filteredCities = searchText
    ? availableCities.filter((c) => c.toLowerCase().includes(searchText.toLowerCase()))
    : availableCities.slice(0, 10);

  const filteredCountries = searchText
    ? availableCountries.filter((code) => {
        const q = searchText.toLowerCase();
        const displayName = countryDisplayMap[code] ?? '';
        return code.toLowerCase().includes(q) || displayName.includes(q);
      })
    : availableCountries;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Text selector */}
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm transition-colors hover:border-primary/50"
          >
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-left font-medium">{currentLabelText()}</span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', showDropdown && 'rotate-180')} />
          </button>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {/* Search */}
              <div className="border-b border-border p-2">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t('searchLocation')}
                  className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="max-h-56 overflow-y-auto">
                {/* All locations */}
                <button
                  type="button"
                  onClick={() => selectLocation('', '')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {t('allLocations')}
                </button>

                {/* My location (only if user has a default) */}
                {defaultCity && (
                  <button
                    type="button"
                    onClick={() => selectLocation(defaultCity, defaultCountry)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>
                      {t('myLocation')}
                      <span className="ml-1 text-muted-foreground">
                        — {defaultCountry ? `${countryFlag(defaultCountry)} ` : ''}{defaultCity}{defaultCountry ? `, ${countryDisplayName(defaultCountry, locale)}` : ''}
                      </span>
                    </span>
                  </button>
                )}

                {/* Countries */}
                {filteredCountries.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('countries')}
                    </div>
                    {filteredCountries.map((code) => (
                      <button
                        key={`country-${code}`}
                        type="button"
                        onClick={() => selectLocation('', code)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      >
                        <span className="text-base leading-none">{countryFlag(code)}</span>
                        {countryDisplayName(code, locale)}
                      </button>
                    ))}
                  </>
                )}

                {/* Cities */}
                {filteredCities.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('cities')}
                    </div>
                    {filteredCities.map((city) => (
                      <button
                        key={`city-${city}`}
                        type="button"
                        onClick={() => selectLocation(city, '')}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {city}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Map toggle */}
        <button
          type="button"
          aria-label={showMap ? 'Hide map' : 'Show map'}
          onClick={() => { const next = !showMap; setShowMap(next); setShowDropdown(false); if (next) { setExactMatch(false); onLocationChange({ city: selectedCity, country: selectedCountry, label: buildLabel(selectedCity, selectedCountry), exactMatch: false }); } }}
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors',
            showMap
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <Map className="h-4 w-4" />
        </button>
      </div>

      {/* Exact match toggle — only visible when a location is selected and map is closed */}
      {(selectedCity || selectedCountry) && !showMap && (
        <button
          type="button"
          onClick={handleToggleExact}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              exactMatch ? 'bg-primary' : 'bg-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                exactMatch ? 'translate-x-[18px]' : 'translate-x-[3px]'
              )}
            />
          </span>
          {t('exactMatch')}
        </button>
      )}

      {/* Map view */}
      {showMap && (
        <div className="overflow-hidden rounded-xl border border-border">
          <LocationMap onSelect={handleMapSelect} />
        </div>
      )}
    </div>
  );
}
