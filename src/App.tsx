import React, { useState, useEffect } from "react";
import NavalEngine from "./components/NavalEngine";
import ShopStation from "./components/ShopStation";
import UpgradeStation from "./components/UpgradeStation";
import BossSelector from "./components/BossSelector";
import { PlayerStats, VehicleType } from "./types";
import { SHIPS_SKINS, SUBMARINE_SKINS, AIRPLANE_SKINS, getSkinById, BOSSES } from "./components/GameData";
import { synth } from "./components/SoundSynth";
import { 
  ShieldAlert, Sparkles, Zap, Trophy, Shield, Play, 
  RotateCcw, Info, Volume2, VolumeX, HelpCircle, User, Gamepad2, Compass
} from "lucide-react";

const STATS_STORAGE_KEY = "naval_legends_stats_v3";

const defaultStats: PlayerStats = {
  coins: 100, // Starts with a small bonus of 100 coins to try the upgrade or buy a basic skin!
  unlockedSkins: ["ship_classic", "sub_classic", "plane_classic"],
  selectedSkins: {
    ship: "ship_classic",
    submarine: "sub_classic",
    airplane: "plane_classic"
  },
  upgrades: {
    hp: 1,
    damage: 1,
    speed: 1
  },
  defeatedBosses: [],
  highScore: 0
};

export default function App() {
  const [stats, setStats] = useState<PlayerStats>(defaultStats);
  const [activeTab, setActiveTab] = useState<"patrol" | "bosses" | "shop" | "upgrades">("patrol");

  // Game active execution status
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGameMode, setCurrentGameMode] = useState<"endless" | { type: "boss"; bossId: string }>("endless");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>("ship");

  // Post match reports
  const [matchResult, setMatchResult] = useState<{
    outcome: "victory" | "gameover";
    score: number;
    coinsEarned: number;
    newSkinUnlocked?: string;
  } | null>(null);

  // Load stats from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STATS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure structure alignment
        setStats({
          ...defaultStats,
          ...parsed,
          selectedSkins: {
            ...defaultStats.selectedSkins,
            ...(parsed.selectedSkins || {})
          },
          upgrades: {
            ...defaultStats.upgrades,
            ...(parsed.upgrades || {})
          }
        });
      }
    } catch (e) {
      console.error("Error reading storage keys:", e);
    }
  }, []);

  // Save current stats
  const saveStats = (newStats: PlayerStats) => {
    setStats(newStats);
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(newStats));
    } catch (e) {
      console.error(e);
    }
  };

  // Coins trigger helper
  const handleCoinsEarned = (amount: number) => {
    saveStats({
      ...stats,
      coins: stats.coins + amount
    });
  };

  // Boss defeat flag setter
  const handleBossDefeated = (bossId: string) => {
    const bossConfig = BOSSES.find(b => b.id === bossId);
    if (!bossConfig) return;

    const newlyDefeated = !stats.defeatedBosses.includes(bossId);
    const updatedDefeated = newlyDefeated 
      ? [...stats.defeatedBosses, bossId]
      : stats.defeatedBosses;

    // Conjoin newly unlocked skins based on this boss defeat
    const newlyUnlockedSkins: string[] = [];
    bossConfig.unlocksSkins.forEach((skinId) => {
      if (!stats.unlockedSkins.includes(skinId)) {
        newlyUnlockedSkins.push(skinId);
      }
    });

    const updatedUnlockedSkins = [...stats.unlockedSkins, ...newlyUnlockedSkins];

    saveStats({
      ...stats,
      unlockedSkins: updatedUnlockedSkins,
      defeatedBosses: updatedDefeated
    });

    // Save unlock results to present in HUD summary
    if (newlyUnlockedSkins.length > 0) {
      const skinName = getSkinById(newlyUnlockedSkins[0])?.name || "";
      if (matchResult) {
        setMatchResult({
          ...matchResult,
          newSkinUnlocked: skinName
        });
      } else {
        // Create active wrapper if still not rendered
        setMatchResult({
          outcome: "victory",
          score: 1000,
          coinsEarned: bossConfig.rewardCoins,
          newSkinUnlocked: skinName
        });
      }
    }
  };

  // Skin bought from shop
  const handleSkinPurchased = (skinId: string, updatedCoins: number) => {
    saveStats({
      ...stats,
      coins: updatedCoins,
      unlockedSkins: [...stats.unlockedSkins, skinId]
    });
  };

  // Change selected skin for specific vehicle class
  const handleSkinSelected = (type: VehicleType, skinId: string) => {
    saveStats({
      ...stats,
      selectedSkins: {
        ...stats.selectedSkins,
        [type]: skinId
      }
    });
  };

  // Modify permanent skill levels
  const handleUpgradePurchased = (id: "hp" | "damage" | "speed", newLevel: number, remainingCoins: number) => {
    saveStats({
      ...stats,
      coins: remainingCoins,
      upgrades: {
        ...stats.upgrades,
        [id]: newLevel
      }
    });
  };

  // Reset function to clear and test again
  const handleResetProgress = () => {
    if (window.confirm("Вы уверены, что хотите сбросить весь прогресс, монетки и разблокированные скины?")) {
      saveStats(defaultStats);
      synth.playExplosion("large");
    }
  };

  // Initiate endless wave patrol
  const startPatrolGame = () => {
    synth.playPowerup();
    setIsPlaying(true);
    setCurrentGameMode("endless");
    setMatchResult(null);
  };

  // Engage specific boss fight
  const startBossGame = (bossId: string) => {
    // Set appropriate vehicle recommendation based on Boss location!
    const bossConfig = BOSSES.find(b => b.id === bossId);
    if (bossConfig) {
      if (bossConfig.bossType === "underwater") {
        setSelectedVehicle("submarine");
      } else {
        setSelectedVehicle("airplane");
      }
    }

    setIsPlaying(true);
    setCurrentGameMode({ type: "boss", bossId });
    setMatchResult(null);
  };

  // Complete game loops callback
  const handleGameFinished = (outcome: "victory" | "gameover", finalScore: number, coinsEarned: number) => {
    setIsPlaying(false);
    setMatchResult({
      outcome,
      score: finalScore,
      coinsEarned
    });

    if (finalScore > stats.highScore) {
      saveStats({
        ...stats,
        highScore: finalScore
      });
    }
  };

  // Helper variables for current preview status
  const currentSkinIdForSelectedVehicle = stats.selectedSkins[selectedVehicle];
  const activeSkinObj = getSkinById(currentSkinIdForSelectedVehicle) || SHIPS_SKINS[0];

  return (
    <div 
      id="naval-app-container" 
      className="w-screen h-screen max-h-screen overflow-hidden bg-[#05070a] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 select-none relative"
    >
      {/* 1. Dynamic Portrait Orientation Shield Warning overlay */}
      <div 
        id="portrait-warning" 
        className="hidden fixed inset-0 bg-[#07090E] z-[9999] flex-col items-center justify-center p-6 text-center select-none"
      >
        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl animate-pulse">
          <span className="text-3xl">📱🔄</span>
        </div>
        <h2 className="text-md font-black text-white uppercase tracking-wider">
          СТАЛЬ И ГЛУБИНА 2D
        </h2>
        <p className="text-[11px] text-slate-400 mt-2 max-w-sm leading-relaxed">
          Пожалуйста, переверните ваше устройство в <b>горизонтальный (ландшафтный) режим</b> для идеальной работы интерфейса без лишней прокрутки!
        </p>
      </div>

      {/* 2. Visual Header - Compact-height (h-10) for maximum vertical workspace */}
      <header className="h-10 border-b border-slate-900 bg-[#0C0F17]/95 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <Gamepad2 className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-[11px] font-black tracking-widest text-white uppercase flex items-center gap-1.5 leading-none">
              СТАЛЬ И ГЛУБИНА <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">2D</span>
            </h1>
          </div>
        </div>

        {/* Wealth & Best Score Indicators */}
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-900">
            <span className="text-yellow-500 text-xs">🪙</span>
            <span className="font-extrabold text-[#f59e0b] font-mono">{stats.coins.toLocaleString()}</span>
            <span className="text-[8px] text-zinc-500 uppercase font-mono">Баланс</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-900 text-slate-400 font-mono">
            <span>🏆 Рекорд:</span>
            <span className="text-white font-black">{stats.highScore}</span>
          </div>
        </div>
      </header>

      {/* 3. Primary Workspace Area - strictly fills remaining height with NO page scrolling */}
      <main className="flex-1 min-h-0 w-full relative p-2 flex flex-col justify-center">

        {/* 1. COMPLETELY ACTIVE GAME VIEW */}
        {isPlaying ? (
          <div className="w-full h-full min-h-0 flex flex-col">
            <NavalEngine
              stats={stats}
              onCoinsEarned={handleCoinsEarned}
              onBossDefeated={handleBossDefeated}
              currentVehicle={selectedVehicle}
              selectedSkinId={currentSkinIdForSelectedVehicle}
              gameMode={currentGameMode}
              onGameFinished={handleGameFinished}
            />
          </div>
        ) : (
          /* 2. MENU HUB & SETUP DOCKYARD - Sleek Single-Page Landscape Widescreen Grid */
          <div className="w-full h-full min-h-0 grid grid-cols-12 gap-3 overflow-hidden">
            
            {/* LEFT COLUMN (Control Bar & Setup & Active Blueprint stats) - col-span-4 */}
            <div className="col-span-4 h-full flex flex-col gap-2 min-h-0 bg-[#080b12]/80 border border-slate-905 p-3 rounded-2xl select-none justify-between">
              
              {/* Category tabs list inside vertical sidebar */}
              <div className="flex flex-col gap-1 shrink-0">
                <span className="text-[8.5px] text-slate-500 uppercase font-black font-mono tracking-widest pl-1 mb-1">⚙️ УПРАВЛЕНИЕ</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => { setActiveTab("patrol"); synth.playJump(); }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      activeTab === "patrol"
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                        : "bg-slate-950/60 text-slate-400 border-slate-900/60 hover:text-slate-300 hover:bg-slate-900/30"
                    }`}
                  >
                    Патруль 🗺️
                  </button>
                  <button
                    onClick={() => { setActiveTab("bosses"); synth.playJump(); }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      activeTab === "bosses"
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                        : "bg-slate-950/60 text-slate-400 border-slate-900/60 hover:text-slate-300 hover:bg-slate-900/30"
                    }`}
                  >
                    Боссы ⚔️
                  </button>
                  <button
                    onClick={() => { setActiveTab("upgrades"); synth.playJump(); }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      activeTab === "upgrades"
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                        : "bg-slate-950/60 text-slate-400 border-slate-900/60 hover:text-slate-300 hover:bg-slate-900/30"
                    }`}
                  >
                    Модернизация 🛠️
                  </button>
                  <button
                    onClick={() => { setActiveTab("shop"); synth.playJump(); }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      activeTab === "shop"
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                        : "bg-slate-950/60 text-slate-400 border-slate-900/60 hover:text-slate-300 hover:bg-slate-900/30"
                    }`}
                  >
                    Скины 🎨
                  </button>
                </div>
              </div>

              {/* Vehicle selectors vertical cluster */}
              <div className="flex flex-col gap-1 shrink-0 mt-1">
                <span className="text-[8.5px] text-slate-500 uppercase font-black font-mono tracking-widest pl-1 mb-1">🚢 ВЫБОР ТЕХНИКИ</span>
                <div className="grid grid-cols-3 gap-1.5 animate-fade-in">
                  {/* Ship */}
                  <button
                    onClick={() => { setSelectedVehicle("ship"); synth.playJump(); }}
                    className={`py-1.5 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedVehicle === "ship"
                        ? "bg-blue-900/20 border-blue-500 text-white font-extrabold shadow-md"
                        : "bg-slate-950/40 border-slate-900/60 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <span className="text-base block">🚢</span>
                    <span className="text-[8.5px] block mt-0.5">Корабль</span>
                  </button>

                  {/* Submarine */}
                  <button
                    onClick={() => { setSelectedVehicle("submarine"); synth.playJump(); }}
                    className={`py-1.5 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedVehicle === "submarine"
                        ? "bg-fuchsia-900/20 border-fuchsia-500 text-white font-extrabold shadow-md"
                        : "bg-slate-950/40 border-slate-900/60 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <span className="text-base block">🐙</span>
                    <span className="text-[8.5px] block mt-0.5">Подлодка</span>
                  </button>

                  {/* Airplane */}
                  <button
                    onClick={() => { setSelectedVehicle("airplane"); synth.playJump(); }}
                    className={`py-1.5 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedVehicle === "airplane"
                        ? "bg-emerald-900/20 border-emerald-500 text-white font-extrabold shadow-md"
                        : "bg-slate-950/40 border-slate-900/60 text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <span className="text-base block">✈️</span>
                    <span className="text-[8.5px] block mt-0.5">Самолет</span>
                  </button>
                </div>
              </div>

              {/* Selected vehicle preview stats block */}
              <div className="flex-1 bg-slate-950/70 rounded-2xl p-2.5 border border-slate-900/80 relative overflow-hidden flex flex-col justify-between min-h-0 mt-1">
                <div 
                  className="absolute bottom-[-15px] right-[-15px] w-20 h-20 rounded-full opacity-5 filter blur-xl"
                  style={{ backgroundColor: activeSkinObj?.tint }}
                />

                <div className="min-h-0 overflow-y-auto custom-scrollbar">
                  <span className="text-[7.5px] uppercase font-black tracking-widest text-[#ca8a04] bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded font-mono inline-block">
                    Выбранный Чертеж
                  </span>
                  <h4 className="text-xs font-black text-white mt-1">{activeSkinObj?.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 italic leading-snug">
                    "{activeSkinObj?.description}"
                  </p>

                  {/* Mini stats view */}
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center font-mono text-[9px]">
                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-850">
                      <span className="text-[7.5px] text-zinc-500 block">HP Корпус</span>
                      <strong className="text-red-400 font-bold">+{activeSkinObj?.maxHpBonus || 0}</strong>
                    </div>
                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-850">
                      <span className="text-[7.5px] text-zinc-500 block">DMG Урон</span>
                      <strong className="text-orange-400 font-bold">+{activeSkinObj?.damageBonus || 0}</strong>
                    </div>
                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-850">
                      <span className="text-[7.5px] text-zinc-500 block">SPD Движ</span>
                      <strong className="text-blue-400 font-bold">+{activeSkinObj?.speedBonus || 0}</strong>
                    </div>
                  </div>

                  {/* Ultimate capability indicator */}
                  <div className="mt-2 p-1.5 bg-blue-500/5 border border-blue-500/10 rounded-lg text-[9px] text-cyan-300 leading-snug">
                    <span className="font-extrabold uppercase text-[7px] tracking-wider text-blue-400 block mb-0.5">Сверх-Маневр (Клавиша E):</span>
                    {activeSkinObj?.specialAbility}
                  </div>
                </div>

                {/* QUICK INSTANT PLAY BUTTON */}
                <button
                  onClick={startPatrolGame}
                  className="w-full bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-2 px-3 rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-95 text-xs text-center shrink-0 mt-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-white animate-pulse" />
                  <span className="tracking-wide font-black">СТАРТ ОПЕРАЦИИ ⚔️</span>
                </button>
              </div>

              {/* Clear progress button in corner */}
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-900/60 shrink-0 text-[8px] text-slate-600 font-mono">
                <button 
                  onClick={handleResetProgress}
                  className="text-rose-500/60 hover:text-rose-400 uppercase font-bold hover:underline cursor-pointer"
                >
                  ОЧИСТИТЬ ПРОГРЕСС ⚠
                </button>
                <span>ВЫПУСК © 2026</span>
              </div>
            </div>

            {/* RIGHT COLUMN (Content Scroll Area) - col-span-8 */}
            <div className="col-span-8 h-full min-h-0 bg-[#0B0F17]/90 border border-slate-900/60 rounded-2xl flex flex-col overflow-hidden relative">
              
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
                {/* A. PATROL HUB */}
                {activeTab === "patrol" && (
                  <div className="h-full flex flex-col justify-between">
                    <div className="flex items-start gap-3 pb-3 border-b border-slate-900/70">
                      <div className="p-2.5 bg-blue-500/5 rounded-xl border border-blue-500/10 text-center text-xl shrink-0">
                        🌊
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">Генеральный Патрульный Штаб</h3>
                        <p className="text-[10.5px] text-slate-400 mt-1 leading-normal">
                          Свободное плавание через патрульные воды. Отражайте набеги рейдеров, собирайте секретные ящики снабжения, чините броню на ходу и копите золото. Каждые несколько волн в игру залетает один из разыскиваемых Генералов-Боссов!
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 my-3">
                      <div className="p-2 bg-slate-950/40 border border-slate-900/60 rounded-xl flex items-start gap-2.5">
                        <span className="text-base mt-0.5">📈</span>
                        <div>
                          <strong className="text-[10px] text-white block leading-tight">Волны Атаки</strong>
                          <span className="text-[9px] text-slate-500 leading-normal block mt-0.5">Локационные волны рейдеров усложняются. Сила и плотность атак на корабль растут.</span>
                        </div>
                      </div>
                      <div className="p-2 bg-slate-950/40 border border-slate-900/60 rounded-xl flex items-start gap-2.5">
                        <span className="text-base mt-0.5">🎁</span>
                        <div>
                          <strong className="text-[10px] text-white block leading-tight">Боевое Снабжение</strong>
                          <span className="text-[9px] text-slate-500 leading-normal block mt-0.5">Используйте Силовые Щиты 🛡️, Тяговые Магниты 🧲, Моментальный ремонт корпуса ❤️ и Тройной Залп 🔫.</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-900 items-start mt-auto">
                      <div className="text-[10.5px] text-slate-400 leading-normal flex-1">
                        🚀 <strong>Памятка штаба:</strong> Обязательно посетите меню <b>Модернизации</b> в левом меню для улучшения максимального здоровья и наносимого орудием урона перед долгосрочными патрулями!
                      </div>
                      <button
                        onClick={startPatrolGame}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase tracking-widest cursor-pointer transition-all shrink-0 shadow-lg shadow-emerald-600/10"
                      >
                        ВЫЙТИ В МОРЕ 🌊
                      </button>
                    </div>
                  </div>
                )}

                {/* B. LEGENDARY WANTED BOSSES SELECTOR */}
                {activeTab === "bosses" && (
                  <BossSelector
                    stats={stats}
                    onBossSelected={startBossGame}
                  />
                )}

                {/* C. ENGINEERING UPGRADES STATION */}
                {activeTab === "upgrades" && (
                  <UpgradeStation
                    stats={stats}
                    onUpgradePurchased={handleUpgradePurchased}
                  />
                )}

                {/* D. SKINS AND BLUEPRINTS SHOP */}
                {activeTab === "shop" && (
                  <ShopStation
                    stats={stats}
                    onSkinPurchased={handleSkinPurchased}
                    onSkinSelected={handleSkinSelected}
                  />
                )}
              </div>

            </div>

          </div>
        )}
      </main>

      {/* 4. Complete Match Resolution Modal Overlay - displays as modal over center screen */}
      {matchResult && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className={`max-w-sm w-full bg-[#0a0d14] border rounded-3xl p-5 shadow-2xl relative overflow-hidden animate-fade-in ${
            matchResult.outcome === "victory" 
              ? "border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.2)]" 
              : "border-rose-500/50 shadow-[0_0_35px_rgba(244,63,94,0.2)]"
          }`}>
            {/* Celebration Backdrop Spark Highlight */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

            {/* Visual Header */}
            <div className="flex items-center gap-3 mb-3.5 pb-2 border-b border-slate-900">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl shrink-0">
                {matchResult.outcome === "victory" ? "🏆" : "💥"}
              </div>
              <div>
                <h3 className={`text-sm font-black uppercase ${
                  matchResult.outcome === "victory" ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {matchResult.outcome === "victory" ? "Военный Триумф!" : "Кампания Завершена"}
                </h3>
                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Отчет морского главнокомандования</p>
              </div>
            </div>

            {/* Body */}
            <p className="text-xs text-slate-300 leading-relaxed">
              Операция была завершена. Все данные симуляции и заработанное снабжение были перенаправлены на ваши центральные счета.
            </p>

            {/* Loot elements */}
            <div className="grid grid-cols-2 gap-2.5 my-3.5 bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono text-center">
              <div>
                <span className="text-[8px] text-slate-500 block uppercase font-bold">Добыто золотых монет:</span>
                <strong className="text-xs text-yellow-400 font-black">+{matchResult.coinsEarned} 🪙</strong>
              </div>
              <div>
                <span className="text-[8px] text-slate-500 block uppercase font-bold">Итоговые очки:</span>
                <strong className="text-xs text-white font-black">{matchResult.score} ⭐</strong>
              </div>
            </div>

            {/* Secrets unlocking feedback */}
            {matchResult.newSkinUnlocked && (
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-xl text-[10px] text-yellow-200 leading-relaxed text-center">
                🎉 <strong>РАЗБЛОКИРОВАН НОВЫЙ ЧЕРТЕЖ:</strong><br />
                <span className="text-white font-extrabold text-[11px]">"{matchResult.newSkinUnlocked}"</span>
              </div>
            )}

            {/* Trigger buttons */}
            <button 
              onClick={() => setMatchResult(null)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-2 px-4 rounded-xl text-xs cursor-pointer transition-all tracking-wider text-center"
            >
              ПРИНЯТЬ ОТЧЕТ ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
