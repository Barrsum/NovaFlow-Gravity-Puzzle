import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Crosshair, Award, FastForward, Github, Linkedin, Cpu, Zap, Target, Pause, Info, Home } from 'lucide-react';
import { levels, LevelData, Planet } from './data/levels';

type GameState = 'menu' | 'intro' | 'aiming' | 'flying' | 'won' | 'crashed' | 'cleared' | 'paused' | 'how-to-play';

interface Vector { x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; }

// Core Physics Constants
const G = 0.6; // Gravitational constant
const DRAG_MULTIPLIER = 0.04;
const MAX_TRAILS = 60;
const SIMULATION_STEPS = 120; // For aiming projection

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [prevState, setPrevState] = useState<GameState>('menu');
  const [levelIndex, setLevelIndex] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  
  // Physics State
  const cometPos = useRef<Vector>({ x: 0, y: 0 });
  const cometVel = useRef<Vector>({ x: 0, y: 0 });
  const dragStartPos = useRef<Vector | null>(null);
  const dragCurrentPos = useRef<Vector | null>(null);
  const trails = useRef<Vector[]>([]);
  const particles = useRef<Particle[]>([]);
  const activePlanetsRef = useRef<Planet[]>([]);
  const [superpowersLeft, setSuperpowersLeft] = useState(1);
  const [isDestroyMode, setIsDestroyMode] = useState(false);
  const isDestroyModeRef = useRef(false);
  
  const level = levels[levelIndex];

  // Initialize Level
  useEffect(() => {
    if (gameState === 'intro') {
      cometPos.current = { ...level.start };
      cometVel.current = { x: 0, y: 0 };
      trails.current = [];
      particles.current = [];
      dragStartPos.current = null;
      dragCurrentPos.current = null;
      activePlanetsRef.current = JSON.parse(JSON.stringify(level.planets));
      setSuperpowersLeft(1);
      setIsDestroyMode(false);
      isDestroyModeRef.current = false;
    }
  }, [level, gameState]);

  // Handle Resize and Scaling
  const getScale = () => {
    if (!containerRef.current) return { s: 1, dx: 0, dy: 0 };
    const { width, height } = containerRef.current.getBoundingClientRect();
    const s = Math.min(width / 1000, height / 1000);
    const dx = (width - 1000 * s) / 2;
    const dy = (height - 1000 * s) / 2;
    return { s, dx, dy };
  };

  // Main Game Loop (Canvas updates)
  useEffect(() => {
    if (gameState === 'menu' || gameState === 'cleared') return;

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = container.getBoundingClientRect();
      // Adjust canvas resolution
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const { s, dx, dy } = getScale();

      // Clear Screen with trail decay effect
      ctx.fillStyle = 'rgba(3, 4, 8, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Save Context and Apply Scale
      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(s, s);

      // DRAW TARGET
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
      ctx.beginPath();
      ctx.arc(level.target.x, level.target.y, level.target.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // target pulsing inner ring
      const time = Date.now() * 0.003;
      const pulseR = level.target.r * (0.6 + Math.sin(time) * 0.2);
      ctx.beginPath();
      ctx.arc(level.target.x, level.target.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.shadowBlur = 0;

      // DRAW PLANETS
      activePlanetsRef.current.forEach(p => {
        // Aura
        const auraColor = p.type === 'attract' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = auraColor;
        ctx.fill();

        // Planet body
        const grad = ctx.createRadialGradient(p.x - p.r*0.3, p.y - p.r*0.3, 0, p.x, p.y, p.r);
        if (p.type === 'attract') {
          grad.addColorStop(0, '#60a5fa');
          grad.addColorStop(1, '#1e3a8a');
        } else {
          grad.addColorStop(0, '#f87171');
          grad.addColorStop(1, '#7f1d1d');
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // FLYING PHYSICS (Only evaluate when actively flying)
      if (gameState === 'flying') {
        const cp = cometPos.current;
        const cv = cometVel.current;
        
        let ax = 0;
        let ay = 0;

        // Apply Gravity
        activePlanetsRef.current.forEach(p => {
          const distX = p.x - cp.x;
          const distY = p.y - cp.y;
          const distSq = distX * distX + distY * distY;
          const dist = Math.sqrt(distSq);

          // Crash into planet
          if (dist < p.r + 5) {
            triggerExplosion(cp.x, cp.y, p.type === 'attract' ? '#60a5fa' : '#f87171');
            setGameState('crashed');
          }

          const force = (G * p.mass) / Math.max(distSq, 100);
          const dir = p.type === 'attract' ? 1 : -1;
          ax += force * (distX / dist) * dir;
          ay += force * (distY / dist) * dir;
        });

        cv.x += ax;
        cv.y += ay;
        cp.x += cv.x;
        cp.y += cv.y;

        // Win Condition
        const tDistX = level.target.x - cp.x;
        const tDistY = level.target.y - cp.y;
        if (Math.sqrt(tDistX*tDistX + tDistY*tDistY) < level.target.r) {
           triggerExplosion(cp.x, cp.y, '#10b981');
           setGameState('won');
        }

        // Out of bounds detection
        if (cp.x < -1000 || cp.x > 2000 || cp.y < -1000 || cp.y > 2000) {
           setGameState('crashed');
        }

        trails.current.push({ x: cp.x, y: cp.y });
        if (trails.current.length > MAX_TRAILS) trails.current.shift();
      }

      // DRAW TRAILS
      if (trails.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trails.current[0].x, trails.current[0].y);
        for(let i=1; i<trails.current.length; i++) {
          ctx.lineTo(trails.current[i].x, trails.current[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // DRAW COMET
      if (gameState === 'aiming' || gameState === 'flying' || gameState === 'paused' || gameState === 'how-to-play') {
        const cp = cometPos.current;
        const t = Date.now() * 0.003;
        
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#60a5fa';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Glowing Orbital Rings
        ctx.beginPath();
        ctx.ellipse(cp.x, cp.y, 18, 6, t, 0, Math.PI*2);
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(cp.x, cp.y, 18, 6, -t + Math.PI/3, 0, Math.PI*2);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // DRAW DESTROY MODE CROSSHAIRS
      if (isDestroyModeRef.current && gameState === 'aiming') {
          const t = Date.now() * 0.005;
          activePlanetsRef.current.forEach(p => {
              const rot = t * (p.id % 2 === 0 ? 1 : -1);
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(rot);
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
              ctx.lineWidth = 2;
              const r = p.r + 20;
              ctx.beginPath();
              ctx.moveTo(-r, -r + 15); ctx.lineTo(-r, -r); ctx.lineTo(-r + 15, -r);
              ctx.moveTo(r, -r + 15); ctx.lineTo(r, -r); ctx.lineTo(r - 15, -r);
              ctx.moveTo(-r, r - 15); ctx.lineTo(-r, r); ctx.lineTo(-r + 15, r);
              ctx.moveTo(r, r - 15); ctx.lineTo(r, r); ctx.lineTo(r - 15, r);
              ctx.stroke();
              
              ctx.beginPath();
              ctx.arc(0, 0, Math.sin(t)*4 + 6, 0, Math.PI*2);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
              ctx.fill();
              ctx.restore();
          });
      }

      // DRAW PREDICTED TRAJECTORY (Aiming)
      if (gameState === 'aiming' && dragStartPos.current && dragCurrentPos.current && !isDestroyModeRef.current) {
         // Draw drag string
         const rect = container.getBoundingClientRect();
         const clientXRel = dragCurrentPos.current.x - rect.left;
         const clientYRel = dragCurrentPos.current.y - rect.top;
         const pointerMappedX = (clientXRel - dx) / s;
         const pointerMappedY = (clientYRel - dy) / s;

         const cp = cometPos.current;

         ctx.beginPath();
         ctx.moveTo(cp.x, cp.y);
         ctx.lineTo(pointerMappedX, pointerMappedY);
         ctx.strokeStyle = 'rgba(255,255,255,0.3)';
         ctx.setLineDash([5, 5]);
         ctx.lineWidth = 2;
         ctx.stroke();
         ctx.setLineDash([]);

         // Simulate projected physics
         let vvx = (cp.x - pointerMappedX) * DRAG_MULTIPLIER;
         let vvy = (cp.y - pointerMappedY) * DRAG_MULTIPLIER;
         let ppx = cp.x;
         let ppy = cp.y;

         ctx.beginPath();
         ctx.moveTo(ppx, ppy);
         let crashed = false;

         for (let i=0; i<SIMULATION_STEPS; i++) {
            let pax = 0; let pay = 0;
            for (const p of activePlanetsRef.current) {
              const dX = p.x - ppx;
              const dY = p.y - ppy;
              const distSq = dX*dX + dY*dY;
              const dist = Math.sqrt(distSq);
              if (dist < p.r) crashed = true;
              const force = (G * p.mass) / Math.max(distSq, 100);
              const dir = p.type === 'attract' ? 1 : -1;
              pax += force * (dX / dist) * dir;
              pay += force * (dY / dist) * dir;
            }
            if (crashed) break;
            vvx += pax;
            vvy += pay;
            ppx += vvx;
            ppy += vvy;
            ctx.lineTo(ppx, ppy);
         }
         ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)'; // cyan glow
         ctx.lineWidth = 2;
         ctx.setLineDash([8, 8]);
         ctx.stroke();
         ctx.setLineDash([]);
      }

      // PARTICLES
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [gameState, level]);

  const triggerExplosion = (x: number, y: number, color: string, count: number = 25) => {
    for (let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particles.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60, maxLife: 60,
        color
      });
    }
  };

  // Input Handling
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'aiming') return;
    
    if (isDestroyModeRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const { s, dx, dy } = getScale();
        const px = ((e.clientX - rect.left) - dx) / s;
        const py = ((e.clientY - rect.top) - dy) / s;
        
        const hitPlanet = activePlanetsRef.current.find(p => {
           const dist = Math.sqrt((p.x - px)**2 + (p.y - py)**2);
           return dist <= p.r + 40; // generous hit box for tapping
        });
        
        if (hitPlanet) {
            activePlanetsRef.current = activePlanetsRef.current.filter(p => p.id !== hitPlanet.id);
            triggerExplosion(hitPlanet.x, hitPlanet.y, '#ef4444', 150);
            setSuperpowersLeft(0);
        }
        setIsDestroyMode(false);
        isDestroyModeRef.current = false;
        return;
    }

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragCurrentPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameState === 'aiming' && dragStartPos.current && !isDestroyModeRef.current) {
      dragCurrentPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (gameState === 'aiming' && dragStartPos.current && dragCurrentPos.current && !isDestroyModeRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const { s, dx, dy } = getScale();
      const cp = cometPos.current;
      const pointerMappedX = ((dragCurrentPos.current.x - rect.left) - dx) / s;
      const pointerMappedY = ((dragCurrentPos.current.y - rect.top) - dy) / s;
      
      cometVel.current = {
        x: (cp.x - pointerMappedX) * DRAG_MULTIPLIER,
        y: (cp.y - pointerMappedY) * DRAG_MULTIPLIER
      };

      setGameState('flying');
      dragStartPos.current = null;
      dragCurrentPos.current = null;
    }
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col relative select-none font-sans text-white bg-[var(--color-nova-bg)] overflow-hidden">
      {/* Background Stars Layer - isolated so opacity and pointer-events:none don't affect entire app */}
      <div className="absolute inset-0 z-0 nova-bg-stars"></div>
      
      <div className="w-full h-full flex flex-col relative z-10">
        {/* HEADER - Premium Transparent Glass overrides modals structurally */}
        <header className="absolute top-0 left-0 w-full z-40 flex justify-between items-center px-4 sm:px-6 py-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
            <span className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa]" />
          </div>
          <h1 className="font-display font-black text-lg sm:text-xl tracking-widest uppercase text-white shadow-lg">
            Nova<span className="text-blue-400 font-light">Flow</span>
          </h1>
        </div>
        <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#888] flex items-center gap-2">
          <span>By <span className="text-white drop-shadow-md">Ram Bapat</span></span>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 w-full h-full flex flex-col items-center justify-center p-4 sm:p-8 pt-[80px] pb-[80px]">
        <div 
          className="canvas-container" 
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <canvas ref={canvasRef} />

          {/* HUD OVERLAY - ONLY SHOWS DURING GAMEPLAY/PAUSE */}
          {(gameState === 'aiming' || gameState === 'flying' || gameState === 'paused') && (
            <div className={`absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-20 transition-opacity ${gameState === 'paused' ? 'opacity-0' : 'opacity-100'}`}>
              <div className="nova-panel px-4 py-2 rounded-lg pointer-events-none">
                <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400 mb-1">
                  Sector {levelIndex + 1}
                </p>
                <h2 className="font-display font-bold text-lg text-white">
                  {level.name}
                </h2>
              </div>
              
              <div className="pointer-events-auto flex flex-col gap-3">
                <button 
                  onClick={() => setGameState('paused')}
                  className="nova-btn w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white"
                  title="Pause Simulation"
                >
                  <Pause size={18} fill="currentColor" />
                </button>
                <button 
                  onClick={() => { setGameState('intro'); setTimeout(()=>setGameState('aiming'), 50); }}
                  className="nova-btn w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white"
                  title="Reset Level"
                >
                  <RotateCcw size={18} />
                </button>
                {gameState === 'aiming' && superpowersLeft > 0 && (
                  <button 
                    onClick={() => { 
                       const nextState = !isDestroyMode;
                       setIsDestroyMode(nextState);
                       isDestroyModeRef.current = nextState;
                    }}
                    className={`nova-btn flex flex-col items-center justify-center rounded-[20px] transition-all ${isDestroyMode ? 'h-auto py-3 px-2 bg-red-500/20 !border-red-500/50 text-red-400' : 'w-10 h-10 text-purple-400 hover:text-purple-300'}`}
                    title="Antimatter Nuke (Destroy Planet)"
                  >
                    <Zap size={18} />
                    {isDestroyMode && <span className="text-[8px] font-bold uppercase tracking-widest mt-2 px-1 text-center leading-tight">Select<br/>Target</span>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* HUD HELPER TEXT */}
          {gameState === 'aiming' && !isDestroyMode && (
             <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none animate-pulse w-full max-w-xs text-center">
                <p className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-white/50 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                   Drag to initiate trajectory
                </p>
             </div>
          )}
          {gameState === 'aiming' && isDestroyMode && (
             <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none animate-bounce w-[90%] sm:w-auto text-center">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase text-red-500 bg-red-900/40 px-3 sm:px-6 py-2 sm:py-3 border border-red-500/50 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                   WIPE PROTOCOL: CLICK A PLANET TO DESTROY
                </p>
             </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      <AnimatePresence>
        
        {/* MAIN MENU */}
        {gameState === 'menu' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <div className="nova-panel p-8 sm:p-12 rounded-2xl max-w-md w-full flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full border border-blue-500/30 bg-blue-500/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                 <FastForward className="text-blue-400" size={32} />
              </div>
              <h1 className="font-display font-black text-4xl mb-2 text-white">NOV<span className="text-blue-400">A</span>FLOW</h1>
              <p className="text-xs font-mono text-blue-400/80 tracking-widest uppercase mb-8">Orbital Mechanics Simulator</p>
              
              <p className="text-sm text-gray-300 leading-relaxed mb-8">
                Welcome to the celestial sandbox. Drag to slingshot the comet payload. Use the gravitational forces of stars to weave your way into the target nodes.
              </p>
              
              <button 
                onClick={() => { setLevelIndex(0); setGameState('intro'); setTimeout(()=>setGameState('aiming'), 500); }}
                className="w-full py-4 rounded-xl nova-btn font-bold uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2 shadow-[0_5px_15px_rgba(59,130,246,0.2)]"
              >
                <Play size={18} /> Initialize Dive
              </button>

              <button 
                onClick={() => { setPrevState('menu'); setGameState('how-to-play'); }}
                className="w-full py-3 mt-4 rounded-xl font-bold uppercase tracking-widest text-[#888] border border-white/10 hover:bg-white/5 transition-colors text-xs flex items-center justify-center gap-2"
              >
                <Info size={16} /> Data Log (How To Play)
              </button>
            </div>
          </motion.div>
        )}

        {/* HOW TO PLAY MODAL */}
        {gameState === 'how-to-play' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-blue-900/40 backdrop-blur-md"
          >
            <div className="nova-panel p-6 sm:p-8 rounded-2xl max-w-sm w-full flex flex-col items-center">
              <h2 className="font-display font-black text-2xl text-blue-400 mb-6 flex items-center gap-2 uppercase tracking-widest">
                 <Info size={24} /> Transmission Log
              </h2>
              
              <ul className="text-sm text-gray-300 space-y-4 mb-8 text-left w-full font-mono tracking-tight">
                 <li className="flex gap-3">
                   <strong className="text-blue-400">1.</strong> 
                   <span>Tap and drag away from the comet to calculate a trajectory.</span>
                 </li>
                 <li className="flex gap-3">
                   <strong className="text-blue-400">2.</strong> 
                   <span>Avoid crashing into stars. Blue planets attract, Red planets repel.</span>
                 </li>
                 <li className="flex gap-3">
                   <strong className="text-blue-400">3.</strong> 
                   <span>Release to fire the payload towards the green orbital ring target.</span>
                 </li>
                 <li className="flex gap-3">
                   <strong className="text-purple-400">4.</strong> 
                   <span>Use the Antimatter Nuke <Zap size={14} className="inline text-purple-400"/> to erase one planet per sector.</span>
                 </li>
              </ul>

              <button 
                onClick={() => setGameState(prevState)}
                className="w-full py-4 rounded-xl nova-btn font-bold uppercase tracking-widest text-sm text-white"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>
        )}

        {/* PAUSED MODAL */}
        {gameState === 'paused' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
            <div className="nova-panel p-8 rounded-2xl max-w-sm w-full flex flex-col items-center text-center">
              <h2 className="font-display font-black text-3xl text-white mb-2 uppercase tracking-widest">PAUSED</h2>
              <p className="text-xs text-blue-400 font-mono tracking-widest uppercase mb-8">Simulation Halted</p>
              
              <div className="flex flex-col w-full gap-3">
                 <button 
                   onClick={() => setGameState('aiming')}
                   className="w-full py-4 rounded-xl nova-btn font-bold uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2"
                 >
                   <Play size={18} fill="currentColor" /> Resume
                 </button>
                 
                 <button 
                   onClick={() => { setPrevState('paused'); setGameState('how-to-play'); }}
                   className="w-full py-3 rounded-lg font-bold uppercase tracking-widest text-gray-300 bg-white/5 hover:bg-white/10 transition-colors text-xs flex items-center justify-center gap-2"
                 >
                   <Info size={16} /> How To Play
                 </button>
                 
                 <button 
                   onClick={() => setGameState('menu')}
                   className="w-full py-3 rounded-lg font-bold uppercase tracking-widest text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors text-xs flex items-center justify-center gap-2"
                 >
                   <Home size={16} /> Return to Core
                 </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* CRASHED MODAL */}
        {gameState === 'crashed' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-red-900/40 backdrop-blur-md"
          >
            <div className="nova-panel p-8 rounded-2xl max-w-sm w-full flex flex-col items-center text-center border-red-500/20">
              <h2 className="font-display font-black text-3xl text-white mb-2">CRITICAL IMPACT</h2>
              <p className="text-xs text-red-400 font-mono tracking-widest uppercase mb-8">Payload Destroyed</p>
              <button 
                onClick={() => { setGameState('intro'); setTimeout(()=>setGameState('aiming'), 50); }}
                className="w-full py-4 rounded-xl nova-btn !border-red-500/30 hover:!border-red-400 font-bold uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} /> Re-Calculate
              </button>
            </div>
          </motion.div>
        )}

        {/* WON STAGE */}
        {gameState === 'won' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-emerald-900/40 backdrop-blur-md"
          >
            <div className="nova-panel p-8 rounded-2xl max-w-sm w-full flex flex-col items-center text-center border-emerald-500/20">
              <h2 className="font-display font-black text-3xl text-emerald-400 mb-2 glow-text">ORBIT ESTABLISHED</h2>
              <p className="text-xs text-emerald-200 font-mono tracking-widest uppercase mb-8">Sector Secured</p>
              
              <button 
                onClick={() => {
                  if (levelIndex < levels.length - 1) {
                    setLevelIndex(i => i + 1);
                    setGameState('intro');
                    setTimeout(() => setGameState('aiming'), 500);
                  } else {
                    setGameState('cleared');
                  }
                }}
                className="w-full py-4 rounded-xl nova-btn !border-emerald-500/30 hover:!border-emerald-400 font-bold uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2"
              >
                <Crosshair size={18} /> Proceed to Next
              </button>
            </div>
          </motion.div>
        )}

        {/* GAME CLEARED */}
        {gameState === 'cleared' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/80 backdrop-blur-lg"
          >
            <div className="nova-panel p-10 rounded-2xl max-w-md w-full flex flex-col items-center text-center border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.15)]">
              <Award size={64} className="text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
              <h2 className="font-display font-black text-4xl text-white mb-2">GALAXY CONQUERED</h2>
              <p className="text-xs text-yellow-500 font-mono tracking-widest uppercase mb-8">Master Navigator</p>
              
              <p className="text-sm text-gray-300 leading-relaxed mb-8">
                You have perfectly mapped the orbital mechanics and completed all sectors. The universe bends to your calculations.
              </p>
              
              <button 
                onClick={() => setGameState('menu')}
                className="w-full py-4 rounded-xl nova-btn font-bold uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2"
              >
                <Home size={18} /> Return to Core
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* FOOTER - Absolute bottom with z-40 so it stays above the blur overlays */}
      <footer className="absolute bottom-0 left-0 w-full z-40 p-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-t from-[#020204] to-transparent border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
         <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
               <span className="text-[9px] sm:text-[10px] font-black tracking-[0.15em] sm:tracking-[0.2em] uppercase text-[#666]">Framework By <span className="text-white">Ram Bapat</span></span>
               <div className="w-1 h-1 rounded-full bg-blue-500 hidden sm:block shadow-[0_0_5px_#60a5fa]" />
               <Cpu size={14} className="text-[#666] hidden sm:block" />
            </div>
            
            <div className="hidden sm:block w-px h-3 bg-[#333]"></div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
               <span className="text-[8px] sm:text-[9px] font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase text-[#666]">April Vibe Coding <span className="text-blue-400 shadow-[0_0_5px_currentColor]">Day 27</span></span>
               <div className="w-1 h-1 rounded-full bg-[#444] sm:hidden" />
               <div className="hidden sm:block w-px h-3 bg-[#333]"></div>
               <span className="text-[8px] sm:text-[9px] font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase text-[#666]">Open Source Protocol</span>
            </div>
         </div>
         
         <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <a href="https://github.com/Barrsum/NovaFlow-Gravity-Puzzle.git" target="_blank" rel="noopener noreferrer" className="text-[#666] hover:text-white hover:scale-110 transition-all">
              <Github size={18} />
            </a>
            <a href="https://www.linkedin.com/in/ram-bapat-barrsum-diamos" target="_blank" rel="noopener noreferrer" className="text-[#666] hover:text-[#0A66C2] hover:scale-110 transition-all">
              <Linkedin size={18} />
            </a>
         </div>
      </footer>
      </div>
    </div>
  );
}
