import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Animated NavLink with an underline that expands on hover and if active.
  const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
    const isActive = location.pathname === to;
    return (
      // The "group" class allows us to target child elements on hover.
      <Link
        to={to}
        className={cn(
          'group relative px-2 py-1 text-sm transition-colors',
          isActive ? 'text-foreground' : 'text-foreground/60 hover:text-foreground'
        )}
      >
        {children}
        {/* The underline element */}
        <span
          className={cn(
            'absolute left-0 -bottom-1 h-0.5 bg-foreground transition-all duration-300',
            // If active, the underline is full width; otherwise, it expands on hover.
            isActive ? 'w-full' : 'w-0 group-hover:w-full'
          )}
        />
      </Link>
    );
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-50">
      <nav className="container flex h-14 max-w-7xl items-center">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className="flex items-center space-x-2 font-bold"
            >
              <span className="text-2xl">📍</span>
              <span className="inline-block font-semibold">Throw a Pin</span>
            </Link>
            <div className="hidden md:flex space-x-6">
              <NavLink to="/map">Map</NavLink>
              {user && (
                <>
                  <NavLink to="/saved">Saved Locations</NavLink>
                  <NavLink to="/history">History</NavLink>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground hidden md:inline-block">
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  className="text-sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="text-sm"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </div>
  );
}
