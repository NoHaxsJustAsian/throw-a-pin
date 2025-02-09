import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Country, State, City, ICountry, IState, ICity } from 'country-state-city';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from './theme-toggle';
import { useTheme } from "next-themes"

interface SettingsProps {
  isLandOnly: boolean;
  setIsLandOnly: (value: boolean) => void;
  precision: number;
  setPrecision: (value: number) => void;
  throwNewPin: () => void;
  selectedCountry: string | null;
  setSelectedCountry: (country: string | null) => void;
  selectedState: string | null;
  setSelectedState: (state: string | null) => void;
  selectedCity: string | null;
  setSelectedCity: (city: string | null) => void;
  poiTypes?: string[];
  setPoiTypes?: (types: string[]) => void;
  findRestaurantsNearMe: () => void;
  isLoading: boolean;
  searchPrecision?: 'high' | 'medium' | 'low';
  setSearchPrecision?: (precision: 'high' | 'medium' | 'low') => void;
  findPOIsInView?: () => void;
  findRandomPOI?: () => void;
  isRoadtripMode?: boolean;
  setIsRoadtripMode?: (value: boolean) => void;
}

export default function Settings({
  isLandOnly = true,
  setIsLandOnly,
  precision: _precision,
  setPrecision,
  throwNewPin,
  selectedCountry,
  setSelectedCountry,
  selectedState,
  setSelectedState,
  selectedCity,
  setSelectedCity,
  poiTypes = [],
  setPoiTypes,
  findRestaurantsNearMe,
  isLoading,
  findPOIsInView,
  findRandomPOI,
  isRoadtripMode = false,
  setIsRoadtripMode,
}: SettingsProps) {
  const { theme } = useTheme()
  const [countries, setCountries] = useState<ICountry[]>([]);
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  useEffect(() => {
    setCountries(Country.getAllCountries());
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      setStates(State.getStatesOfCountry(selectedCountry));
      setSelectedState(null);
      setSelectedCity(null);
    } else {
      setStates([]);
    }
  }, [selectedCountry, setSelectedState, setSelectedCity]);

  useEffect(() => {
    if (selectedCountry && selectedState) {
      setCities(City.getCitiesOfState(selectedCountry, selectedState));
      setSelectedCity(null);
    } else {
      setCities([]);
    }
  }, [selectedCountry, selectedState, setSelectedCity]);

  // Automatically set precision based on selected location
  useEffect(() => {
    if (selectedCity) {
      setPrecision(4); // City level: ~10m precision
    } else if (selectedState) {
      setPrecision(2); // State level: ~1km precision
    } else if (selectedCountry) {
      setPrecision(1); // Country level: ~10km precision
    } else {
      setPrecision(0); // World level: ~100km precision
    }
  }, [selectedCity, selectedState, selectedCountry, setPrecision]);

  // Update button styles
  const buttonStyle = cn(
    "h-20 flex flex-col items-center justify-center space-y-1 w-full",
    theme === 'dark' 
      ? 'bg-gray-800 hover:bg-gray-700 text-white' 
      : 'bg-gray-100 hover:bg-gray-200 text-black'
  )

  // Update selector button styles
  const selectorStyle = cn(
    "w-full justify-between",
    theme === 'dark'
      ? 'bg-gray-800 hover:bg-gray-700 text-white'
      : 'bg-gray-100 hover:bg-gray-200 text-black'
  )

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-1 space-y-0">
        <CardTitle className="text-lg">Pin Settings</CardTitle>
        <CardDescription className="text-xs text-muted-foreground -mt-1">
          Configure how your pins are generated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between space-x-2 mt-2">
          <Label htmlFor="land-only" className="flex flex-col items-start text-left">
            <span className="text-sm">Land Only</span>
            <span className="font-normal text-xs text-muted-foreground">
              Only generate pins on land
            </span>
          </Label>
          <Switch
            id="land-only"
            checked={isLandOnly}
            onCheckedChange={setIsLandOnly}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="roadtrip-mode" className="flex flex-col items-start text-left">
            <span className="text-sm">Roadtrip Mode</span>
            <span className="font-normal text-xs text-muted-foreground">
              Only generate drivable locations
            </span>
          </Label>
          <Switch
            id="roadtrip-mode"
            checked={isRoadtripMode}
            onCheckedChange={setIsRoadtripMode}
          />
        </div>

        <Accordion type="multiple" defaultValue={["location"]} className="space-y-1">
          <AccordionItem value="location">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">Location Filtering</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Restrict pins to specific regions
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-3 pl-2 text-sm">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Country <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className={selectorStyle}
                      >
                        {selectedCountry
                          ? countries.find((country) => country.isoCode === selectedCountry)?.name
                          : "Select country..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search country..." />
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                          <CommandList>
                            <CommandItem
                              onSelect={() => {
                                setSelectedCountry(null);
                                setCountryOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !selectedCountry ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Any country
                            </CommandItem>
                            {countries.map((country) => (
                              <CommandItem
                                key={country.isoCode}
                                onSelect={() => {
                                  setSelectedCountry(country.isoCode);
                                  setCountryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCountry === country.isoCode
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {country.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedCountry && states.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>State/Province <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Popover open={stateOpen} onOpenChange={setStateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={stateOpen}
                          className={selectorStyle}
                        >
                          {selectedState
                            ? states.find((state) => state.isoCode === selectedState)?.name
                            : "Select state..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search state..." />
                          <CommandEmpty>No state found.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            <CommandList>
                              <CommandItem
                                onSelect={() => {
                                  setSelectedState(null);
                                  setStateOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !selectedState ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Any state
                              </CommandItem>
                              {states.map((state) => (
                                <CommandItem
                                  key={state.isoCode}
                                  onSelect={() => {
                                    setSelectedState(state.isoCode);
                                    setStateOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedState === state.isoCode
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {state.name}
                                </CommandItem>
                              ))}
                            </CommandList>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {selectedState && cities.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>City <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Popover open={cityOpen} onOpenChange={setCityOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={cityOpen}
                          className={selectorStyle}
                        >
                          {selectedCity || "Select city..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search city..." />
                          <CommandEmpty>No city found.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            <CommandList>
                              <CommandItem
                                onSelect={() => {
                                  setSelectedCity(null);
                                  setCityOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !selectedCity ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Any city
                              </CommandItem>
                              {cities.map((city) => (
                                <CommandItem
                                  key={city.name}
                                  onSelect={() => {
                                    setSelectedCity(city.name);
                                    setCityOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedCity === city.name
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {city.name}
                                </CommandItem>
                              ))}
                            </CommandList>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="poi">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">Points of Interest</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Select types of places to find
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-3 pl-2 text-sm">
              <div className="space-y-2">
                {[
                  { id: 'food', label: 'Food', icon: '🍽️' },
                  { id: 'bars', label: 'Bars', icon: '🍺' },
                  { id: 'entertainment', label: 'Entertainment', icon: '🎭' },
                  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
                  { id: 'arts', label: 'Arts', icon: '🎨' },
                  { id: 'nature', label: 'Nature', icon: '🌳' },
                  { id: 'tourist', label: 'Tourist', icon: '🎡' }
                ].map(type => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`poi-${type.id}`}
                      checked={poiTypes?.includes(type.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setPoiTypes?.([...poiTypes || [], type.id]);
                        } else {
                          setPoiTypes?.(poiTypes?.filter(t => t !== type.id) || []);
                        }
                      }}
                    />
                    <Label
                      htmlFor={`poi-${type.id}`}
                      className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={throwNewPin} 
              className={buttonStyle}
              disabled={isLoading}
            >
              <span className="text-2xl">📍</span>
              <span className="text-xs">Throw a New Pin</span>
            </Button>

            <Button 
              onClick={findRestaurantsNearMe}
              className="h-20 flex flex-col items-center justify-center space-y-1 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              variant="destructive"
              disabled={isLoading}
            >
              <span className="text-2xl">🍽️</span>
              <span className="text-xs">GF HUNGRY</span>
            </Button>

            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={findRandomPOI}
                    className={buttonStyle}
                    disabled={isLoading || !poiTypes?.length}
                  >
                    <span className="text-2xl">🎯</span>
                    <span className="text-xs">Random POI</span>
                  </Button>
                </TooltipTrigger>
                {!poiTypes?.length && (
                  <TooltipContent side="bottom">
                    <p>Select at least one POI category</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={findPOIsInView}
                    className={buttonStyle}
                    disabled={isLoading || !poiTypes?.length}
                  >
                    <span className="text-2xl">🔍</span>
                    <span className="text-xs">Find POIs in View</span>
                  </Button>
                </TooltipTrigger>
                {!poiTypes?.length && (
                  <TooltipContent side="bottom">
                    <p>Select at least one POI category</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
