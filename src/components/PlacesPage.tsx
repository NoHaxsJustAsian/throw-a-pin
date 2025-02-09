import PlacesGrid from "./PlacesGrid"
import { PlacesSaveBar } from "@/components/PlacesSaveBar"
import { useState } from "react"
import { Place } from "@/lib/supabase"

interface SavedPlacesList {
  id: string;
  name: string;
  places: Place[];
}

export default function PlacesPage() {
  const [savedLists, setSavedLists] = useState<SavedPlacesList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>();

  const handleCreateList = (name: string) => {
    const newList: SavedPlacesList = {
      id: `list-${Date.now()}`,
      name,
      places: []
    };
    setSavedLists([...savedLists, newList]);
    setSelectedListId(newList.id);
  };

  const handleAddPlaceToList = (place: Place) => {
    if (!selectedListId) return;
    
    setSavedLists(savedLists.map(list => {
      if (list.id === selectedListId) {
        // Don't add if already in the list
        if (list.places.some(p => p.id === place.id)) {
          return list;
        }
        return {
          ...list,
          places: [...list.places, place]
        };
      }
      return list;
    }));
  };

  console.log("PlacesPage rendered");
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Places</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex flex-col flex-grow">
          <PlacesGrid />
        </div>
        <PlacesSaveBar 
          savedLists={savedLists} 
          onCreateList={handleCreateList} 
          onSelectList={setSelectedListId}
          selectedListId={selectedListId}
        />
      </div>
    </div>
  )
}