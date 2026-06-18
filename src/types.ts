export type VehicleType = "ship" | "submarine" | "airplane";

export interface Skin {
  id: string;
  name: string;
  description: string;
  price: number; // 0 means unlocked by default or unlocked via boss
  bossUnlockId?: string; // ID of the boss that unlocks this skin
  tint: string; // Tailwind hex color or color names
  particleColor: string;
  maxHpBonus: number;
  damageBonus: number;
  speedBonus: number;
  specialAbility: string;
}

export interface Upgrade {
  id: "hp" | "damage" | "speed";
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  priceScale: number[]; // prices to upgrade per level (e.g., [100, 200, 400, 800, 1500])
}

export interface Boss {
  id: string;
  name: string;
  title: string;
  description: string;
  hp: number;
  maxHp: number;
  rewardCoins: number;
  unlocksSkins: string[]; // skin IDs unlocked on defeat
  difficulty: "Легко" | "Нормально" | "Сложно" | "Легендарно";
  bossType: "water" | "underwater" | "air";
  icon: string; // Emoji representing the boss
  background: string; // Gradient class for UI card
}

export interface PlayerStats {
  coins: number;
  unlockedSkins: string[]; // skin IDs
  selectedSkins: Record<VehicleType, string>;
  upgrades: {
    hp: number;
    damage: number;
    speed: number;
  };
  defeatedBosses: string[]; // boss IDs
  highScore: number;
}

export interface GameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  gravity?: number;
  shape?: "circle" | "square" | "bubble" | "feather" | "star";
  rotation?: number;
  vr?: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  owner: "player" | "enemy" | "boss";
  damage: number;
  type: "bullet" | "missile" | "depth_charge" | "torpedo" | "bomb" | "laser" | "shard" | "frost" | "cursed";
  angle?: number;
  g?: number; // gravity acceleration
  trailTimer?: number;
  target?: { x: number; y: number } | any; // for homing missiles
  life?: number;
}

export interface GameEnemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: "scout_boat" | "cruiser" | "mine" | "dive_bomber" | "kamikaze" | "sub_scout" | "sub_heavy" | "drone";
  subType: "water" | "underwater" | "air";
  shootCooldown: number;
  shootInterval: number;
  points: number;
  coinsReward: number;
  phase?: number;
}

export interface GameBossInstance {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  shootCooldownSec: number;
  attackPatternTimer: number;
  currentPattern: number;
  stateArgs?: any;
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: "heal" | "shield" | "triple" | "magnet" | "coin";
  radius: number;
  vy: number;
}
