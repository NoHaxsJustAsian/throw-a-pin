import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Place } from "@/lib/supabase";

interface SavedPlacesList {
  id: string;
  name: string;
  places: Place[];
}

interface PlacesSaveBarProps {
  savedLists: SavedPlacesList[];
  onCreateList: (name: string) => void;
  onSelectList: (listId: string) => void;
  selectedListId?: string;
}

export function PlacesSaveBar({ 
  savedLists, 
  onCreateList, 
  onSelectList,
  selectedListId 
}: PlacesSaveBarProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');

  const handleCreateList = () => {
    if (isCreatingNew && newListName.trim()) {
      onCreateList(newListName);
      setIsCreatingNew(false);
      setNewListName('');
    } else {
      setIsCreatingNew(true);
    }
  };

  return (
    <div className="w-64 border border-border h-full bg-background rounded-l-lg">
      <div className="p-4 border-b border-border">
        <h1 className="text-2xl font-bold mb-6 text-center">Saved Places</h1>
        {isCreatingNew ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Collection name..."
              className="w-full p-2 border border-border rounded-md"
              autoFocus
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateList}
                className="flex-1"
                disabled={!newListName.trim()}
              >
                Create
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsCreatingNew(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            onClick={handleCreateList} 
            variant="outline" 
            className="w-full justify-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Collection
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[calc(100vh-5rem)]">
        <div className="p-2">
          {savedLists.map((list) => (
            <button
              key={list.id}
              onClick={() => onSelectList(list.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-accent
                ${selectedListId === list.id ? 'bg-accent' : ''}`}
            >
              <div className="font-medium">{list.name}</div>
              
              {/* Show up to 3 places as a preview */}
              <div className="mt-1 text-sm text-muted-foreground">
                {list.places.slice(0, 3).map((place, index) => (
                  <div key={place.id} className="truncate">
                    {place.name}
                  </div>
                ))}
                {list.places.length > 3 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    +{list.places.length - 3} more places
                  </div>
                )}
                {list.places.length === 0 && (
                  <div className="text-xs italic">No places saved yet</div>
                )}
              </div>
            </button>
          ))}
          
          {savedLists.length === 0 && (
            <div className="text-center text-muted-foreground p-4">
              Create your first collection to start saving places
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 