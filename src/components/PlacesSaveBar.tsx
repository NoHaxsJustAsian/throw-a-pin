import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Trash2, Eye, Link2, Pencil } from "lucide-react";
import { useState } from "react";
import { Place } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,

  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Collection {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface PlacesSaveBarProps {
  savedLists: Collection[];
  onCreateList: () => void;
  onSelectList: (listId: string) => void;
  selectedListId?: string;
}

export function PlacesSaveBar({ savedLists, onCreateList, onSelectList, selectedListId }: PlacesSaveBarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const [collectionToRename, setCollectionToRename] = useState<Collection | null>(null);
  const [newName, setNewName] = useState("");

  const handleCreateCollection = async () => {
    if (!user || !newCollectionName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a collection name",
        variant: "destructive",
      });
      return;
    }

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
        .single();

      if (error) throw error;

      onCreateList();
      setNewCollectionName("");
      setIsDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Collection created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCollection = async (collectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId);

      if (error) throw error;

      onCreateList(); // Refresh the collections
      
      toast({
        title: "Success",
        description: "Collection deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete collection",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-[350px] border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Collections</h3>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {savedLists.map((list) => (
            <div key={list.id} className="flex items-center gap-2">
              <Button
                variant={selectedListId === list.id ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => onSelectList(list.id)}
              >
                {list.name}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => deleteCollection(list.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Collection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateCollection();
                }
              }}
            />
            <Button onClick={handleCreateCollection}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}