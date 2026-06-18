import React, { useRef, useEffect, useState } from "react";
import { 
  VehicleType, PlayerStats, GameParticle, Projectile, 
  GameEnemy, GameBossInstance, PowerUp, Skin, Boss
} from "../types";
import { synth } from "./SoundSynth";
import { SHIPS_SKINS, SUBMARINE_SKINS, AIRPLANE_SKINS, BOSSES, getSkinById } from "./GameData";
import { 
  Play, RotateCcw, Volume2, VolumeX, Shield, Zap, Sparkles, Trophy, AlertTriangle, HelpCircle
} from "lucide-react";

interface NavalEngineProps {
  stats: PlayerStats;
  onCoinsEarned: (amount: number) => void;
  onBossDefeated: (bossId: string) => void;
  currentVehicle: VehicleType;
  selectedSkinId: string;
  gameMode: "endless" | { type: "boss"; bossId: string };
  onGameFinished: (outcome: "victory" | "gameover", finalScore: number, coinsEarned: number) => void;
}

export default function NavalEngine({
  stats,
  onCoinsEarned,
  onBossDefeated,
  currentVehicle,
  selectedSkinId,
  gameMode,
  onGameFinished
}: NavalEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Audio mute state
  const [muted, setMuted] = useState(false);
  // Game states readable in React
  const [score, setScore] = useState(0);
  const [coinsInMatch, setCoinsInMatch] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [abilityCooldown, setAbilityCooldown] = useState(0); // 0 to 1 ratio
  const [activeBossHp, setActiveBossHp] = useState<number | null>(null);
  const [activeBossMaxHp, setActiveBossMaxHp] = useState<number | null>(null);
  const [activeBossName, setActiveBossName] = useState("");
  const [showTutorial, setShowTutorial] = useState(true);

  // Cooldown counter tracking
  const abilityTimerRef = useRef<number>(0);
  const abilityMaxCooldown = 10000; // 10 seconds

  // Controls state
  const keysRef = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDownRef = useRef(false);
  const aimTargetRef = useRef<{ x: number; y: number } | null>(null);

  // Permanent stat multipliers from upgrades to use in engine
  const hpMultiplier = 1 + (stats.upgrades.hp - 1) * 0.3; // +30% each level
  const dmgMultiplier = 1 + (stats.upgrades.damage - 1) * 0.25; // +25% each level
  const speedMultiplier = 1 + (stats.upgrades.speed - 1) * 0.15; // +15% each level

  // Ability active state to draw visual effects
  const shieldActiveRef = useRef<boolean>(false);
  const bulletSpeedBoostRef = useRef<boolean>(false);
  const damageBoostRef = useRef<boolean>(false);
  const ghostAbilitiesRef = useRef<boolean>(false);

  useEffect(() => {
    synth.enabled = !muted;
  }, [muted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(e.code)) {
        e.preventDefault(); // Prevent scrolling pages
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Main canvas simulation logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;

    // Config stats of player active skin
    const activeSkin = getSkinById(selectedSkinId) || {
      id: "default",
      tint: "#3b82f6",
      particleColor: "#cbd5e1",
      maxHpBonus: 0,
      damageBonus: 0,
      speedBonus: 0,
      specialAbility: ""
    };

    // Calculate maximum health
    const maxHp = Math.round((100 + activeSkin.maxHpBonus) * hpMultiplier);
    setPlayerMaxHp(maxHp);
    let hp = maxHp;
    setPlayerHp(hp);

    // Initial game coordinates
    let player = {
      x: 180,
      y: 200,
      vx: 0,
      vy: 0,
      width: 65,
      height: 38,
      jumpForce: 0,
      isJumping: false,
      angle: 0,
      lastShotTime: 0,
      shootInterval: 350, // ms
      shieldHp: 0,
      magnetRange: 100
    };

    // If rapid fire weapon
    if (currentVehicle === "airplane") {
      player.shootInterval = 180; // Airplanes shoot faster
    } else if (currentVehicle === "submarine") {
      player.shootInterval = 450; // Torpedoes are slower but heavy
    }

    // Adjust shoot speeds based on skins
    if (selectedSkinId.includes("cyberpunk") || selectedSkinId.includes("shadow")) {
      player.shootInterval -= 50;
    }

    // Track dynamic lists
    let projectiles: Projectile[] = [];
    let enemies: GameEnemy[] = [];
    interface GameShark {
      id: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      width: number;
      height: number;
      hp: number;
      maxHp: number;
      points: number;
      timeOffset: number;
    }
    interface GameAirdrop {
      id: string;
      x: number;
      y: number;
      vy: number;
      width: number;
      height: number;
      type: "shield" | "triple" | "magnet" | "heal" | "coin";
      state: "falling" | "floating";
      floatTimer: number;
    }
    let sharks: GameShark[] = [];
    let airdrops: GameAirdrop[] = [];
    let bossInstance: GameBossInstance | null = null;
    let particles: GameParticle[] = [];
    let powerUps: PowerUp[] = [];
    let gameScore = 0;
    let earnedCoinsCount = 0;
    let waveProgress = 0; // percentage to boss spawn
    let isBossSequenceOn = false;

    // If specific Boss is selected in gameMode list
    const targetBossConfig = typeof gameMode === "object" && gameMode.type === "boss" 
      ? BOSSES.find(b => b.id === gameMode.bossId) 
      : null;

    let time = 0;

    // Water level parameters
    const waterBaseY = canvas.height * 0.6; // 300px standard

    // Powerup bonuses
    let tripleShotMultiplier = 0; // duration ticks
    let activeShieldDuration = 0;
    let magnetDuration = 0;

    // Ability cooldown timer
    let abilityCooldownTimer = 0;

    // Particle factory
    const spawnExplosion = (x: number, y: number, color: string, scale: number = 1, shape: "circle"|"square"|"bubble"|"star" = "circle") => {
      const count = Math.round(15 * scale);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.5 + Math.random() * 4) * scale;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (shape === "bubble" ? 1.5 : 0),
          color,
          size: (2 + Math.random() * 5) * (shape === "bubble" ? 1.5 : 1),
          alpha: 1,
          decay: 0.015 + Math.random() * 0.02,
          gravity: shape === "bubble" ? -0.05 : 0.06,
          shape
        });
      }
    };

    const spawnBubbles = (x: number, y: number, count = 2) => {
      for (let i = 0; i < count; i++) {
        particles.push({
          x,
          y,
          vx: -1 - Math.random() * 2,
          vy: -0.2 - Math.random() * 0.6,
          color: "rgba(186, 230, 253, 0.6)",
          size: 1.5 + Math.random() * 4,
          alpha: 0.8,
          decay: 0.01 + Math.random() * 0.015,
          gravity: -0.06,
          shape: "bubble"
        });
      }
    };

    const spawnVaporTrail = (x: number, y: number, color = "rgba(226, 232, 240, 0.4)") => {
      particles.push({
        x,
        y,
        vx: -1 - Math.random() * 1.5,
        vy: (Math.random() - 0.5) * 0.5,
        color,
        size: 2 + Math.random() * 4,
        alpha: 0.7,
        decay: 0.02 + Math.random() * 0.01,
        shape: "circle"
      });
    };

    // Waves physics calculator
    const getWaterHeightAt = (x: number, t: number) => {
      const w1 = Math.sin(x * 0.012 + t * 0.04) * 16;
      const w2 = Math.cos(x * 0.006 - t * 0.02) * 8;
      const waveDelta = w1 + w2;
      return waterBaseY + waveDelta;
    };

    // Calculate wave derivative for ship tilting
    const getWaterSlopeAt = (x: number, t: number) => {
      const eps = 2;
      const y1 = getWaterHeightAt(x - eps, t);
      const y2 = getWaterHeightAt(x + eps, t);
      return Math.atan2(y2 - y1, eps * 2);
    };

    // Pre-spawning background clouds
    let clouds: { x: number; y: number; scale: number; speed: number }[] = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: 20 + Math.random() * 110,
        scale: 0.6 + Math.random() * 1.0,
        speed: 0.15 + Math.random() * 0.3
      });
    }

    // Pre-spawning background seabed elements
    let seabedDebris: { x: number; y: number; r: number; color: string }[] = [];
    for (let i = 0; i < 15; i++) {
      seabedDebris.push({
        x: Math.random() * canvas.width,
        y: canvas.height - 15 - Math.random() * 30,
        r: 3 + Math.random() * 8,
        color: ["#1e293b", "#334155", "#0f172a", "#111827"][Math.floor(Math.random() * 4)]
      });
    }

    // Start-up triggers
    if (targetBossConfig) {
      // Direct boss fight setup
      isBossSequenceOn = true;
      setScore(0);
      setCoinsInMatch(0);
    }

    // Main weapon shooting function
    const triggerPlayerShot = () => {
      const now = Date.now();
      if (now - player.lastShotTime < player.shootInterval) return;
      player.lastShotTime = now;

      const pDmg = Math.round((18 + activeSkin.damageBonus) * dmgMultiplier);

      // Trigger respective audio
      synth.playShoot(currentVehicle);

      // Core calculation of firing direction
      let cosA = 1;
      let sinA = 0;
      let angle = player.angle;
      let hasAim = false;

      if (aimTargetRef.current) {
        // Compute nozzle start coordinate
        const originX = player.x + 50;
        const originY = player.y + 8;
        const dx = aimTargetRef.current.x - originX;
        const dy = aimTargetRef.current.y - originY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          cosA = dx / dist;
          sinA = dy / dist;
          angle = Math.atan2(dy, dx);
          player.angle = angle * 0.45; // slightly tilt visual model towards tap!
          hasAim = true;
        }
      }

      // Ship: arching shells or depth charges
      if (currentVehicle === "ship") {
        if (!hasAim && (keysRef.current["ArrowDown"] || keysRef.current["KeyS"])) {
          // Drop depth charge sinking straight down
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 10,
            y: player.y + 15,
            vx: player.vx * 0.5,
            vy: 2.2,
            radius: 8,
            color: "#e11d48", // Dark red
            owner: "player",
            damage: pDmg * 1.5,
            type: "depth_charge",
            g: 0.05
          });
          spawnExplosion(player.x + 10, player.y + 15, "#10b981", 0.4);
        } else {
          // Cannon shell with arc
          const baseAngle = hasAim ? angle : (player.angle - 0.25);
          const spd = 6.8 + (stats.upgrades.speed * 0.4);

          if (tripleShotMultiplier > 0 || selectedSkinId === "ship_classic" || selectedSkinId === "ship_pirate") {
            // Triple-Shot
            [-0.2, 0, 0.2].forEach((spreadAngle) => {
              projectiles.push({
                id: Math.random().toString(),
                x: player.x + 50,
                y: player.y - 5,
                vx: Math.cos(baseAngle + spreadAngle) * spd,
                vy: Math.sin(baseAngle + spreadAngle) * spd,
                radius: 6,
                color: activeSkin.particleColor,
                owner: "player",
                damage: pDmg,
                type: "bullet",
                g: 0.12
              });
            });
          } else {
            // Single high damage deck fire
            const multiBarrel = selectedSkinId === "ship_dreadnought";
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 52,
              y: player.y - 4,
              vx: Math.cos(baseAngle) * (spd + 1),
              vy: Math.sin(baseAngle) * (spd + 1),
              radius: multiBarrel ? 8 : 6,
              color: activeSkin.particleColor,
              owner: "player",
              damage: multiBarrel ? pDmg * 1.8 : pDmg,
              type: "bullet",
              g: 0.1
            });
            if (multiBarrel) {
              // Second barrel slightly offset
              projectiles.push({
                id: Math.random().toString(),
                x: player.x + 48,
                y: player.y + 2,
                vx: Math.cos(baseAngle - 0.05) * spd,
                vy: Math.sin(baseAngle - 0.05) * spd,
                radius: 6,
                color: activeSkin.particleColor,
                owner: "player",
                damage: pDmg * 0.9,
                type: "bullet",
                g: 0.1
              });
            }
          }
          spawnExplosion(player.x + 52, player.y - 4, activeSkin.particleColor, 0.7);
        }
      } 
      // Submarine: underwater straight torpedoes
      else if (currentVehicle === "submarine") {
        const torpSpd = 5.5 + (stats.upgrades.speed * 0.3);
        const subSpdMult = selectedSkinId === "sub_shadow" ? 1.4 : 1.0;

        if (selectedSkinId === "sub_leviathan") {
          // Bio Spores that splits or has homing capability
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 55,
            y: player.y + 8,
            vx: cosA * torpSpd * 1.1 * subSpdMult,
            vy: sinA * torpSpd * 1.1 * subSpdMult,
            radius: 8,
            color: "#d946ef", // purple spore
            owner: "player",
            damage: pDmg * 1.25,
            type: "torpedo"
          });
        } else if (selectedSkinId === "sub_nautilus") {
          // Steam spray + dual rockets
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 50,
            y: player.y,
            vx: cosA * torpSpd * subSpdMult,
            vy: (hasAim ? sinA * torpSpd : -1.0),
            radius: 5,
            color: "#f59e0b",
            owner: "player",
            damage: pDmg * 0.8,
            type: "torpedo"
          });
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 50,
            y: player.y + 15,
            vx: cosA * torpSpd * subSpdMult,
            vy: (hasAim ? sinA * torpSpd : 1.0),
            radius: 5,
            color: "#f59e0b",
            owner: "player",
            damage: pDmg * 0.8,
            type: "torpedo"
          });
        } else {
          // Standard Torpedo
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 55,
            y: player.y + 8,
            vx: cosA * torpSpd * subSpdMult,
            vy: sinA * torpSpd * subSpdMult,
            radius: 7,
            color: "#38bdf8",
            owner: "player",
            damage: pDmg,
            type: "torpedo"
          });
        }
        spawnExplosion(player.x + 55, player.y + 8, activeSkin.particleColor, 0.5, "bubble");
      } 
      // Airplane: horizontal high velocity fire + optional bombs
      else {
        const bulletSpd = 9.5;
        if (!hasAim && (keysRef.current["ArrowDown"] || keysRef.current["KeyS"])) {
          // Drop Bomb vertical downwards falling
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 15,
            y: player.y + player.height - 5,
            vx: player.vx * 0.4 + 1.5,
            vy: 1.8,
            radius: 7,
            color: "#ea580c",
            owner: "player",
            damage: pDmg * 1.6,
            type: "bomb",
            g: 0.15
          });
          spawnExplosion(player.x + 15, player.y + 35, "#ef4444", 0.4);
        } else {
          // Plane Machine guns forward towards vector
          if (selectedSkinId === "plane_ufo") {
            // Giant Laser beam
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 65,
              y: player.y + 8,
              vx: cosA * 15,
              vy: sinA * 15,
              radius: 9,
              color: "#f43f5e",
              owner: "player",
              damage: pDmg * 1.5,
              type: "laser"
            });
          } else if (selectedSkinId === "plane_redbaron") {
            // Rapid double line machine gun
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 60,
              y: player.y + 2,
              vx: cosA * bulletSpd * 1.1,
              vy: sinA * bulletSpd * 1.1,
              radius: 4,
              color: "#f87171",
              owner: "player",
              damage: pDmg * 0.6,
              type: "bullet"
            });
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 60,
              y: player.y + 12,
              vx: cosA * bulletSpd * 1.1,
              vy: sinA * bulletSpd * 1.1,
              radius: 4,
              color: "#f87171",
              owner: "player",
              damage: pDmg * 0.6,
              type: "bullet"
            });
          } else if (selectedSkinId === "plane_golden") {
            // Gilded heavy bullet
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 60,
              y: player.y + 8,
              vx: cosA * bulletSpd,
              vy: sinA * bulletSpd,
              radius: 5,
              color: "#fbbf24",
              owner: "player",
              damage: pDmg,
              type: "bullet"
            });
          } else if (selectedSkinId === "plane_fortress") {
            // Strong heavy kinetic canon
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 62,
              y: player.y + 10,
              vx: cosA * bulletSpd * 0.9,
              vy: sinA * bulletSpd * 0.9,
              radius: 7,
              color: "#22c55e",
              owner: "player",
              damage: pDmg * 1.3,
              type: "bullet"
            });
          } else {
            // Classic plane shoot
            projectiles.push({
              id: Math.random().toString(),
              x: player.x + 58,
              y: player.y + 8,
              vx: cosA * bulletSpd,
              vy: sinA * bulletSpd,
              radius: 4.5,
              color: "#e2e8f0",
              owner: "player",
              damage: pDmg,
              type: "bullet"
            });
          }
          spawnExplosion(player.x + 58, player.y + 8, activeSkin.particleColor, 0.4);
        }
      }
    };

    // Activate the vehicle specific / skin specific ultimate ability
    const triggerUltimate = () => {
      if (abilityCooldownTimer > 0) return;
      abilityCooldownTimer = abilityMaxCooldown;
      abilityTimerRef.current = Date.now();

      const pDmg = Math.round((18 + activeSkin.damageBonus) * dmgMultiplier);

      // Trigger action visual/sound effects
      synth.playPowerup();
      spawnExplosion(player.x + player.width/2, player.y + player.height/2, activeSkin.particleColor, 3, "star");

      // Set unique modifier flags depending on Selected Skin
      if (selectedSkinId.includes("ironclad") || selectedSkinId.includes("stealth") || activeSkin.id === "sub_shadow") {
        // Steel Shield / Stealth Mode: Absorbs damage for 4.5 seconds
        activeShieldDuration = 270; // 4.5 seconds on 60 FPS
        shieldActiveRef.current = true;
      } else if (selectedSkinId.includes("classic")) {
        // Double Speed Dash
        player.vx = 9.5 * speedMultiplier;
        spawnExplosion(player.x, player.y, "#38bdf8", 1.8);
      } else if (selectedSkinId === "ship_cyberpunk") {
        // Neon Spark Dash
        player.vx = 14 * speedMultiplier;
        spawnExplosion(player.x, player.y, "#06b6d4", 2, "star");
        // Destroy small enemies in immediate path
        enemies.forEach(e => {
          if (Math.abs(e.x - player.x) < 220 && Math.abs(e.y - player.y) < 100) {
            e.hp -= 200;
          }
        });
      } else if (selectedSkinId === "ship_golden" || selectedSkinId === "sub_gold" || selectedSkinId === "plane_golden") {
        // Golden Wealth Rain: Spawns massive magnets and spawns local gold coins
        magnetDuration = 350; // Magnet active for longer
        for (let i = 0; i < 6; i++) {
          powerUps.push({
            id: Math.random().toString(),
            x: player.x + 80 + Math.random() * 250,
            y: player.y - 100 - Math.random() * 100,
            type: "coin",
            radius: 8,
            vy: 2 + Math.random() * 2
          });
        }
      } else if (selectedSkinId === "ship_pirate" || selectedSkinId === "sub_leviathan") {
        // Curse / Spore blast: slow down all enemies on screen by 60%
        enemies.forEach(e => {
          e.vx *= 0.3;
          e.shootCooldown += 4; // delay shots
        });
        if (bossInstance) {
          bossInstance.vx *= 0.5;
        }
        // Emit ghost rays from galley
        spawnExplosion(player.x + 30, player.y + 10, "#10b981", 4, "circle");
      } else if (selectedSkinId === "ship_icebreaker") {
        // Freezing Blizzard: clear all bullets on screen by turning them harmless
        projectiles = projectiles.filter(p => p.owner === "player");
        spawnExplosion(player.x + 30, player.y + 10, "#e0f2fe", 4, "star");
      } else if (selectedSkinId === "ship_dreadnought" || selectedSkinId === "plane_fortress") {
        // Direct Heavy Carpet Bombardment
        synth.playExplosion("large");
        for (let i = 0; i < 10; i++) {
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 100 + (i * 70),
            y: player.y - 120,
            vx: 0,
            vy: 4.8,
            radius: 12,
            color: "#f43f5e",
            owner: "player",
            damage: 150 * dmgMultiplier,
            type: "bomb",
            g: 0.1
          });
        }
      } else if (selectedSkinId === "sub_nautilus") {
        // Extreme steam vents
        for (let i = 0; i < 18; i++) {
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + 40,
            y: player.y + 10,
            vx: 3 + Math.random() * 4,
            vy: (Math.random() - 0.5) * 6,
            radius: 6,
            color: "#f59e0b",
            owner: "player",
            damage: 30,
            type: "bullet"
          });
        }
      } else if (selectedSkinId === "sub_angler") {
        // Bio-Pulse flash: freeze enemies for 4.5 seconds
        enemies.forEach(e => {
          e.vx = 0;
          e.vy = 0;
          e.shootInterval = 99999;
        });
        spawnExplosion(player.x, player.y, "#ec4899", 3.2, "star");
      } else if (selectedSkinId === "plane_redbaron" || selectedSkinId === "plane_stealth") {
        // Flying Berserker Turbo Boost
        bulletSpeedBoostRef.current = true;
        tripleShotMultiplier = 280; // Triple horizontal stream of bullets
      } else if (selectedSkinId === "plane_ufo") {
        // Giant Gravitational Black Hole
        magnetDuration = 350;
        // High damage laser ring
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          projectiles.push({
            id: Math.random().toString(),
            x: player.x + player.width/2,
            y: player.y + player.height/2,
            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8,
            radius: 8,
            color: "#d946ef",
            owner: "player",
            damage: pDmg,
            type: "laser"
          });
        }
      }
    };

    // Enemy Spawner Routine
    const spawnEnemy = () => {
      if (isBossSequenceOn && bossInstance) return; // standard spawns locked during active boss

      const randY = 40 + Math.random() * (canvas.height - 100);
      const randType = Math.random();

      // Filter appropriate enemy types based on player's workspace context
      let subType: "water" | "underwater" | "air" = "water";
      let type: GameEnemy["type"] = "scout_boat";
      let width = 45;
      let height = 25;
      let hpVal = 30 + (gameScore * 0.05);
      let coinsDrop = 1 + Math.floor(Math.random() * 2);
      let shootInt = 1500 + Math.random() * 1500;
      let vx = -1.2 - Math.random() * 1.5;
      let vy = 0;

      if (randType < 0.35) {
        // Air enemy (cruises in high zone)
        subType = "air";
        type = Math.random() > 0.5 ? "dive_bomber" : "drone";
        width = 40;
        height = 20;
        hpVal = 25 + (gameScore * 0.03);
        vx = -1.8 - Math.random() * 2.0;
        if (type === "dive_bomber") {
          shootInt = 1200;
        }
      } else if (randType > 0.70) {
        // Underwater enemy (cruises in deep bottom waters)
        subType = "underwater";
        type = Math.random() > 0.5 ? "sub_scout" : "mine";
        width = 45;
        height = 25;
        hpVal = 40 + (gameScore * 0.04);
        vx = -1.0 - Math.random() * 1.2;

        if (type === "mine") {
          width = 24;
          height = 24;
          hpVal = 10;
          vx = -1.0;
          coinsDrop = 1;
          shootInt = 999999; // Mines do not shoot, they explode on touch!
        }
      } else {
        // Surface boat enemy
        subType = "water";
        type = Math.random() > 0.5 ? "scout_boat" : "cruiser";
        width = 50;
        height = 24;
        hpVal = 45 + (gameScore * 0.06);
        vx = -1.3 - Math.random() * 1.2;

        if (type === "cruiser") {
          width = 64;
          height = 32;
          hpVal = 80 + (gameScore * 0.08);
          shootInt = 2000;
          coinsDrop = 3;
        }
      }

      // Initial placement
      let spawnY = randY;
      if (subType === "water") {
        spawnY = getWaterHeightAt(canvas.width + 50, time) - height + 4;
      } else if (subType === "underwater") {
        // Below water surface
        const minW = getWaterHeightAt(canvas.width + 50, time) + 30;
        spawnY = minW + Math.random() * (canvas.height - minW - 50);
      } else {
        // Air strictly above water surface
        const maxW = getWaterHeightAt(canvas.width + 50, time) - 60;
        spawnY = 20 + Math.random() * (maxW - 40);
      }

      enemies.push({
        id: Math.random().toString(),
        x: canvas.width + 50,
        y: spawnY,
        width,
        height,
        vx,
        vy,
        hp: Math.round(hpVal),
        maxHp: Math.round(hpVal),
        type,
        subType,
        shootCooldown: 60 + Math.random() * 120,
        shootInterval: shootInt,
        points: Math.round(hpVal * 0.5) + 5,
        coinsReward: coinsDrop
      });
    };

    // Boss spawning routine
    const spawnActiveBoss = (bossId: string) => {
      const bConfig = BOSSES.find(b => b.id === bossId);
      if (!bConfig) return;

      synth.playAlarm();
      isBossSequenceOn = true;

      // Reset boss instance
      bossInstance = {
        id: bConfig.id,
        name: bConfig.name,
        x: canvas.width + 120,
        y: bConfig.bossType === "underwater" ? waterBaseY + 70 : 80,
        width: 140,
        height: 100,
        hp: bConfig.hp,
        maxHp: bConfig.hp,
        vx: -1.0,
        vy: 0,
        shootCooldownSec: 2,
        attackPatternTimer: 0,
        currentPattern: 0,
        stateArgs: { phase: 1, directionY: 1 }
      };

      setScore(0);
      setActiveBossHp(bossInstance.hp);
      setActiveBossMaxHp(bossInstance.maxHp);
      setActiveBossName(`${bConfig.name} - ${bConfig.title}`);
    };

    // Spawn first wave
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (isRunning) spawnEnemy();
      }, 500 + i * 1400);
    }

    // GAME LOOP TIMER
    const loop = () => {
      if (!isRunning) return;
      time++;

      // Update ability cooldown in React state
      if (abilityCooldownTimer > 0) {
        abilityCooldownTimer = Math.max(0, abilityCooldownTimer - 16.6); // 60fps simulation
        setAbilityCooldown(abilityCooldownTimer / abilityMaxCooldown);
      } else {
        setAbilityCooldown(0);
      }

      // Decrement durations
      if (tripleShotMultiplier > 0) tripleShotMultiplier--;
      if (activeShieldDuration > 0) {
        activeShieldDuration--;
        if (activeShieldDuration <= 0) shieldActiveRef.current = false;
      }
      if (magnetDuration > 0) magnetDuration--;

      // Render sky background with solid dark blue & stars
      ctx.fillStyle = "#0A0D14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw starry ambient sparkles in the sky
      ctx.fillStyle = "rgba(224, 242, 254, 0.35)";
      for (let i = 0; i < 20; i++) {
        const starX = (Math.sin(i * 452 + time * 0.001) * 0.5 + 0.5) * canvas.width;
        const starY = (Math.cos(i * 123) * 0.5 + 0.5) * (waterBaseY - 50);
        ctx.fillRect(starX, starY, 1.8, 1.8);
      }

      // Draw glowing orbital moon in high corner
      ctx.beginPath();
      ctx.arc(canvas.width - 120, 60, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#e2e8f0";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow

      // Draw custom beautiful scrolling clouds
      ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
      clouds.forEach((cloud) => {
        cloud.x -= cloud.speed;
        if (cloud.x < -150) cloud.x = canvas.width + 50;

        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 25 * cloud.scale, 0, Math.PI * 2);
        ctx.arc(cloud.x + 20 * cloud.scale, cloud.y - 10 * cloud.scale, 30 * cloud.scale, 0, Math.PI * 2);
        ctx.arc(cloud.x + 45 * cloud.scale, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Spawn normal enemies in endless mode
      if (!isBossSequenceOn && time % 120 === 0 && enemies.length < 8) {
        spawnEnemy();
      }

      // Spawning Sharks 🦈
      if (time % 220 === 0 && sharks.length < 4) {
        const sHp = 35 + Math.floor(gameScore * 0.05);
        sharks.push({
          id: Math.random().toString(),
          x: canvas.width + 40,
          y: waterBaseY + 40 + Math.random() * (canvas.height - waterBaseY - 80),
          vx: -1.4 - Math.random() * 1.6,
          vy: 0,
          width: 56,
          height: 28,
          hp: sHp,
          maxHp: sHp,
          points: 30,
          timeOffset: Math.random() * 100
        });
      }

      // Spawning Parachute Airdrops 🪂
      if (time % 360 === 0 && airdrops.length < 2) {
        const bTypes: ("shield"|"triple"|"magnet"|"heal"|"coin")[] = ["shield", "triple", "magnet", "heal", "coin"];
        const chosenType = bTypes[Math.floor(Math.random() * bTypes.length)];
        airdrops.push({
          id: Math.random().toString(),
          x: 120 + Math.random() * (canvas.width - 240),
          y: -40,
          vy: 1.1,
          width: 32,
          height: 32,
          type: chosenType,
          state: "falling",
          floatTimer: 300 // 5 seconds at 60fps
        });
      }

      // Endless mode Boss generation logic: every 1500 points, summon a random Boss!
      if (!isBossSequenceOn && typeof gameMode !== "object" && gameScore > 0 && gameScore % 1400 === 0) {
        const randomBoss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
        spawnActiveBoss(randomBoss.id);
      } else if (targetBossConfig && !isBossSequenceOn && !bossInstance) {
        // Direct boss selection fight, spawn immediately
        spawnActiveBoss(targetBossConfig.id);
      }

      // Draw bottom deep sea parallax layers (underwater context background)
      ctx.fillStyle = "#0c1524"; // Sub-water ambient deep zone
      ctx.fillRect(0, waterBaseY, canvas.width, canvas.height - waterBaseY);

      // Ambient light shafts in water
      ctx.fillStyle = "rgba(14, 116, 144, 0.08)";
      for (let i = 0; i < 4; i++) {
        const xOffset = (time * 0.15 + i * 200) % canvas.width;
        ctx.beginPath();
        ctx.moveTo(xOffset, waterBaseY);
        ctx.lineTo(xOffset + 60, waterBaseY);
        ctx.lineTo(xOffset - 40, canvas.height);
        ctx.lineTo(xOffset - 110, canvas.height);
        ctx.closePath();
        ctx.fill();
      }

      // Draw seabed elements
      seabedDebris.forEach((rock) => {
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
        ctx.fillStyle = rock.color;
        ctx.fill();
      });

      // ---------------------------------------------
      // PLAYER PHYSICS AND RENDER
      // ---------------------------------------------
      const currWaterY = getWaterHeightAt(player.x + player.width / 2, time);

      // Check keyboard/mouse controls
      let wishX = 0;
      let wishY = 0;

      if (keysRef.current["ArrowLeft"] || keysRef.current["KeyA"]) wishX = -1;
      if (keysRef.current["ArrowRight"] || keysRef.current["KeyD"]) wishX = 1;

      // Vehicle specific vertical physics
      if (currentVehicle === "ship") {
        // Standard ship floating on water plus jumping physics
        const idealY = currWaterY - player.height + 4;

        if (keysRef.current["ArrowUp"] || keysRef.current["KeyW"] || keysRef.current["Space"]) {
          if (!player.isJumping) {
            player.jumpForce = 8.5 * speedMultiplier;
            player.isJumping = true;
            synth.playJump();
            // splash particle
            spawnExplosion(player.x + player.width/2, idealY + player.height, "#38bdf8", 1.2, "bubble");
          }
        }

        if (player.isJumping) {
          player.y -= player.jumpForce;
          player.jumpForce -= 0.32; // Gravity deceleration

          // Splash back down
          if (player.y >= idealY) {
            player.y = idealY;
            player.isJumping = false;
            player.jumpForce = 0;
            // Heavy splash
            synth.playExplosion("small");
            spawnExplosion(player.x + player.width/2, idealY + player.height, "#38bdf8", 1.5, "bubble");
          }
        } else {
          // Locks ship strictly on dynamic wave surface!
          player.y = idealY;
        }

        // Tilt angle aligns with the derivative slope of the waves
        player.angle = getWaterSlopeAt(player.x + player.width / 2, time) * 0.75;
      } 
      else if (currentVehicle === "submarine") {
        // Underwater moving freely up and down but locked below water surface level
        if (keysRef.current["ArrowUp"] || keysRef.current["KeyW"]) wishY = -1;
        if (keysRef.current["ArrowDown"] || keysRef.current["KeyS"]) wishY = 1;

        const subSpeed = 2.4 * speedMultiplier;
        player.y += wishY * subSpeed;

        // Clip Submarine Y to keep it submerged
        const minDepth = currWaterY + 15;
        if (player.y < minDepth) {
          player.y = minDepth;
        }
        if (player.y > canvas.height - player.height - 15) {
          player.y = canvas.height - player.height - 15;
        }

        player.angle = wishY * 0.15; // pitch up or down on direction
        // Bubble streams trail
        if (time % 8 === 0) {
          spawnBubbles(player.x, player.y + player.height / 2, 1);
        }
      } 
      else if (currentVehicle === "airplane") {
        // Airplane flying free but stays strictly in sky above water
        if (keysRef.current["ArrowUp"] || keysRef.current["KeyW"]) wishY = -1;
        if (keysRef.current["ArrowDown"] || keysRef.current["KeyS"]) wishY = 1;

        const planeSpeed = 3.6 * speedMultiplier;
        player.y += wishY * planeSpeed;

        // Clip Airplane Y to sky zone
        const maxPlaneAltitude = currWaterY - player.height - 35;
        if (player.y > maxPlaneAltitude) {
          player.y = maxPlaneAltitude;
        }
        if (player.y < 15) {
          player.y = 15;
        }

        player.angle = wishY * 0.22; // pitch plane wings
        // exhaust vapor trail particles
        if (time % 4 === 0) {
          spawnVaporTrail(player.x - 2, player.y + player.height / 2, activeSkin.particleColor + "45");
        }
      }

      // Horizontal moving bounds
      const horizSpeed = (currentVehicle === "airplane" ? 3.8 : currentVehicle === "submarine" ? 2.6 : 3.0) * speedMultiplier;
      player.x += wishX * horizSpeed;
      if (player.x < 10) player.x = 10;
      if (player.x > canvas.width - player.width - 40) player.x = canvas.width - player.width - 40;

      // Handle Shooting Trigger (F key, Enter or mouse click / auto firing)
      if (keysRef.current["KeyF"] || keysRef.current["Enter"] || isMouseDownRef.current || keysRef.current["Space"]) {
        // Do not jump and fire simultaneously for ship to avoid messy setups
        if (currentVehicle !== "ship" || !keysRef.current["Space"]) {
          triggerPlayerShot();
        }
      }

      // Handle Ultimate E key trigger
      if (keysRef.current["KeyE"]) {
        triggerUltimate();
      }

      // DRAW PLAYER VEHICLE BASED ON SKIN
      ctx.save();
      ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
      ctx.rotate(player.angle);

      // Render custom procedural graphics for selected vehicle skin
      const tint = activeSkin.tint;

      if (currentVehicle === "ship") {
        // DRAW SHIP DECK
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.moveTo(-30, -5); // stern
        ctx.lineTo(25, -5); // bow deck
        ctx.quadraticCurveTo(38, -5, 36, 12); // nose curve
        ctx.lineTo(-24, 12); // keel
        ctx.quadraticCurveTo(-34, 12, -30, -5); // stern curve
        ctx.closePath();
        ctx.fill();

        // Armored hull plating line
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cabin superstructure
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(-15, -13, 25, 8);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(2, -11, 6, 5); // windshield window

        // Radar mast / antenna
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-10, -13);
        ctx.lineTo(-10, -22);
        ctx.moveTo(-13, -19);
        ctx.lineTo(-7, -19);
        ctx.stroke();

        // Gun Turret canon on bow
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(8, -10, 14, 5); // turret base
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#475569";
        ctx.beginPath();
        ctx.moveTo(18, -8);
        ctx.lineTo(34, -11); // barrel aiming up
        ctx.stroke();

        // Sparkle Golden Yachts
        if (selectedSkinId === "ship_golden") {
          ctx.font = "10px sans-serif";
          ctx.fillText("👑", -5, -18);
        }
        // Pirate skulls flag
        if (selectedSkinId === "ship_pirate") {
          ctx.fillStyle = "#111827";
          ctx.fillRect(-22, -26, 12, 10);
          ctx.fillStyle = "#ffffff";
          ctx.font = "8px sans-serif";
          ctx.fillText("☠️", -21, -18);
        }
      } 
      else if (currentVehicle === "submarine") {
        // DRAW SUBMARINE HULL
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.arc(0, 0, 14, Math.PI / 2, (3 * Math.PI) / 2); // tail sphere
        ctx.lineTo(25, -14); // upper deck
        ctx.quadraticCurveTo(38, -14, 38, 0); // nose bow
        ctx.quadraticCurveTo(38, 14, 25, 14); // bottom bow
        ctx.lineTo(-10, 14); // bottom hull
        ctx.closePath();
        ctx.fill();

        // Steel texture lining
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Conning Tower (hatch mast)
        ctx.fillStyle = tint;
        ctx.fillRect(5, -23, 14, 11);
        ctx.fillStyle = "#94a3b8"; // viewport glass
        ctx.fillRect(14, -20, 3, 5);

        // Periscope pipe
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -23);
        ctx.lineTo(10, -32);
        ctx.lineTo(14, -32);
        ctx.stroke();

        // Rear steering rudders
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-22, -10, 8, 20);

        // Rotating Propeller blade
        const propRotation = (time * 0.25) % (Math.PI * 2);
        ctx.save();
        ctx.translate(-22, 0);
        ctx.rotate(propRotation);
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(0, 9);
        ctx.stroke();
        ctx.restore();

        // Nautilus steampunk decorative details
        if (selectedSkinId === "sub_nautilus") {
          ctx.strokeStyle = "#ca8a04"; // gold brass tube lining
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-10, 6);
          ctx.lineTo(20, 6);
          ctx.stroke();
          // Large orange riveted biolight circular glass window
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (selectedSkinId === "sub_angler") {
          // glow lure
          ctx.strokeStyle = "#f472b6";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(28, -25, 4, 0, Math.PI*2);
          ctx.fillStyle = "#db2777";
          ctx.fill();
          ctx.stroke();
        }
      } 
      else if (currentVehicle === "airplane") {
        // DRAW AIRPLANE
        // Fuselage
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main wing (swept or straight based on style)
        ctx.fillStyle = "#1e293b";
        if (selectedSkinId === "plane_stealth") {
          // F117 faceted sharp stealth wings
          ctx.fillStyle = "#09090b";
          ctx.beginPath();
          ctx.moveTo(-15, -4);
          ctx.lineTo(-24, -28);
          ctx.lineTo(5, -4);
          ctx.closePath();
          ctx.fill();
        } else if (selectedSkinId === "plane_ufo") {
          // Circular rings saucer
          ctx.fillStyle = "rgba(134, 25, 143, 0.45)";
          ctx.beginPath();
          ctx.ellipse(0, 0, 32, 14, 0, 0, Math.PI*2);
          ctx.fill();
        } else {
          // Twin wings or normal propeller plane wings
          ctx.fillRect(-10, -28, 12, 56);
          if (selectedSkinId === "plane_redbaron") {
            // Second wing overlay for triplane
            ctx.fillStyle = tint;
            ctx.fillRect(-15, -28, 6, 56);
          }
        }

        // Tail vertical horizontal stabilizer rudder
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(-32, -18);
        ctx.lineTo(-26, 0);
        ctx.closePath();
        ctx.fill();

        // Cockpit canopy dome
        ctx.fillStyle = "#67e8f9";
        ctx.beginPath();
        ctx.ellipse(6, -6, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spinning front propeller
        if (selectedSkinId !== "plane_stealth" && selectedSkinId !== "plane_ufo") {
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1.5;
          const leafRotation = (time * 0.45) % (Math.PI * 2);
          ctx.save();
          ctx.translate(26, 0);
          ctx.rotate(leafRotation);
          ctx.beginPath();
          ctx.moveTo(0, -20);
          ctx.lineTo(0, 20);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw ACTIVE SHIELD bubble if active
      if (shieldActiveRef.current) {
        ctx.strokeStyle = "#38bdf8";
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, player.width * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
        // glow filling
        ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
        ctx.fill();
      }

      ctx.restore();

      // ---------------------------------------------
      // SHARKS ENGINE AND RENDER 🦈
      // ---------------------------------------------
      sharks.forEach((s) => {
        s.x += s.vx;
        // Swim with a slight smooth wave motion
        s.y += Math.sin(time * 0.05 + s.timeOffset) * 0.35;

        // Draw Shark
        ctx.save();
        ctx.translate(s.x + s.width / 2, s.y + s.height / 2);
        // Face left, so flip scale horizontally
        ctx.scale(-1, 1);
        const tailWag = Math.sin(time * 0.16 + s.timeOffset) * 0.35;

        ctx.fillStyle = "#4b5563"; // Deep ocean gray
        ctx.beginPath();
        ctx.moveTo(s.width * 0.4, 0); // nose
        ctx.quadraticCurveTo(0, -s.height * 0.45, -s.width * 0.3, 0); // body top
        ctx.lineTo(-s.width * 0.45 + Math.sin(tailWag) * 5, -s.height * 0.35); // top tail
        ctx.lineTo(-s.width * 0.4 + Math.sin(tailWag) * 3, 0); // inner tail
        ctx.lineTo(-s.width * 0.45 + Math.sin(tailWag) * 5, s.height * 0.35); // bottom tail
        ctx.quadraticCurveTo(0, s.height * 0.45, s.width * 0.4, 0); // bottom hull
        ctx.closePath();
        ctx.fill();

        // Dorsal fin 🦈
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.quadraticCurveTo(-14, -22, -2, -20);
        ctx.lineTo(3, -5);
        ctx.closePath();
        ctx.fill();

        // Gills
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, -4); ctx.lineTo(10, 4);
        ctx.moveTo(14, -3); ctx.lineTo(14, 3);
        ctx.stroke();

        // Bloodthirsty red eye
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(s.width * 0.25, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Teeth
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(s.width * 0.22, 2);
        ctx.lineTo(s.width * 0.25, 4);
        ctx.lineTo(s.width * 0.18, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Show Health Bar if took hit
        if (s.hp < s.maxHp) {
          const barW = s.width * 0.7;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(s.x + s.width / 2 - barW / 2, s.y - 12, barW, 4.5);
          ctx.fillStyle = "#f43f5e"; // glowing red HP crimson
          ctx.fillRect(s.x + s.width / 2 - barW / 2, s.y - 12, barW * (s.hp / s.maxHp), 4.5);
        }

        // Collision checking with player
        const dx = (player.x + player.width / 2) - (s.x + s.width / 2);
        const dy = (player.y + player.height / 2) - (s.y + s.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.width * 0.45 + s.width * 0.4) {
          if (shieldActiveRef.current) {
            // bounce away harmlessly
            s.x += 120;
            spawnExplosion(s.x, s.y, "#38bdf8", 0.6);
          } else {
            // Bite player!
            hp = Math.max(0, hp - 20);
            setPlayerHp(hp);
            synth.playExplosion("small");
            spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, "#dc2626", 1.5, "star");
            s.x += 120; // bounce off to avoid infinite ticking

            if (hp <= 0) {
              synth.playExplosion("boss");
              isRunning = false;
              onGameFinished("gameover", gameScore, earnedCoinsCount);
            }
          }
        }
      });

      // Maintain active sharks list
      sharks = sharks.filter((s) => s.x > -80);

      // ---------------------------------------------
      // PARACHUTE AIR-DROPS ENGINE 🪂
      // ---------------------------------------------
      airdrops.forEach((ad) => {
        if (ad.state === "falling") {
          ad.y += ad.vy;
          // check if reaches water dynamic height
          const waveHeight = getWaterHeightAt(ad.x + ad.width / 2, time);
          if (ad.y + ad.height >= waveHeight) {
            ad.y = waveHeight - ad.height + 2;
            ad.state = "floating";
            // trigger splash sound
            synth.playExplosion("small");
            spawnExplosion(ad.x + ad.width / 2, waveHeight, "#e2e8f0", 0.8, "bubble");
          }
        } else {
          // Keep floating precisely on dynamic wave height!
          ad.y = getWaterHeightAt(ad.x + ad.width / 2, time) - ad.height + 2;
          ad.floatTimer--;

          // Dissipates with fizz foam after 5 seconds!
          if (ad.floatTimer <= 0) {
            ad.y = 99999; // triggers deletion
            spawnExplosion(ad.x + ad.width / 2, ad.y, "#94a3b8", 1.0, "bubble");
          }
        }

        // Draw Airdrop vector graphics on Canvas
        ctx.save();
        ctx.translate(ad.x + ad.width / 2, ad.y + ad.height / 2);

        // Draw parachute if falling
        if (ad.state === "falling") {
          ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -ad.height * 0.4);
          ctx.lineTo(-24, -36);
          ctx.moveTo(0, -ad.height * 0.4);
          ctx.lineTo(24, -36);
          ctx.moveTo(0, -ad.height * 0.4);
          ctx.lineTo(0, -36);
          ctx.stroke();

          // Canopy stripes (white & neon red)
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(0, -36, 26, Math.PI, 0, false);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(0, -36, 18, Math.PI, 0, false);
          ctx.closePath();
          ctx.fill();
        }

        // Draw Crate box 📦
        let boxColor = "#ea580c"; // default orange
        if (ad.type === "heal") { boxColor = "#10b981"; }
        else if (ad.type === "shield") { boxColor = "#06b6d4"; }
        else if (ad.type === "triple") { boxColor = "#eab308"; }
        else if (ad.type === "magnet") { boxColor = "#a855f7"; }
        else if (ad.type === "coin") { boxColor = "#fbbf24"; }

        ctx.fillStyle = boxColor;
        ctx.fillRect(-14, -14, 28, 28);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-14, -14, 28, 28);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        ctx.stroke();

        ctx.restore();

        // Draw floating digital countdown timer above floating crate (5.0s max)
        if (ad.state === "floating") {
          const secondsLeft = (ad.floatTimer / 60).toFixed(1);
          ctx.fillStyle = "#facc15";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`🪂 БУСТ ${secondsLeft}с`, ad.x + ad.width / 2, ad.y - 12);
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("🪂 АЭРДРОП", ad.x + ad.width / 2, ad.y - 12);
        }

        // Collision checking with player
        const dx = (player.x + player.width / 2) - (ad.x + ad.width / 2);
        const dy = (player.y + player.height / 2) - (ad.y + ad.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.width * 0.62) {
          ad.y = 99999; // triggers deletion
          synth.playPowerup();

          if (ad.type === "heal") {
            hp = Math.min(maxHp, hp + Math.round(maxHp * 0.35));
            setPlayerHp(hp);
            spawnExplosion(ad.x + ad.width / 2, ad.y + ad.height / 2, "#10b981", 1.8, "star");
          } 
          else if (ad.type === "shield") {
            activeShieldDuration = 480; // 8 seconds of shield
            shieldActiveRef.current = true;
            spawnExplosion(ad.x + ad.width / 2, ad.y + ad.height / 2, "#06b6d4", 1.8, "circle");
          } 
          else if (ad.type === "triple") {
            tripleShotMultiplier = 600; // 10 seconds of hyper double/triple fire
            spawnExplosion(ad.x + ad.width / 2, ad.y + ad.height / 2, "#eab308", 1.8, "star");
          } 
          else if (ad.type === "magnet") {
            magnetDuration = 720; // 12 seconds magnet
            spawnExplosion(ad.x + ad.width / 2, ad.y + ad.height / 2, "#a855f7", 1.8, "bubble");
          } 
          else if (ad.type === "coin") {
            earnedCoinsCount += 50;
            onCoinsEarned(50);
            setCoinsInMatch(earnedCoinsCount);
            spawnExplosion(ad.x + ad.width / 2, ad.y + ad.height / 2, "#fbbf24", 2.2, "star");
          }
        }
      });

      // Filter out collected airdrops
      airdrops = airdrops.filter((ad) => ad.y < 500);

      // ---------------------------------------------
      // POWER-UPS AND MAGNETS
      // ---------------------------------------------
      powerUps.forEach((pup) => {
        // Fall slowly down or swim up depending on location
        pup.y += pup.vy;

        // Magnet attraction simulation
        if (magnetDuration > 0 || selectedSkinId.includes("gold") || selectedSkinId.includes("ufo")) {
          const dx = player.x + player.width / 2 - pup.x;
          const dy = player.y + player.height / 2 - pup.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pullRange = selectedSkinId.includes("gold") ? 200 : 130;

          if (dist < pullRange) {
            pup.x += (dx / dist) * 4.8;
            pup.y += (dy / dist) * 4.8;
          }
        }

        // Check collision with player
        const dx = (player.x + player.width / 2) - pup.x;
        const dy = (player.y + player.height / 2) - pup.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.width * 0.65) {
          pup.y = 99999; // triggers deletion below

          if (pup.type === "heal") {
            synth.playPowerup();
            hp = Math.min(maxHp, hp + Math.round(maxHp * 0.25));
            setPlayerHp(hp);
            spawnExplosion(pup.x, pup.y, "#10b981", 1.5, "star");
          } else if (pup.type === "shield") {
            synth.playPowerup();
            activeShieldDuration = 240; // 4 seconds shield
            shieldActiveRef.current = true;
            spawnExplosion(pup.x, pup.y, "#38bdf8", 1.5, "circle");
          } else if (pup.type === "triple") {
            synth.playPowerup();
            tripleShotMultiplier = 350; // 5.8s triple mode
            spawnExplosion(pup.x, pup.y, "#f43f5e", 1.5, "star");
          } else if (pup.type === "magnet") {
            synth.playPowerup();
            magnetDuration = 450; // 7.5 seconds magnet
            spawnExplosion(pup.x, pup.y, "#eab308", 1.5, "circle");
          } else if (pup.type === "coin") {
            synth.playCoin();
            let gain = 10;
            if (selectedSkinId.includes("golden") || selectedSkinId === "ship_golden") {
              gain = Math.round(gain * 1.5);
            }
            earnedCoinsCount += gain;
            onCoinsEarned(gain);
            setCoinsInMatch(earnedCoinsCount);
            spawnExplosion(pup.x, pup.y, "#fbbf24", 1.2, "star");
          }
        }

        // Draw the PowerUp
        ctx.beginPath();
        ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);

        let pColor = "#eab308";
        let label = "🪙";
        if (pup.type === "heal") { pColor = "#10b981"; label = "❤️"; }
        else if (pup.type === "shield") { pColor = "#3b82f6"; label = "🛡️"; }
        else if (pup.type === "triple") { pColor = "#ef4444"; label = "🔫"; }
        else if (pup.type === "magnet") { pColor = "#a855f7"; label = "🧲"; }

        ctx.fillStyle = pColor;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // draw label emojis slightly offset
        ctx.fillStyle = "#ffffff";
        ctx.font = "11px sans-serif";
        ctx.fillText(label, pup.x - 6, pup.y + 4);
      });

      // Filter out clean up collected powerups
      powerUps = powerUps.filter((pup) => pup.y < canvas.height + 20 && pup.y > -20);

      // Randomly drop power-ups occasionally
      if (time % 450 === 0 && powerUps.length < 3) {
        const pTypes: PowerUp["type"][] = ["heal", "shield", "triple", "magnet"];
        const chosenType = pTypes[Math.floor(Math.random() * pTypes.length)];
        powerUps.push({
          id: Math.random().toString(),
          x: 100 + Math.random() * (canvas.width - 200),
          y: -10,
          type: chosenType,
          radius: 12,
          vy: 1.2
        });
      }

      // ---------------------------------------------
      // PROJECTILES MANAGEMENT
      // ---------------------------------------------
      projectiles.forEach((p) => {
        // Apply gravity if projectile is subject to it (like air-dropped bombs or heavy shell ball)
        if (p.g) {
          p.vy += p.g;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Underwater visual trail for torpedoes (bubble streams)
        if (p.type === "torpedo" && time % 3 === 0) {
          spawnBubbles(p.x - p.vx * 1.5, p.y + (Math.random() - 0.5) * 5, 1);
        }

        // Sky smoke trails for bombs/missiles
        if ((p.type === "missile" || p.type === "bomb") && time % 4 === 0) {
          spawnVaporTrail(p.x, p.y, "rgba(224, 242, 254, 0.25)");
        }

        // Render bullet / rocket vector art
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Collision checking against player (only when projectile belongs to enemy/boss)
        if (p.owner !== "player") {
          const dx = p.x - (player.x + player.width / 2);
          const dy = p.y - (player.y + player.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < player.width * 0.45 + p.radius) {
            p.x = -9999; // trigger despawn

            if (shieldActiveRef.current) {
              // Shield absorbed completely!
              synth.playExplosion("small");
              spawnExplosion(p.x, p.y, "#38bdf8", 0.6);
            } else {
              // Player takes direct hit
              hp = Math.max(0, hp - p.damage);
              setPlayerHp(hp);
              synth.playExplosion("small");
              spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, "#f43f5e", 1.2);

              // Check gameover
              if (hp <= 0) {
                synth.playExplosion("boss");
                isRunning = false;
                onGameFinished("gameover", gameScore, earnedCoinsCount);
              }
            }
          }
        } 
        // Projectile belongs to player - collisions checkers against enemies
        else {
          enemies.forEach((enemy) => {
            const ex = enemy.x + enemy.width / 2;
            const ey = enemy.y + enemy.height / 2;
            const dX = p.x - ex;
            const dY = p.y - ey;
            const dist = Math.sqrt(dX * dX + dY * dY);

            // Hit enemy
            if (dist < enemy.width * 0.55 + p.radius) {
              p.x = 99999; // mark bullet collected
              enemy.hp -= p.damage;

              // spawn damage feedback splash
              spawnExplosion(p.x, p.y, p.color, 0.5);

              // Check enemy death
              if (enemy.hp <= 0) {
                enemy.x = -99999; // mark dead
                gameScore += enemy.points;
                setScore(gameScore);

                // sound synth explosion
                synth.playExplosion("small");
                spawnExplosion(ex, ey, enemy.subType === "air" ? "#cbd5e1" : enemy.subType === "underwater" ? "#38bdf8" : "#f59e0b", 1.1);

                // Coin reward
                const dropGains = enemy.coinsReward;
                earnedCoinsCount += dropGains;
                onCoinsEarned(dropGains);
                setCoinsInMatch(earnedCoinsCount);

                // Spawn a visual floating physical gold coin
                powerUps.push({
                  id: Math.random().toString(),
                  x: ex,
                  y: ey,
                  type: "coin",
                  radius: 7,
                  vy: 0.8
                });
              }
            }
          });

          // Check collision with Sharks 🦈
          sharks.forEach((s) => {
            const sx = s.x + s.width / 2;
            const sy = s.y + s.height / 2;
            const dX = p.x - sx;
            const dY = p.y - sy;
            const dist = Math.sqrt(dX * dX + dY * dY);

            if (dist < s.width * 0.5 + p.radius) {
              p.x = 99999; // absorb bullet
              s.hp -= p.damage;
              spawnExplosion(p.x, p.y, p.color, 0.4);

              if (s.hp <= 0) {
                s.x = -99999; // trigger despawn
                gameScore += s.points;
                setScore(gameScore);

                synth.playExplosion("small");
                // crimson blood-bubble splash
                spawnExplosion(sx, sy, "#f43f5e", 1.4, "bubble");

                // Drop multiple jumping coins: "из них тоже выпадут монеты та же как из боссов"
                const coinSplashCount = 4 + Math.floor(Math.random() * 4); // 4 to 7 coins
                earnedCoinsCount += coinSplashCount;
                onCoinsEarned(coinSplashCount);
                setCoinsInMatch(earnedCoinsCount);

                for (let c = 0; c < coinSplashCount; c++) {
                  powerUps.push({
                    id: Math.random().toString(),
                    x: sx + (Math.random() - 0.5) * 16,
                    y: sy + (Math.random() - 0.5) * 16,
                    type: "coin",
                    radius: 7,
                    vy: -1.5 - Math.random() * 2 // pop upwards!
                  });
                }
              }
            }
          });

          // Check hit against active Boss
          if (bossInstance) {
            const bx = bossInstance.x + bossInstance.width / 2;
            const by = bossInstance.y + bossInstance.height / 2;
            const dX = p.x - bx;
            const dY = p.y - by;
            const dist = Math.sqrt(dX * dX + dY * dY);

            if (dist < bossInstance.width * 0.5 + p.radius) {
              p.x = 99999; // delete bullet
              bossInstance.hp = Math.max(0, bossInstance.hp - p.damage);
              setActiveBossHp(bossInstance.hp);

              // Flash damage text or sparkles
              spawnExplosion(p.x, p.y, "#fb7185", 0.6);

              if (bossInstance.hp <= 0) {
                // VICTORY! Boss destroyed
                synth.playExplosion("boss");
                spawnExplosion(bx, by, "#f43f5e", 4.5, "star");

                // Spawns tons of victory coins!
                const bReward = targetBossConfig ? targetBossConfig.rewardCoins : 300;
                earnedCoinsCount += bReward;
                onCoinsEarned(bReward);
                setCoinsInMatch(earnedCoinsCount);

                // trigger callback to save achievements
                onBossDefeated(bossInstance.id);

                isRunning = false;
                onGameFinished("victory", gameScore + 1000, earnedCoinsCount);
              }
            }
          }
        }
      });

      // Clear outside projectiles
      projectiles = projectiles.filter((p) => p.x > -50 && p.x < canvas.width + 50 && p.y > -50 && p.y < canvas.height + 50);

      // ---------------------------------------------
      // ENEMIES CYCLE
      // ---------------------------------------------
      enemies.forEach((enemy) => {
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Custom wavy water tracking for surface boat enemies
        if (enemy.subType === "water") {
          enemy.y = getWaterHeightAt(enemy.x + enemy.width / 2, time) - enemy.height + 4;
        }

        // Draw standard enemy vector bodies
        ctx.save();
        ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);

        if (enemy.subType === "air") {
          // Drone / bomber
          ctx.fillStyle = enemy.type === "kamikaze" ? "#ef4444" : "#475569";
          ctx.beginPath();
          ctx.ellipse(0, 0, enemy.width * 0.4, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          // wings
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(-6, -18, 5, 36);
        } else if (enemy.subType === "underwater") {
          // Sea mine
          if (enemy.type === "mine") {
            ctx.fillStyle = "#1e293b";
            ctx.beginPath();
            ctx.arc(0, 0, enemy.width * 0.45, 0, Math.PI * 2);
            ctx.fill();
            // spikes on mine
            ctx.strokeStyle = "#94a3b8";
            ctx.lineWidth = 1.8;
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle)*6, Math.sin(angle)*6);
              ctx.lineTo(Math.cos(angle)*15, Math.sin(angle)*15);
              ctx.stroke();
            }
          } else {
            // sub scouts
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.ellipse(0, 0, enemy.width * 0.45, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(-2, -13, 6, 8); // hatch tower
          }
        } else {
          // surface ships
          ctx.fillStyle = "#334155";
          ctx.beginPath();
          ctx.moveTo(-enemy.width/2, -4);
          ctx.lineTo(enemy.width/2 - 8, -4);
          ctx.quadraticCurveTo(enemy.width/2, -4, enemy.width/2, 6);
          ctx.lineTo(-enemy.width/2, 6);
          ctx.closePath();
          ctx.fill();
          // superstructure deck
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(-10, -10, 16, 7);
        }

        // Draw Health Bar above strong enemies
        if (enemy.hp < enemy.maxHp) {
          const barW = enemy.width * 0.75;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(-barW/2, -enemy.height/2 - 6, barW, 4);
          ctx.fillStyle = "#10b981";
          ctx.fillRect(-barW/2, -enemy.height/2 - 6, barW * (enemy.hp / enemy.maxHp), 4);
        }

        ctx.restore();

        // Enemy shooting routines
        if (enemy.shootCooldown > 0) {
          enemy.shootCooldown--;
        } else if (enemy.type !== "mine") {
          enemy.shootCooldown = enemy.shootInterval / 16.6; // reset

          // Shoot at player
          const dx = (player.x + player.width/2) - (enemy.x + enemy.width/2);
          const dy = (player.y + player.height/2) - (enemy.y + enemy.height/2);
          const dist = Math.sqrt(dx * dx + dy * dy);

          const bulletSpeed = enemy.subType === "air" ? 4.2 : 2.5;

          projectiles.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y + enemy.height / 2,
            vx: (dx / dist) * bulletSpeed,
            vy: (dy / dist) * bulletSpeed,
            radius: enemy.subType === "underwater" ? 6 : 4.5,
            color: enemy.subType === "underwater" ? "#38bdf8" : "#f59e0b",
            owner: "enemy",
            damage: enemy.subType === "underwater" ? 15 : 10,
            type: enemy.subType === "underwater" ? "torpedo" : "bullet"
          });
        }

        // Heavy mine collision
        if (enemy.type === "mine") {
          const dX = (player.x + player.width/2) - (enemy.x + enemy.width/2);
          const dY = (player.y + player.height/2) - (enemy.y + enemy.height/2);
          const dist = Math.sqrt(dX * dX + dY * dY);

          if (dist < player.width * 0.5 + enemy.width * 0.45) {
            enemy.hp = -100; // triggers deletion and explosion
            hp = Math.max(0, hp - 30);
            setPlayerHp(hp);
            synth.playExplosion("large");
            spawnExplosion(enemy.x, enemy.y, "#ef4444", 1.8);
          }
        }
      });

      // Filter out dead/off-screen enemies
      enemies = enemies.filter((e) => e.x > -80 && e.x < canvas.width + 120);

      // ---------------------------------------------
      // LEGENDARY BOSS BEHAVIOR
      // ---------------------------------------------
      if (bossInstance) {
        // Boss Entrance scrolling
        if (bossInstance.x > canvas.width - 240) {
          bossInstance.x += bossInstance.vx;
        }

        bossInstance.attackPatternTimer++;

        // Render Boss based on type
        ctx.save();
        ctx.translate(bossInstance.x + bossInstance.width / 2, bossInstance.y + bossInstance.height / 2);

        const currentBossId = bossInstance.id;

        if (currentBossId === "boss_kraken") {
          // DRAW GIANT KRAKEN SQUID
          ctx.fillStyle = "#831843"; // Deep magenta purple tentacle color
          ctx.beginPath();
          ctx.arc(0, 0, 48, 0, Math.PI, true); // Head dome
          ctx.lineTo(-48, 25);
          ctx.quadraticCurveTo(0, 45, 48, 25);
          ctx.closePath();
          ctx.fill();

          // Angry glowing orange glowing kraken eyes
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.arc(-16, -10, 8, 0, Math.PI * 2);
          ctx.arc(16, -10, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(-14, -8, 2.5, 0, Math.PI * 2);
          ctx.arc(18, -8, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Moving tentacles below
          ctx.strokeStyle = "#831843";
          ctx.lineWidth = 14;
          ctx.lineCap = "round";
          for (let i = 0; i < 5; i++) {
            const swing = Math.sin(time * 0.04 + i) * 22;
            ctx.beginPath();
            ctx.moveTo(-36 + i * 18, 20);
            ctx.quadraticCurveTo(-36 + i * 18 + swing * 0.5, 45, -36 + (i * 18) + swing, 80);
            ctx.stroke();
          }

          // Shoots continuous spiral bubbly ink blobs
          if (bossInstance.attackPatternTimer % 80 === 0) {
            synth.playShoot("submarine");
            for (let spinAngle = 0; spinAngle < Math.PI * 2; spinAngle += Math.PI / 4) {
              projectiles.push({
                id: Math.random().toString(),
                x: bossInstance.x + bossInstance.width / 2,
                y: bossInstance.y + bossInstance.height / 2,
                vx: Math.cos(spinAngle + time * 0.02) * 2.8,
                vy: Math.sin(spinAngle + time * 0.02) * 2.8,
                radius: 10,
                color: "#7e22ce", // Purple Ink
                owner: "boss",
                damage: 25,
                type: "bullet"
              });
            }
          }
        } 
        else if (currentBossId === "boss_megalodon") {
          // DRAW MONSTER SHARK
          ctx.fillStyle = "#1e3a8a"; // Shark oceanic blue
          ctx.beginPath();
          ctx.ellipse(0, 0, 72, 32, 0, 0, Math.PI * 2);
          ctx.fill();

          // Big dorsal fin
          ctx.beginPath();
          ctx.moveTo(-10, -28);
          ctx.lineTo(-32, -55);
          ctx.lineTo(15, -20);
          ctx.closePath();
          ctx.fill();

          // Pectoral fins
          ctx.beginPath();
          ctx.moveTo(10, 16);
          ctx.lineTo(0, 48);
          ctx.lineTo(-20, 20);
          ctx.closePath();
          ctx.fill();

          // Spooky white jaw teeth pointing forward
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(40, 10);
          ctx.lineTo(60, 18);
          ctx.lineTo(44, 2);
          ctx.lineTo(58, -12);
          ctx.lineTo(36, -8);
          ctx.closePath();
          ctx.fill();

          // Predator eye
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(38, -12, 4, 0, Math.PI*2);
          ctx.fill();

          // Megalodon behavior: charges at player's height periodically!
          if (time % 200 === 0) {
            // Initiate dash towards player
            bossInstance.vx = -9.2; // surge forward!
            synth.playAlarm();
          } else if (bossInstance.vx < -1.0) {
            // recover speed gradually
            bossInstance.vx += 0.16;
          }

          // Shoots sonar circles
          if (time % 90 === 0) {
            for (let i = 0; i < 4; i++) {
              projectiles.push({
                id: Math.random().toString(),
                x: bossInstance.x,
                y: bossInstance.y + bossInstance.height / 2,
                vx: -4.0 + (i * 0.5),
                vy: (i - 1.5) * 1.5,
                radius: 8,
                color: "#db2777",
                owner: "boss",
                damage: 20,
                type: "bullet"
              });
            }
          }
        } 
        else if (currentBossId === "boss_zeppelin") {
          // DRAW IRON ZEPPELIN
          ctx.fillStyle = "#3f3f46"; // Heavy mechanical steel
          ctx.beginPath();
          ctx.ellipse(0, -10, 75, 42, 0, 0, Math.PI * 2);
          ctx.fill();

          // Riveted sheet metal line decals
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Gondola cabin below
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(-45, 20, 95, 18);
          ctx.fillStyle = "#fbbf24"; // bright glowing cabin windows
          ctx.fillRect(-35, 24, 75, 5);

          // Rear stabilizing wings and black smoke particles
          ctx.fillStyle = "#b91c1c";
          ctx.fillRect(-92, -18, 18, 14);

          if (time % 6 === 0) {
            particles.push({
              x: bossInstance.x,
              y: bossInstance.y + bossInstance.height / 2 - 20,
              vx: -1.2,
              vy: -0.8 + Math.random() * 0.2,
              color: "rgba(115, 115, 115, 0.45)",
              size: 5 + Math.random() * 9,
              alpha: 0.8,
              decay: 0.015,
              shape: "circle"
            });
          }

          // Attacks: Carpet bombs + heavy rockets
          if (time % 110 === 0) {
            synth.playExplosion("large");
            for (let i = 0; i < 6; i++) {
              projectiles.push({
                id: Math.random().toString(),
                x: bossInstance.x + (i * 30),
                y: bossInstance.y + bossInstance.height,
                vx: -1.5,
                vy: 3.5,
                radius: 9,
                color: "#f97316",
                owner: "boss",
                damage: 25,
                type: "bomb",
                g: 0.12
              });
            }
          }
        } 
        else if (currentBossId === "boss_storm_eagle") {
          // DRAW HYPERTECH ROBOTIC JET
          ctx.fillStyle = "#1e1b4b"; // Dark blue-violet
          ctx.beginPath();
          ctx.moveTo(-60, 0);
          ctx.lineTo(-40, -15);
          ctx.lineTo(40, -5);
          ctx.lineTo(65, 0); // sharp nose
          ctx.lineTo(40, 5);
          ctx.lineTo(-40, 15);
          ctx.closePath();
          ctx.fill();

          // Giant delta sweeping laser wing blades
          ctx.fillStyle = "#e11d48"; // Rose pink laser energy wings
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#f43f5e";
          ctx.beginPath();
          ctx.moveTo(-15, -10);
          ctx.lineTo(-48, -55); // wing tip
          ctx.lineTo(15, -5);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-15, 10);
          ctx.lineTo(-48, 55); // bottom wing tip
          ctx.lineTo(15, 5);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;

          // Storm Eagle moves rapidly up and down tracking player
          const diffY = (player.y - bossInstance.y);
          bossInstance.y += Math.sign(diffY) * 1.8;

          // Lightning bolt homing attacks
          if (time % 100 === 0) {
            synth.playAlarm();
            projectiles.push({
              id: Math.random().toString(),
              x: bossInstance.x,
              y: bossInstance.y + 40,
              vx: -6.5,
              vy: Math.sign(diffY) * 2.2,
              radius: 6,
              color: "#facc15", // Electric yellow
              owner: "boss",
              damage: 30,
              type: "missile"
            });
          }
        }

        ctx.restore();
      }

      // ---------------------------------------------
      // PARTICLES ENGINE
      // ---------------------------------------------
      particles.forEach((part) => {
        if (part.gravity) part.vy += part.gravity;
        part.x += part.vx;
        part.y += part.vy;
        part.alpha -= part.decay;

        if (part.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = part.alpha;
          ctx.fillStyle = part.color;

          if (part.shape === "bubble") {
            ctx.beginPath();
            ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(224, 242, 254, 0.45)";
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (part.shape === "square") {
            ctx.fillRect(part.x - part.size/2, part.y - part.size/2, part.size, part.size);
          } else if (part.shape === "star") {
            ctx.beginPath();
            ctx.moveTo(part.x, part.y - part.size);
            ctx.lineTo(part.x + part.size * 0.4, part.y - part.size * 0.4);
            ctx.lineTo(part.x + part.size, part.y);
            ctx.lineTo(part.x + part.size * 0.4, part.y + part.size * 0.4);
            ctx.lineTo(part.x, part.y + part.size);
            ctx.lineTo(part.x - part.size * 0.4, part.y + part.size * 0.4);
            ctx.lineTo(part.x - part.size, part.y);
            ctx.lineTo(part.x - part.size * 0.4, part.y - part.size * 0.4);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      });

      // Filter out faded particles
      particles = particles.filter((part) => part.alpha > 0 && part.y < canvas.height + 20);

      // ---------------------------------------------
      // WATER WAVES SURFACE RENDER (TOP LAYER OF WATER)
      // ---------------------------------------------
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, getWaterHeightAt(0, time));

      // Draw continuous responsive curve from node to node
      for (let x = 1; x <= canvas.width + 10; x += 12) {
        ctx.lineTo(x, getWaterHeightAt(x, time));
      }

      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();

      // Translucent ocean blue gradient
      const waterGrad = ctx.createLinearGradient(0, waterBaseY - 20, 0, canvas.height);
      waterGrad.addColorStop(0, "rgba(14, 116, 144, 0.77)"); // bright teal cyan
      waterGrad.addColorStop(0.3, "rgba(8, 51, 68, 0.95)"); // deep ocean blue
      waterGrad.addColorStop(1, "#020617"); // midnight black seabed
      ctx.fillStyle = waterGrad;
      ctx.fill();

      // Highlight line on the water surface (foam edge)
      ctx.beginPath();
      ctx.moveTo(0, getWaterHeightAt(0, time));
      for (let x = 1; x <= canvas.width + 10; x += 12) {
        ctx.lineTo(x, getWaterHeightAt(x, time));
      }
      ctx.strokeStyle = "rgba(56, 189, 248, 0.9)"; // luminous sky foam
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Trigger animation frame reload
      animationFrameId = requestAnimationFrame(loop);
    };

    // Begin looping
    loop();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentVehicle, selectedSkinId, gameMode]);

  // Click handler to shoot for touchscreens
  const updateAimTarget = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Map client coordinates precisely to matching 920 x 460 canvas dimensions
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    aimTargetRef.current = { x, y };
  };

  const startFiring = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isMouseDownRef.current = true;
    updateAimTarget(e);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isMouseDownRef.current) {
      updateAimTarget(e);
    }
  };

  const stopFiring = () => {
    isMouseDownRef.current = false;
    aimTargetRef.current = null;
  };

  return (
    <div 
      id="game-arena-wrapper" 
      ref={containerRef} 
      className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden relative select-none bg-[#05070a]"
    >
      {/* HUD Info Top Header - inline row for zero height overflow */}
      <div className="h-11 bg-[#090b11] border-b border-slate-900/60 px-3 flex items-center justify-between shrink-0 select-none z-40">
        
        {/* Left Side: Health bar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-900 px-2 py-1 rounded-lg">
            <span className="text-xs">❤️</span>
            <div className="w-24 sm:w-36 h-3 bg-slate-800 rounded-full overflow-hidden relative border border-slate-900">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-100"
                style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-black text-white font-mono drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                {playerHp}/{playerMaxHp}
              </span>
            </div>
          </div>

          {/* Core Weapon Active */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-slate-900/40 text-[9px] text-cyan-400 font-mono font-bold">
            ⚔️ {currentVehicle === "ship" ? "Ракеты" : currentVehicle === "submarine" ? "Торпеды" : "Пулемет"}
          </div>
        </div>

        {/* Center: Realtime Stats indicators */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-900">
            <span className="text-yellow-500 font-bold">🪙</span>
            <span className="font-extrabold text-[#f59e0b]">{coinsInMatch}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-900">
            <span className="text-blue-400 font-bold">⭐ SCO:</span>
            <span className="font-extrabold text-white">{score}</span>
          </div>
        </div>

        {/* Right Side: Sound settings & Early exit button */}
        <div className="flex items-center gap-2">
          {/* Audio controller */}
          <button 
            onClick={() => setMuted(!muted)}
            className="w-7 h-7 bg-slate-950 hover:bg-slate-900 text-slate-300 p-1.5 rounded-lg border border-slate-900 flex items-center justify-center cursor-pointer shadow-md"
            title={muted ? "Включить звук" : "Выключить звук"}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* EARLY EXIT TO MAIN MENU */}
          <button
            onClick={() => {
              if (window.confirm("Вернуться в док-гавань? Текущие очки и монетки сохранятся!")) {
                onGameFinished("gameover", score, coinsInMatch);
              }
            }}
            className="h-7 px-2.5 bg-rose-950/30 border border-rose-800/50 hover:bg-rose-900/40 text-rose-300 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1"
          >
            🚪 В ВЕРФЬ
          </button>
        </div>
      </div>

      {/* TUTORIAL HELP DISPLAY - overlay */}
      {showTutorial && (
        <div className="absolute top-13 left-2 bg-slate-950/95 border border-slate-900 p-2.5 rounded-xl max-w-xs pointer-events-auto backdrop-blur-md z-40 text-[10px] shadow-2xl">
          <div className="flex items-center justify-between mb-1 font-bold text-blue-400">
            <span className="flex items-center gap-1">📋 КНОПКИ КЛАВИАТУРЫ:</span>
            <button onClick={() => setShowTutorial(false)} className="text-slate-500 hover:text-slate-300 px-1 font-bold">×</button>
          </div>
          <ul className="text-slate-300 list-inside space-y-0.5 text-[9.5px]">
            <li><span className="text-white font-mono">← A / D →</span> — ход взад-вперед</li>
            <li><span className="text-white font-mono">↑ W / Space</span> — {currentVehicle === "ship" ? "Прыжок" : "Ввысь"}</li>
            <li><span className="text-white font-mono">↓ S</span> — {currentVehicle === "submarine" ? "Погружение" : "Сброс бомб"}</li>
            <li><span className="text-white font-mono">Держите мышь кликнутой</span> — автоогонь в курсор</li>
            <li><span className="text-white font-mono">Клавиша E</span> — СУПЕРСПОСОБНОСТЬ</li>
          </ul>
        </div>
      )}

      {/* PORTABLE CONSOLE GAMEPLAY FRAME GRID */}
      <div className="flex-1 w-full flex flex-row items-stretch min-h-0 p-1.5 gap-2.5 overflow-hidden select-none relative">
        
        {/* A. LEFT PORTION: ERGONOMIC D-PAD MODULE */}
        <div id="dpad-module" className="w-[110px] shrink-0 flex flex-col justify-between items-center bg-[#070a0f] border border-slate-900 p-2 rounded-2xl shadow-xl">
          <div className="text-center">
            <span className="text-[7.5px] text-slate-500 uppercase tracking-widest font-black font-mono">🕹️ ДВИЖЕНИЕ</span>
          </div>

          <div className="grid grid-cols-3 gap-1 w-full flex-1 max-h-[140px] items-center mt-1">
            <div />
            {/* UP button */}
            <button
              onMouseDown={() => { keysRef.current["KeyW"] = true; }}
              onMouseUp={() => { keysRef.current["KeyW"] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keysRef.current["KeyW"] = true; }}
              onTouchEnd={() => { keysRef.current["KeyW"] = false; }}
              className="bg-slate-900 border border-slate-800 active:bg-blue-600 active:border-blue-500 text-white rounded-lg h-9 flex items-center justify-center transition-all cursor-pointer shadow-md select-none touch-none text-xs"
              title="Вверх / Прыжок"
            >
              ▲
            </button>
            <div />

            {/* LEFT button */}
            <button
              onMouseDown={() => { keysRef.current["KeyA"] = true; }}
              onMouseUp={() => { keysRef.current["KeyA"] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keysRef.current["KeyA"] = true; }}
              onTouchEnd={() => { keysRef.current["KeyA"] = false; }}
              className="bg-slate-900 border border-slate-800 active:bg-blue-600 active:border-blue-500 text-white rounded-lg h-9 flex items-center justify-center transition-all cursor-pointer shadow-md select-none touch-none text-xs"
              title="Влево"
            >
              ◀
            </button>
            {/* DOWN button */}
            <button
              onMouseDown={() => { keysRef.current["KeyS"] = true; }}
              onMouseUp={() => { keysRef.current["KeyS"] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keysRef.current["KeyS"] = true; }}
              onTouchEnd={() => { keysRef.current["KeyS"] = false; }}
              className="bg-slate-900 border border-slate-800 active:bg-blue-600 active:border-blue-500 text-white rounded-lg h-9 flex items-center justify-center transition-all cursor-pointer shadow-md select-none touch-none text-xs"
              title="Вниз / Сбросить бомбу"
            >
              ▼
            </button>
            {/* RIGHT button */}
            <button
              onMouseDown={() => { keysRef.current["KeyD"] = true; }}
              onMouseUp={() => { keysRef.current["KeyD"] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keysRef.current["KeyD"] = true; }}
              onTouchEnd={() => { keysRef.current["KeyD"] = false; }}
              className="bg-slate-900 border border-slate-800 active:bg-blue-600 active:border-blue-500 text-white rounded-lg h-9 flex items-center justify-center transition-all cursor-pointer shadow-md select-none touch-none text-xs"
              title="Вправо"
            >
              ▶
            </button>
          </div>

          {/* Quick tips */}
          <div className="text-center pt-1.5 border-t border-slate-900 w-full mt-1">
            <span className="text-[7px] text-slate-400 font-mono block">WASD тоже</span>
            <span className="text-[7px] text-slate-400 font-mono block">работает!</span>
          </div>
        </div>

        {/* B. CENTER PORTION: STRETCH-FIT CANVAS SCREEN */}
        <div className="flex-1 min-h-0 flex items-center justify-center relative bg-[#010204] rounded-2xl border border-slate-900 shadow-2xl overflow-hidden">
          
          <canvas 
            id="naval-battle-canvas"
            ref={canvasRef}
            width={920}
            height={460}
            className="max-h-full max-w-full aspect-[2/1] h-auto w-auto rounded-xl bg-[#030508] block cursor-crosshair transition-all border border-slate-950"
            onMouseDown={startFiring}
            onMouseUp={stopFiring}
            onMouseMove={handlePointerMove}
            onTouchStart={startFiring}
            onTouchEnd={stopFiring}
            onTouchMove={handlePointerMove}
          />

          {/* GIGANTIC BOSS HP PANEL ABSOLUTELY PINNED */}
          {activeBossHp !== null && activeBossMaxHp !== null && (
            <div id="active-boss-hud" className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[85%] z-45 bg-slate-950/95 border border-red-500/40 p-2 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.2)] pointer-events-none">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-black uppercase text-red-400 tracking-wider font-mono">⚠️ БОСС: {activeBossName}</span>
                <span className="text-[9px] text-red-500 font-extrabold font-mono">HP: {activeBossHp} / {activeBossMaxHp}</span>
              </div>
              <div className="w-full h-2 bg-red-950 rounded-full overflow-hidden border border-red-800">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 shadow-[0_0_6px_rgba(244,63,94,0.6)] transition-all duration-75"
                  style={{ width: `${(activeBossHp / activeBossMaxHp) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* C. RIGHT PORTION: ERGONOMIC ATTACK ACTIONS MODULE */}
        <div id="actions-module" className="w-[110px] shrink-0 flex flex-col justify-between items-center bg-[#070a0f] border border-slate-900 p-2 rounded-2xl shadow-xl">
          <div className="text-center">
            <span className="text-[7.5px] text-slate-500 uppercase tracking-widest font-black font-mono">🔥 АТАКА</span>
          </div>

          <div className="flex flex-col gap-2.5 w-full items-center justify-center flex-1 my-1">
            
            {/* TAP & HOLD AUTO-FIRE ACTION */}
            <button
              onTouchStart={(e) => { e.preventDefault(); isMouseDownRef.current = true; }}
              onTouchEnd={() => { isMouseDownRef.current = false; }}
              onMouseDown={() => { isMouseDownRef.current = true; }}
              onMouseUp={() => { isMouseDownRef.current = false; }}
              className="w-16 h-16 rounded-full font-black text-white bg-red-600 border border-red-500 active:bg-red-500 active:scale-95 shadow-lg flex flex-col justify-center items-center touch-none select-none cursor-pointer hover:scale-105 transition-all text-[8.5px]"
              title="Зажать палец для огня по цели"
            >
              <span className="text-lg animate-pulse">🔥</span>
              <span className="font-sans leading-none mt-0.5 font-black uppercase text-[7.5px]">ОГОНЬ</span>
            </button>

            {/* SUPER ABILITY (E) ACTION */}
            <button
              onClick={() => {
                keysRef.current["KeyE"] = true;
                setTimeout(() => { keysRef.current["KeyE"] = false; }, 80);
              }}
              disabled={abilityCooldown > 0}
              className={`w-full py-2.5 px-1 rounded-xl text-[9px] font-black font-mono flex flex-col justify-center items-center border shadow-md transition-all select-none cursor-pointer ${
                abilityCooldown > 0 
                  ? "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed" 
                  : "bg-amber-600 border-amber-500 text-white active:bg-amber-500 hover:scale-[1.01]"
              }`}
              title="Сверх-Способность активной техники (Клавиша E)"
            >
              <Zap className="w-4 h-4 text-yellow-300 fill-current mb-0.5" />
              <span>СУПЕР (E)</span>
              {abilityCooldown > 0 && <span className="text-[7.5px] text-slate-500 mt-0.5">КД {Math.round(abilityCooldown * 100)}%</span>}
            </button>

          </div>

          {/* Auto Guidance note */}
          <div className="text-center pt-1.5 border-t border-slate-900 w-full mt-1">
            <span className="text-[7px] text-slate-400 font-mono block">Клик по воде</span>
            <span className="text-[7px] text-slate-500 font-mono block">стреляет туда!</span>
          </div>
        </div>

      </div>
    </div>
  );
}
