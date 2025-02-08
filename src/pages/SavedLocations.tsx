import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Trash2Icon } from 'lucide-react';
import type { SavedLocation } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function SavedLocations() {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchLocations();
  }, [user, navigate]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load saved locations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLocations(locations.filter(loc => loc.id !== id));
      toast({
        title: 'Success',
        description: 'Location deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete location',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-lg">Loading your saved locations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Saved Locations</h1>
      {locations.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl block mb-4">📍</span>
          <h3 className="text-xl font-medium text-foreground mb-2">No saved locations yet</h3>
          <p className="text-muted-foreground mb-4">
            Start exploring and save some interesting places!
          </p>
          <Button onClick={() => navigate('/map')}>Go to Map</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium">
                    {location.name || 'Unnamed Location'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteLocation(location.id)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Lat: {location.latitude.toFixed(6)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Long: {location.longitude.toFixed(6)}
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate('/map', {
                    state: { lat: location.latitude, lng: location.longitude }
                  })}
                >
                  View on Map
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 