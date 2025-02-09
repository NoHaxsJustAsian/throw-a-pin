import { useState, useEffect } from "react"
import PlacesGrid from "./PlacesGrid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, MoreVertical, Trash2, Eye, Link2, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface Collection {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface PlacesPageProps {
  selectedCollections: Collection[];
  onCollectionToggle: (collection: Collection) => void;
}

export default function PlacesPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollections, setSelectedCollections] = useState<Collection[]>([])
  const [newCollectionName, setNewCollectionName] = useState("")
  const { user } = useAuth()
  const { toast } = useToast()
  const [collectionToRename, setCollectionToRename] = useState<Collection | null>(null)
  const [newName, setNewName] = useState("")

  useEffect(() => {
    if (user) {
      fetchCollections()
    }
  }, [user])

  const fetchCollections = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setCollections(data || [])
    } catch (error) {
      console.error("Error fetching collections:", error)
      toast({
        title: "Error",
        description: "Failed to load collections",
        variant: "destructive",
      })
    }
  }

  const createCollection = async () => {
    if (!user || !newCollectionName.trim()) return

    try {
      const { data, error } = await supabase
        .from("collections")
        .insert([
          {
            name: newCollectionName.trim(),
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      setCollections([data, ...collections])
      setNewCollectionName("")
      toast({
        title: "Success",
        description: "Collection created successfully",
      })
    } catch (error) {
      console.error("Error creating collection:", error)
      toast({
        title: "Error",
        description: "Failed to create collection",
        variant: "destructive",
      })
    }
  }

  const toggleCollection = (collection: Collection) => {
    setSelectedCollections(prev => {
      const isSelected = prev.some(c => c.id === collection.id);
      if (isSelected) {
        return prev.filter(c => c.id !== collection.id);
      } else {
        return [...prev, collection];
      }
    });
  };

  const deleteCollection = async (collectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId)

      if (error) throw error;

      setCollections(collections.filter(c => c.id !== collectionId));
      setSelectedCollections(selected => selected.filter(c => c.id !== collectionId));

      toast({
        title: "Success",
        description: "Collection deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting collection:", error)
      toast({
        title: "Error",
        description: "Failed to delete collection",
        variant: "destructive",
      })
    }
  }

  const renameCollection = async () => {
    if (!collectionToRename || !newName.trim()) return;

    try {
      const { error } = await supabase
        .from("collections")
        .update({ name: newName.trim() })
        .eq("id", collectionToRename.id);

      if (error) throw error;

      setCollections(collections.map(c => 
        c.id === collectionToRename.id 
          ? { ...c, name: newName.trim() } 
          : c
      ));

      setCollectionToRename(null);
      setNewName("");
      
      toast({
        title: "Success",
        description: "Collection renamed successfully",
      });
    } catch (error) {
      console.error("Error renaming collection:", error);
      toast({
        title: "Error",
        description: "Failed to rename collection",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen pt-16 container mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-64 space-y-4">
          <div className="flex flex-col gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Collection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Collection</DialogTitle>
                </DialogHeader>
                <div className="flex gap-2">
                  <Input
                    placeholder="Collection name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                  />
                  <Button onClick={createCollection}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>

            {collections.map((collection) => (
              <div key={collection.id} className="space-y-1">
                <div className="flex gap-2">
                  <Button
                    variant={selectedCollections.some(c => c.id === collection.id) ? "default" : "outline"}
                    className="w-full justify-start text-left"
                    onClick={() => toggleCollection(collection)}
                  >
                    <span className="truncate">{collection.name}</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          window.open(`/lists/${collection.id}`, '_blank');
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Open List
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setCollectionToRename(collection);
                          setNewName(collection.name);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/lists/${collection.id}`;
                          navigator.clipboard.writeText(shareUrl);
                          toast({
                            title: "Link Copied",
                            description: "Share link has been copied to clipboard",
                          });
                        }}
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteCollection(collection.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Collection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {collections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No collections yet. Create one to get started!
              </p>
            )}
          </div>
        </div>
        
        <div className="flex-1">
          <PlacesGrid 
            selectedCollections={selectedCollections}
            onAddToCollection={fetchCollections}
            collections={collections}
          />
        </div>
      </div>
      <Dialog open={!!collectionToRename} onOpenChange={() => setCollectionToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Collection</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button onClick={renameCollection}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}