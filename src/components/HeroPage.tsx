"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import {
  ScrollControls,
  Scroll,
  OrbitControls,
  useScroll,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TextureLoader } from "three";
const worldTexture = '/world-texture.jpg';

/**
 * A custom hook to return a normalized scroll value (0 to 1)
 * based on window.scrollY relative to the total scrollable distance.
 */
function useNormalizedScroll() {
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      setScroll(maxScroll > 0 ? window.scrollY / maxScroll : 0);
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scroll;
}

/**
 * A simple linear interpolation helper.
 */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * ScrollingGlobe
 *
 * This component uses Drei's useScroll (for the 3D animation)
 * and our custom useNormalizedScroll (for syncing HTML opacity)
 * to animate the globe. In addition to its usual rotation and horizontal
 * movement, we attach an <Html> element to the globe that holds a pin emoji.
 * Its opacity is 0 at scroll start and fades in over time.
 */
function ScrollingGlobe() {
  const globeRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const { camera } = useThree();
  const scrollDrei = useScroll();
  const normalizedScroll = useNormalizedScroll();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateSpeed = 0.5; // Adjust speed as needed
  const lastScrollOffset = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  
  useFrame(() => {
    const offset = scrollDrei.offset;

    // Check if we've reached the final section and scrolling has stopped
    if (offset > 0.8 && offset !== lastScrollOffset.current) {
      lastScrollOffset.current = offset;
      
      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Set new timeout for auto-rotation
      scrollTimeout.current = setTimeout(() => {
        setAutoRotate(true);
      }, 500);
    }

    if (globeRef.current && wireframeRef.current) {
      if (isTransitioning) {
        // Final animation state before transitioning to map
        const progress = Math.min(1, (Date.now() - transitionStartTime.current) / 1000);
        const currentX = globeRef.current.position.x;
        const currentScale = globeRef.current.scale.x;
        
        // Add easing to make the transition smoother
        const easeProgress = 1 - Math.pow(1 - progress, 2); // Changed from cubic to quadratic easing
        
        // Add faster rotation during transition
        globeRef.current.rotation.y += 0.05; // Reduced from 0.1 to 0.05
        wireframeRef.current.rotation.y = globeRef.current.rotation.y;
        
        // Smoothly transition from current position/scale to final position/scale with a gentler curve
        const positionEase = 1 - Math.pow(1 - progress, 2.5); // Slightly different easing for position
        globeRef.current.position.x = lerp(currentX, 0, positionEase);
        globeRef.current.position.y = lerp(0, 0, easeProgress);
        globeRef.current.scale.setScalar(lerp(currentScale, 2, easeProgress));
        wireframeRef.current.position.x = globeRef.current.position.x;
        wireframeRef.current.position.y = globeRef.current.position.y;
        wireframeRef.current.scale.setScalar(globeRef.current.scale.x);
        camera.position.z = lerp(5, 3, easeProgress);
        return;
      }

      // Apply either scroll-based or auto rotation
      if (autoRotate) {
        globeRef.current.rotation.y += autoRotateSpeed * 0.01;
        wireframeRef.current.rotation.y = globeRef.current.rotation.y;
      } else {
        // Original rotation logic
        const rotationY = offset * Math.PI * 2;
        globeRef.current.rotation.y = rotationY;
        wireframeRef.current.rotation.y = rotationY;
      }

      // Complex position animation sequence
      let newX, newY, scale;
      
      if (offset < 0.15) { // First section - initial peek and move to center
        newX = lerp(12, 0, offset / 0.15);
        newY = lerp(-9, 0, offset / 0.15);
        scale = lerp(10, 1, offset / 0.15);
      } else if (offset < 0.25) { // Second section - stay centered for explore
        newX = 0;
        newY = 0;
        scale = 1;
      } else if (offset < 0.35) { // Third section - move to left side before connect section
        const thirdSectionProgress = (offset - 0.25) / 0.1;
        newX = lerp(0, -1.8, thirdSectionProgress);
        newY = lerp(0, 0, thirdSectionProgress);
        scale = lerp(1, 1.1, thirdSectionProgress);
      } else if (offset < 0.85) { // Maintain position for connect, discover, and features sections
        newX = -1.8;
        newY = 0;
        scale = 1.1;
      } else { // Final get started section - move globe off screen and make it larger
        const finalSectionProgress = (offset - 0.85) / 0.15;
        newX = lerp(-1.8, -3.5, finalSectionProgress);
        newY = 0;
        scale = lerp(1.1, 1.8, finalSectionProgress);
      }
      
      globeRef.current.position.x = newX;
      globeRef.current.position.y = newY;
      wireframeRef.current.position.x = newX;
      wireframeRef.current.position.y = newY;
      
      // Apply scale
      globeRef.current.scale.setScalar(scale);
      wireframeRef.current.scale.setScalar(scale);
    }

    // Camera zoom animation sequence
    let zPos;
    if (offset < 0.15) { // First section - faster initial zoom
      zPos = lerp(25, 4, offset / 0.15);
    } else if (offset < 0.25) { // Second section - maintain close view for explore
      zPos = 4;
    } else if (offset < 0.35) { // Third section - zoom out less to keep globe more visible
      const thirdSectionProgress = (offset - 0.25) / 0.1;
      zPos = lerp(4, 5, thirdSectionProgress);
    } else { // Final section - maintain closer view
      zPos = 5;
    }
    camera.position.z = zPos;
  });

  // Add to component scope
  const transitionStartTime = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (isTransitioning) {
      transitionStartTime.current = Date.now();
      const timer = setTimeout(() => {
        navigate('/map');
      }, 200); // Change pages even sooner
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, navigate]);

  // Add to component scope
  (window as any).startGlobeTransition = () => {
    setIsTransitioning(true);
  };

  // Load texture with error handling
  const texture = useLoader(
    TextureLoader, 
    worldTexture,
    undefined,
    (error) => {
      console.error('Error loading texture:', error);
    }
  );

  // Fallback if texture fails to load
  if (!texture) {
    return (
      <group>
        <mesh ref={globeRef}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        <lineSegments ref={wireframeRef}>
          <sphereGeometry args={[1.001, 32, 32]} />
          <lineBasicMaterial color="#6e6e6e" transparent opacity={0.3} />
        </lineSegments>
      </group>
    );
  }

  return (
    <group>
      <mesh ref={globeRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      <lineSegments ref={wireframeRef}>
        <sphereGeometry args={[1.001, 32, 32]} />
        <lineBasicMaterial color="#6e6e6e" transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}

/**
 * HeroCards
 *
 * These are the overlay HTML hero sections.
 * Each section fades in from the bottom as we scroll to it.
 */
function HeroCards() {
  const normalizedScroll = useNormalizedScroll();
  const threshold = 0.15;
  const heroPinOpacity = 1 - Math.min(
    1,
    Math.max(0, (normalizedScroll - threshold) / 0.1)
  );

  return (
    <Scroll html style={{ width: '100%' }}>
      {/* Hero Section 1 */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ y: 0 }}
        whileInView={{ opacity: 1 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
        style={{ position: 'absolute', top: '50vh', left: '10vw', width: '300px' }} 
        className="text-foreground z-10 text-glow"
      >
        <h1 className="text-[2.5rem] m-0 mb-2 relative">
          throw‑a‑pin{" "}
          <span 
            style={{ 
              opacity: heroPinOpacity, 
              transition: "opacity 0.3s",
              display: 'inline-block',
              verticalAlign: 'middle'
            }}
          >
            📍
          </span>
        </h1>
        <p className="text-muted-foreground">Discover amazing places with a simple throw of a pin.</p>
      </motion.div>

      {/* Hero Section 2 - Explore */}
      <div style={{ position: 'absolute', top: '140vh', left: '0', width: '100%', transform: 'translateY(-50%)', pointerEvents: 'none' }} className="text-foreground">
        {/* Large "Explore" text */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
          className="relative"
        >
          <h1 className="text-[15rem] font-bold text-center m-0 select-none" style={{ 
            color: '#2a2a2a',
            letterSpacing: '-0.05em',
          }}>
            Explore
          </h1>
        </motion.div>
        
        {/* Left side content */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
          className="absolute left-[15vw] w-[300px]" 
          style={{ 
            zIndex: 2,
            top: 'calc(50% + 6rem)'
          }}
        >
          <h2 className="text-xl font-semibold mb-2">Discover New Places</h2>
          <p className="text-muted-foreground">Let serendipity guide you to unexpected destinations and hidden gems around the world.</p>
        </motion.div>
        
        {/* Right side content */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
          className="absolute right-[15vw] w-[300px] text-right" 
          style={{ 
            zIndex: 2,
            top: 'calc(50% + 6rem)'
          }}
        >
          <h2 className="text-xl font-semibold mb-2">Plan Adventures</h2>
          <p className="text-muted-foreground">Save your discoveries and create unforgettable travel experiences.</p>
        </motion.div>
      </div>

      {/* Connect Section */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
        style={{ 
          position: 'absolute', 
          top: '200vh',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
        }}
        className="text-foreground z-10 text-glow"
      >
        {/* Text content */}
        <div className="mb-8">
          <h1 className="text-[2.5rem] m-0 mb-2">
            Connect
          </h1>
          <p className="text-muted-foreground">Share your journeys and connect with fellow travelers.</p>
        </div>

        {/* Video preview */}
        <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
          [Connect Preview]
        </div>
      </motion.div>

      {/* Second Connect-style Section */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
        style={{ 
          position: 'absolute', 
          top: '260vh',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
        }}
        className="text-foreground z-10 text-glow"
      >
        {/* Text content */}
        <div className="mb-8">
          <h1 className="text-[2.5rem] m-0 mb-2">
            Discover
          </h1>
          <p className="text-muted-foreground">Find hidden gems and local favorites around the world.</p>
        </div>

        {/* Video preview */}
        <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
          [Discover Preview]
        </div>
      </motion.div>

      {/* Features Section - With Static Globe */}
      <div style={{ position: 'absolute', top: '380vh', left: '0', width: '100%' }} className="text-foreground">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
          style={{ 
            position: 'absolute',
            right: '15vw',
            width: '400px',
          }}
          className="text-right text-glow"
        >
          <h2 className="text-2xl font-semibold mb-4">Smart Recommendations</h2>
          <p className="text-muted-foreground">Our algorithm learns from your preferences to suggest destinations you'll love.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
          style={{ 
            position: 'absolute',
            right: '15vw',
            width: '400px',
            top: '150px'
          }}
          className="text-right text-glow"
        >
          <h2 className="text-2xl font-semibold mb-4">Travel Planning Tools</h2>
          <p className="text-muted-foreground">Create itineraries, save favorite locations, and plan your next adventure with ease.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
          style={{ 
            position: 'absolute',
            right: '15vw',
            width: '400px',
            top: '300px'
          }}
          className="text-right text-glow"
        >
          <h2 className="text-2xl font-semibold mb-4">Community Insights</h2>
          <p className="text-muted-foreground">Discover hidden gems and local favorites shared by our global community of travelers.</p>
        </motion.div>
      </div>

      {/* Get Started Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
        style={{ 
          position: 'absolute', 
          top: '450vh', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '600px',
          textAlign: 'center'
        }}
        className="text-foreground z-10 text-glow"
      >
        <h2 className="text-3xl font-semibold mb-4">Ready to Start Your Journey?</h2>
        <p className="text-muted-foreground mb-8">Join our community of adventurers and discover your next destination.</p>
        <button 
          onClick={() => (window as any).startGlobeTransition()}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
        >
          Get Started
        </button>
      </motion.div>
    </Scroll>
  );
}

/**
 * HeroPage
 *
 * The main component:  
 * - A full‑screen Canvas with a scrollable container (via <ScrollControls>).
 * - The 3D scene (with our ScrollingGlobe) and the overlaying hero HTML content.
 */
export default function HeroPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="h-screen bg-background overflow-hidden relative"
    >
      <Canvas 
        className="absolute top-0 left-0 w-full h-full" 
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ position: 'fixed', zIndex: 1 }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <ScrollControls pages={5} damping={0.1}>
          <ScrollingGlobe />
          <HeroCards />
        </ScrollControls>
      </Canvas>
    </motion.div>
  );
} 