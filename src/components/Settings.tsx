"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Cog } from "lucide-react"
import { cn } from "@/lib/utils"
import { Country, State, City, type ICountry, type IState, type ICity } from "country-state-city"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SettingsProps {
  isLandOnly: boolean
  setIsLandOnly: (value: boolean) => void
  precision: number
  setPrecision: (value: number) => void
  throwNewPin: () => void
  selectedCountry: string | null
  setSelectedCountry: (country: string | null) => void
  selectedState: string | null
  setSelectedState: (state: string | null) => void
  selectedCity: string | null
  setSelectedCity: (city: string | null) => void
  enablePOI?: boolean
  setEnablePOI?: (value: boolean) => void
  poiType?: "food" | "entertainment" | "shopping" | "tourism" | null
  setPoiType?: (type: "food" | "entertainment" | "shopping" | "tourism" | null) => void
  poiRadius?: number
  setPoiRadius?: (radius: number) => void
  findRestaurantInArea?: () => void
  findRestaurant: boolean
  setFindRestaurant: (value: boolean) => void
  findRestaurantsNearMe: () => void
  isLoading: boolean
  searchPrecision?: "high" | "medium" | "low"
  setSearchPrecision?: (precision: "high" | "medium" | "low") => void
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
  enablePOI,
  setEnablePOI,
  poiType,
  setPoiType,
  poiRadius,
  setPoiRadius,
  findRestaurantInArea,
  findRestaurant,
  setFindRestaurant,
  findRestaurantsNearMe,
  isLoading,
  searchPrecision = "medium",
  setSearchPrecision,
}: SettingsProps) {
  const [countries, setCountries] = useState<ICountry[]>([])
  const [states, setStates] = useState<IState[]>([])
  const [cities, setCities] = useState<ICity[]>([])
  const [countryOpen, setCountryOpen] = useState(false)
  const [stateOpen, setStateOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setCountries(Country.getAllCountries())
  }, [])

  useEffect(() => {
    if (selectedCountry) {
      setStates(State.getStatesOfCountry(selectedCountry))
      setSelectedState(null)
      setSelectedCity(null)
    } else {
      setStates([])
    }
  }, [selectedCountry, setSelectedState, setSelectedCity])

  useEffect(() => {
    if (selectedCountry && selectedState) {
      setCities(City.getCitiesOfState(selectedCountry, selectedState))
      setSelectedCity(null)
    } else {
      setCities([])
    }
  }, [selectedCountry, selectedState, setSelectedCity])

  // Automatically set precision based on selected location
  useEffect(() => {
    if (selectedCity) {
      setPrecision(4) // City level: ~10m precision
    } else if (selectedState) {
      setPrecision(2) // State level: ~1km precision
    } else if (selectedCountry) {
      setPrecision(1) // Country level: ~10km precision
    } else {
      setPrecision(0) // World level: ~100km precision
    }
  }, [selectedCity, selectedState, selectedCountry, setPrecision])

  return (
    <>
      <Button className="absolute bottom-4 right-4 z-10" onClick={() => setIsOpen(!isOpen)}>
        <Cog className="mr-2 h-4 w-4" /> Settings
      </Button>
      {isOpen && (
        <div className="absolute bottom-16 right-4 z-10 w-80 max-h-[calc(100vh-5rem)] overflow-y-auto bg-background/80 backdrop-blur-sm rounded-lg shadow-lg">
          <Card className="border-0">
            <CardContent className="p-4">
              <CardHeader>
                <CardTitle>Pin Settings</CardTitle>
                <CardDescription>Configure how your pins are generated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Accordion type="multiple" defaultValue={["basic", "search"]}>
                  <AccordionItem value="basic">
                    <AccordionTrigger>Basic Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="land-only" className="flex flex-col space-y-1">
                          <span>Land Only</span>
                          <span className="font-normal text-sm text-muted-foreground">Only generate pins on land</span>
                        </Label>
                        <Switch id="land-only" checked={isLandOnly} onCheckedChange={setIsLandOnly} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="location">
                    <AccordionTrigger>Location Filtering</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>
                            Country <span className="text-sm text-muted-foreground">(optional)</span>
                          </Label>
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
                                        setSelectedCountry(null)
                                        setCountryOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn("mr-2 h-4 w-4", !selectedCountry ? "opacity-100" : "opacity-0")}
                                      />
                                      Any country
                                    </CommandItem>
                                    {countries.map((country) => (
                                      <CommandItem
                                        key={country.isoCode}
                                        onSelect={() => {
                                          setSelectedCountry(country.isoCode)
                                          setCountryOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedCountry === country.isoCode ? "opacity-100" : "opacity-0",
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
                          <div className="space-y-2">
                            <Label>
                              State/Province <span className="text-sm text-muted-foreground">(optional)</span>
                            </Label>
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
                                          setSelectedState(null)
                                          setStateOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn("mr-2 h-4 w-4", !selectedState ? "opacity-100" : "opacity-0")}
                                        />
                                        Any state
                                      </CommandItem>
                                      {states.map((state) => (
                                        <CommandItem
                                          key={state.isoCode}
                                          onSelect={() => {
                                            setSelectedState(state.isoCode)
                                            setStateOpen(false)
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              selectedState === state.isoCode ? "opacity-100" : "opacity-0",
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
                          <div className="space-y-2">
                            <Label>
                              City <span className="text-sm text-muted-foreground">(optional)</span>
                            </Label>
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
                                          setSelectedCity(null)
                                          setCityOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn("mr-2 h-4 w-4", !selectedCity ? "opacity-100" : "opacity-0")}
                                        />
                                        Any city
                                      </CommandItem>
                                      {cities.map((city) => (
                                        <CommandItem
                                          key={city.name}
                                          onSelect={() => {
                                            setSelectedCity(city.name)
                                            setCityOpen(false)
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              selectedCity === city.name ? "opacity-100" : "opacity-0",
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
                    <AccordionTrigger>Points of Interest</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between space-x-2">
                          <Label htmlFor="find-restaurant" className="flex flex-col space-y-1">
                            <span>Random Food</span>
                            <span className="font-normal text-sm text-muted-foreground">
                              Find a random place to eat when throwing pins
                            </span>
                          </Label>
                          <Switch id="find-restaurant" checked={findRestaurant} onCheckedChange={setFindRestaurant} />
                        </div>

                        <div className="pt-6 border-t">
                          <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="enable-poi" className="flex flex-col space-y-1">
                              <span>Other POI Search</span>
                              <span className="font-normal text-sm text-muted-foreground">
                                Find other interesting places nearby
                              </span>
                            </Label>
                            <Switch id="enable-poi" checked={enablePOI} onCheckedChange={setEnablePOI} />
                          </div>

                          {enablePOI && (
                            <>
                              <div className="space-y-2 mt-4">
                                <Label>
                                  POI Type <span className="text-sm text-muted-foreground">(optional)</span>
                                </Label>
                                <Select
                                  value={poiType || "any"}
                                  onValueChange={(value) => setPoiType?.(value === "any" ? null : (value as any))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select POI type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="any">Any type</SelectItem>
                                    <SelectItem value="food">Food & Drink</SelectItem>
                                    <SelectItem value="entertainment">Entertainment</SelectItem>
                                    <SelectItem value="shopping">Shopping</SelectItem>
                                    <SelectItem value="tourism">Tourism</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2 mt-4">
                                <Label>
                                  POI Search Radius <span className="text-sm text-muted-foreground">(kilometers)</span>
                                </Label>
                                <Select
                                  value={poiRadius?.toString() || "2000"}
                                  onValueChange={(value) => setPoiRadius?.(Number.parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select radius" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1000">1km</SelectItem>
                                    <SelectItem value="2000">2km</SelectItem>
                                    <SelectItem value="5000">5km</SelectItem>
                                    <SelectItem value="10000">10km</SelectItem>
                                    <SelectItem value="30000">30km</SelectItem>
                                    <SelectItem value="50000">50km</SelectItem>
                                    <SelectItem value="100000">100km</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="search">
                    <AccordionTrigger>Search Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Search Mode</Label>
                        <Select
                          value={searchPrecision}
                          onValueChange={(value: "high" | "medium" | "low") => setSearchPrecision?.(value)}
                        >
                          <SelectTrigger className="w-full bg-background border-input focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                            <SelectValue placeholder="Select search mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high" className="py-3 border-0">
                              <div className="space-y-1">
                                <div className="font-medium">Fast Search</div>
                                <div className="text-xs text-muted-foreground">Closest matches only (1km radius)</div>
                              </div>
                            </SelectItem>
                            <SelectItem value="medium" className="py-3 border-0">
                              <div className="space-y-1">
                                <div className="font-medium">Balanced</div>
                                <div className="text-xs text-muted-foreground">
                                  Default mode with moderate range (3km radius)
                                </div>
                              </div>
                            </SelectItem>
                            <SelectItem value="low" className="py-3 border-0">
                              <div className="space-y-1">
                                <div className="font-medium">Wide Search</div>
                                <div className="text-xs text-muted-foreground">
                                  Broader area, more results (5km+ radius)
                                </div>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          Choose between quick nearby results or a broader search area. Wide search takes longer but
                          finds more options.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="pt-4 space-y-4">
                  <Button onClick={throwNewPin} className="w-full text-lg h-12" disabled={isLoading}>
                    <span className="mr-2 text-xl">📌</span>
                    Throw a New Pin
                  </Button>

                  <Button
                    onClick={findRestaurantsNearMe}
                    className="w-full text-lg h-12 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                    variant="destructive"
                    disabled={isLoading}
                  >
                    <span className="mr-2 text-xl">🍽️</span>
                    {isLoading ? "Finding Food..." : "GF HUNGRY"}
                  </Button>

                  <div className="pt-2">
                    <Button
                      onClick={findRestaurantInArea}
                      className="w-full text-lg h-12"
                      variant="outline"
                      disabled={isLoading}
                    >
                      <span className="mr-2 text-xl">🔍</span>
                      {isLoading ? "Searching..." : "Find Food in View"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

