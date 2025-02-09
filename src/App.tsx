import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import PlacesPage from "@/components/PlacesPage";
import MainComponent from "@/components/MainComponent";
import History from "@/pages/History";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <Router>
        <div className="min-h-screen bg-background">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MainComponent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/saved" element={<PlacesPage />} />
            <Route path="/history" element={<History />} />
          </Routes>
          <Toaster className="z-[9999]" />
        </div>    
      </Router>
    </ThemeProvider>
  );
}
