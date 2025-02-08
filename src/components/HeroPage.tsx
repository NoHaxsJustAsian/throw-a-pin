"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ScrollControls,
  Scroll,
  OrbitControls,
  useScroll,
  Html,
} from "@react-three/drei";
import * as THREE from "three";

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
  
  useFrame(() => {
    const offset = scrollDrei.offset;
    if (globeRef.current && wireframeRef.current) {
      // Rotate a full turn as you scroll:
      const rotationY = offset * Math.PI * 2;
      globeRef.current.rotation.y = rotationY;
      wireframeRef.current.rotation.y = rotationY;

      // Complex position animation sequence
      let newX, newY, scale;
      
      if (offset < 0.3) { // First section - initial peek and move to center
        newX = lerp(12, 0, offset / 0.3); // Even further right
        newY = lerp(-9, 0, offset / 0.3); // Even further down
        scale = lerp(10, 1, offset / 0.3); // Much bigger initial scale (from 6 to 10)
      } else if (offset < 0.6) { // Second section - stay centered
        newX = 0;
        newY = 0;
        scale = 1;
      } else { // Third section - move to left and zoom out
        const thirdSectionProgress = (offset - 0.6) / 0.4;
        newX = lerp(0, -1.5, thirdSectionProgress);
        newY = 0;
        scale = 1;
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
    if (offset < 0.3) { // First section
      zPos = lerp(25, 4, offset / 0.3); // Much further back to accommodate larger globe
    } else if (offset < 0.6) { // Second section
      zPos = 4;
    } else { // Third section - zoom out
      const thirdSectionProgress = (offset - 0.6) / 0.4;
      zPos = lerp(4, 5, thirdSectionProgress);
    }
    camera.position.z = zPos;
  });

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

function FloatingPin() {
  const normalizedScroll = useNormalizedScroll();
  
  // Pin animation states
  const isInTitle = normalizedScroll < 0.15; // Pin starts in title
  const isMovingToGlobe = normalizedScroll >= 0.15 && normalizedScroll < 0.25; // Pin moves to globe
  const isOnGlobe = normalizedScroll >= 0.25 && normalizedScroll < 0.45; // Pin stays with globe
  const isFadingOut = normalizedScroll >= 0.45 && normalizedScroll < 0.6; // Pin fades out
  const isHidden = normalizedScroll >= 0.6 && normalizedScroll < 0.8; // Pin is hidden
  const isReappearing = normalizedScroll >= 0.8; // Pin reappears for final section

  let pinStyle: React.CSSProperties = {
    position: 'fixed',
    fontSize: '2rem',
    transition: 'transform 0.3s ease-out',
    pointerEvents: 'none',
    zIndex: 50,
  };

  // Calculate the title pin position
  const titlePinLeft = 'calc(10vw + 200px)'; // Adjust based on your title position
  const titlePinTop = '50vh';

  if (isMovingToGlobe) {
    const moveProgress = (normalizedScroll - 0.15) / 0.1;
    pinStyle = {
      ...pinStyle,
      top: titlePinTop,
      left: titlePinLeft,
      transform: `translate(-50%, -50%) translate(${moveProgress * (window.innerWidth/2 - parseFloat(titlePinLeft))}px, 0px)`,
      opacity: 1,
    };
  } else if (isOnGlobe) {
    pinStyle = {
      ...pinStyle,
      top: '50vh',
      left: '50vw',
      transform: 'translate(-50%, -50%)',
      opacity: 1,
    };
  } else if (isFadingOut) {
    const fadeProgress = (normalizedScroll - 0.45) / 0.15;
    pinStyle = {
      ...pinStyle,
      top: '50vh',
      left: '50vw',
      transform: 'translate(-50%, -50%)',
      opacity: 1 - fadeProgress,
    };
  } else if (isHidden) {
    pinStyle = {
      ...pinStyle,
      opacity: 0,
    };
  } else if (isReappearing) {
    const appearProgress = (normalizedScroll - 0.8) / 0.2;
    pinStyle = {
      ...pinStyle,
      top: '50vh',
      left: '30vw',
      transform: 'translate(-50%, -50%)',
      opacity: appearProgress,
    };
  }

  // Only show the floating pin when we're starting to move or beyond
  if (normalizedScroll < 0.15) return null;

  return (
    <div style={pinStyle}>📍</div>
  );
}

/**
 * HeroCards
 *
 * These are the overlay HTML hero sections.
 * In the first section the "throw‑a‑pin" text includes a pin emoji.
 * That emoji's opacity is driven by scroll (via our custom hook)
 * so that at scroll start it is fully visible and then fades out.
 */
function HeroCards() {
  const normalizedScroll = useNormalizedScroll();
  const threshold = 0.15;
  const heroPinOpacity = 1 - Math.min(
    1,
    Math.max(0, (normalizedScroll - threshold) / 0.1)
  );

  return (
    <Scroll html>
      {/* Hero Section 1 */}
      <div className="absolute top-[50vh] left-[10vw] -translate-y-1/2 w-[300px] text-foreground z-10">
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
      </div>

      {/* Hero Section 2 */}
      <div className="absolute top-[150vh] right-[10vw] -translate-y-1/2 w-[300px] text-right text-foreground z-10">
        <h1 className="text-[2.5rem] m-0 mb-2">
          Explore
        </h1>
        <p className="text-muted-foreground">Find hidden gems and new experiences waiting for you.</p>
      </div>

      {/* Hero Section 3 */}
      <div className="absolute top-[250vh] right-[5vw] -translate-y-1/2 w-[300px] text-right text-foreground z-10">
        <h1 className="text-[2.5rem] m-0 mb-2">
          Connect
        </h1>
        <p className="text-muted-foreground">Share your journeys and connect with fellow travelers.</p>
      </div>
    </Scroll>
  );
}

/**
 * HeroPage
 *
 * The main component:  
 * - A full‑screen Canvas with a 3‑page scrollable container (via <ScrollControls>).
 * - The 3D scene (with our ScrollingGlobe) and the overlaying hero HTML content.
 */
export default function HeroPage() {
  return (
    <div className="h-[300vh] bg-background overflow-hidden relative">
      <FloatingPin />
      <Canvas 
        className="absolute top-0 left-0 w-full h-full" 
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ position: 'fixed', zIndex: 1 }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <ScrollControls pages={3} damping={0.1}>
          <ScrollingGlobe />
          <HeroCards />
        </ScrollControls>
      </Canvas>
    </div>
  );
} 