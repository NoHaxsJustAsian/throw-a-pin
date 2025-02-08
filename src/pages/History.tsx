import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type HistoryEntry = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
  is_saved: boolean;
};

export default function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchHistory();
  }, [user, navigate]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async (entry: HistoryEntry) => {
    try {
      const { error } = await supabase.from('locations').insert([
        {
          user_id: user?.id,
          latitude: entry.latitude,
          longitude: entry.longitude,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      // Update the is_saved status in history
      await supabase
        .from('history')
        .update({ is_saved: true })
        .eq('id', entry.id);

      // Update local state
      setHistory(history.map(h => 
        h.id === entry.id ? { ...h, is_saved: true } : h
      ));

      toast({
        title: 'Success',
        description: 'Location saved successfully!',
      });
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: 'Error',
        description: 'Failed to save location',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-lg">Loading your history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Pin History</h1>
      {history.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl block mb-4">📍</span>
          <h3 className="text-xl font-medium text-foreground mb-2">No history yet</h3>
          <p className="text-muted-foreground mb-4">
            Start throwing some pins to build your history!
          </p>
          <Button onClick={() => navigate('/map')}>Go to Map</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Lat: {entry.latitude.toFixed(6)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Long: {entry.longitude.toFixed(6)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate('/map', {
                      state: { lat: entry.latitude, lng: entry.longitude }
                    })}
                  >
                    View on Map
                  </Button>
                  {!entry.is_saved && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => saveLocation(entry)}
                    >
                      Save Location
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 