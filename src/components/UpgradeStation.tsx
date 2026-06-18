import React from "react";
import { PlayerStats, Upgrade } from "../types";
import { UPGRADES } from "./GameData";
import { synth } from "./SoundSynth";
import { Shield, Zap, Sparkles, TrendingUp, CheckCircle } from "lucide-react";

interface UpgradeStationProps {
  stats: PlayerStats;
  onUpgradePurchased: (id: "hp" | "damage" | "speed", newLevel: number, remainingCoins: number) => void;
}

export default function UpgradeStation({
  stats,
  onUpgradePurchased
}: UpgradeStationProps) {

  const handleUpgrade = (upgrade: Upgrade, currentLevel: number) => {
    if (currentLevel >= upgrade.maxLevel) return; // already maxed

    const price = upgrade.priceScale[currentLevel - 1];

    if (stats.coins >= price) {
      const remainingCoins = stats.coins - price;
      const nextLevel = currentLevel + 1;
      synth.playPowerup();
      onUpgradePurchased(upgrade.id, nextLevel, remainingCoins);
    } else {
      synth.playAlarm();
    }
  };

  return (
    <div id="upgrades-workshop-card" className="bg-[#0B0F17]/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
      {/* Panel Headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Инженерная Мастерская & Верфь Модернизации
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Постоянно повышайте характеристики прочности, урона и скорости маневрирования. Эти улучшения сохраняются при смене транспортных средств и выбранных скинов!
          </p>
        </div>

        {/* Player coin balance */}
        <div className="flex items-center gap-2 bg-slate-900 border border-yellow-500/20 px-4 py-2 rounded-2xl w-fit">
          <span className="text-lg">🪙</span>
          <span className="font-extrabold text-amber-300 font-mono text-sm tracking-wide">
            {stats.coins.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold">МОНЕТ</span>
        </div>
      </div>

      {/* Grid of upgrades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {UPGRADES.map((upgrade) => {
          // Get player current level for this stat
          const currentLevel = stats.upgrades[upgrade.id];
          const isMaxed = currentLevel >= upgrade.maxLevel;
          const nextPrice = !isMaxed ? upgrade.priceScale[currentLevel - 1] : 0;
          const canAfford = stats.coins >= nextPrice && !isMaxed;

          // Icon and theme select
          let statIcon = <Shield className="w-5 h-5 text-red-400" />;
          let labelBadge = "Прочность";
          let themeColor = "border-red-500/20 bg-red-500/5";

          if (upgrade.id === "damage") {
            statIcon = <Sparkles className="w-5 h-5 text-orange-400" />;
            labelBadge = "Огневая Сила";
            themeColor = "border-orange-500/20 bg-orange-500/5";
          } else if (upgrade.id === "speed") {
            statIcon = <Zap className="w-5 h-5 text-blue-400" />;
            labelBadge = "Скорость";
            themeColor = "border-blue-500/20 bg-blue-500/5";
          }

          return (
            <div
              key={upgrade.id}
              className={`border p-5 rounded-2xl flex flex-col justify-between transition-all ${themeColor} border-slate-800 bg-slate-950/20`}
            >
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                    {statIcon}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">{upgrade.name}</h3>
                    <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500 font-bold block mt-0.5">
                      {labelBadge}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  {upgrade.description}
                </p>

                {/* Meter indicators */}
                <div className="space-y-2 mb-6 bg-slate-950/60 p-3.5 rounded-xl border border-slate-900">
                  <div className="flex justify-between items-center text-xs font-mono mb-1">
                    <span className="text-slate-500">Уровень:</span>
                    <span className="font-black text-white text-sm">
                      {currentLevel} <span className="text-slate-600 text-xs">/ {upgrade.maxLevel}</span>
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-3">
                    {Array.from({ length: upgrade.maxLevel }).map((_, stepIdx) => {
                      const isActive = stepIdx < currentLevel;
                      return (
                        <div
                          key={stepIdx}
                          className={`flex-1 rounded-sm transition-all ${
                            isActive
                              ? upgrade.id === "hp"
                                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                : upgrade.id === "damage"
                                ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                                : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                              : "bg-slate-900 border border-slate-800"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Purchase upgrade buttons */}
              <div>
                {isMaxed ? (
                  <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-2 px-4 rounded-xl text-xs font-extrabold text-center flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    МАКСИМАЛЬНЫЙ УРОВЕНЬ
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(upgrade, currentLevel)}
                    disabled={!canAfford}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      canAfford
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95"
                        : "bg-slate-900/40 border border-slate-850 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    🚀 Модернизировать за {nextPrice} 🪙
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
