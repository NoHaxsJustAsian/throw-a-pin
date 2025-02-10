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
                        className="w-full justify-between"
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
                          className="w-full justify-between"
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
                          className="w-full justify-between"
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
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-start text-left opacity-50 cursor-not-allowed w-full">
                      <span className="text-sm font-medium">Points of Interest</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        Select types of places to find
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    <p>POI features temporarily disabled - servers cost money 😢</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-3 pl-2 text-sm opacity-50">
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
                      checked={false}
                      disabled={true}
                    />
                    <Label
                      htmlFor={`poi-${type.id}`}
                      className="text-sm font-normal flex items-center gap-1.5 cursor-not-allowed"
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
              className="h-20 flex flex-col items-center justify-center space-y-1 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30"
              variant="ghost"
              disabled={isLoading}
            >
              <span className="text-2xl">📍</span>
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold text-primary">Throw a New Pin</span>
                <span className="text-[10px] text-muted-foreground">Find your next destination</span>
              </div>
            </Button>

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button 
                      className="h-20 flex flex-col items-center justify-center space-y-1 w-full bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 cursor-help"
                      variant="ghost"
                      disabled={true}
                    >
                      <span className="text-2xl">🍽️</span>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">GF HUNGRY</span>
                        <span className="text-[10px] text-muted-foreground">Find restaurants nearby</span>
                      </div>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5} className="w-[300px]">
                  <div className="space-y-2">
                    <p className="text-sm">Restaurant search disabled - APIs are expensive 😢</p>
                    <p className="text-xs text-muted-foreground">Check out how it works:</p>
                    <video 
                      src="/gfhungrydemo.mp4" 
                      className="rounded-lg w-full"
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                    />
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button 
                      className="h-20 flex flex-col items-center justify-center space-y-1 w-full bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 cursor-help"
                      variant="ghost"
                      disabled={true}
                    >
                      <span className="text-2xl">🎯</span>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Random POI</span>
                        <span className="text-[10px] text-muted-foreground">Find a random place</span>
                      </div>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>POI features disabled - APIs are expensive, see hero page for demo 😢</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button 
                      className="h-20 flex flex-col items-center justify-center space-y-1 w-full bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 cursor-help"
                      variant="ghost"
                      disabled={true}
                    >
                      <span className="text-2xl">🔍</span>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Find POIs in View</span>
                        <span className="text-[10px] text-muted-foreground">Explore current area</span>
                      </div>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>POI features disabled - APIs are expensive, see hero page for demo 😢</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}