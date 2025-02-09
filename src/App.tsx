import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import SavedLocations from "@/pages/SavedLocations";
import MainComponent from "@/components/MainComponent";
import History from "@/pages/History";
import Places from "@/components/PlacesPage";
import ResetPassword from "@/pages/ResetPassword";
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
            <Route path="/saved" element={<SavedLocations />} />
            <Route path="/history" element={<History />} />
            <Route path="/places" element={<Places />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </ThemeProvider>
  );
}
