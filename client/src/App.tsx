import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/components/pages/Home";
import Login from "@/components/pages/Login";
import SavedLocations from "@/components/pages/SavedLocations";
import MainComponent from "@/components/MainComponent";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/useAuth.tsx";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MainComponent />} />
              <Route path="/login" element={<Login />} />
              <Route path="/saved" element={<SavedLocations />} />
            </Routes>
            <Toaster />
          </div>    
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
