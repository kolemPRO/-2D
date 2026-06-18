import React from "react";
import { PlayerStats, Boss } from "../types";
import { BOSSES, getSkinById } from "./GameData";
import { synth } from "./SoundSynth";
import { ShieldAlert, Trophy, ShieldCheck, ChevronRight } from "lucide-react";

interface BossSelectorProps {
  stats: PlayerStats;
  onBossSelected: (bossId: string) => void;
}

export default function BossSelector({
  stats,
  onBossSelected
}: BossSelectorProps) {

  const handleLaunchCombat = (bossId: string) => {
    synth.playExplosion("large");
    onBossSelected(bossId);
  };

  return (
    <div id="bosses-arena-panel" className="bg-[#0B0F17]/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
      {/* Panel Headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
            Список Разыскиваемых Легендарных Боссов
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Выйдите на прямую военную дуэль против этих гигантских боссов. За победу над каждым боссом вы немедленно разблокируете эксклюзивный чертеж боевой техники!
          </p>
        </div>

        {/* Total bosses beaten counter */}
        <div className="flex items-center gap-2 bg-slate-900 border border-red-500/20 px-4 py-2 rounded-2xl w-fit">
          <span className="text-sm">🏆</span>
          <span className="font-extrabold text-red-400 font-mono text-xs tracking-wider">
            Победили: {stats.defeatedBosses.length} / {BOSSES.length}
          </span>
        </div>
      </div>

      {/* Grid of Boss cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {BOSSES.map((boss) => {
          const isDefeated = stats.defeatedBosses.includes(boss.id);

          // Map skin IDs to actual human skin names for pristine display
          const unlockedSkinsList = boss.unlocksSkins
            .map((skinId) => getSkinById(skinId))
            .filter((s) => s !== undefined);

          // Badge difficulty background colors
          let diffColor = "bg-green-500/10 text-green-400 border-green-500/20";
          if (boss.difficulty === "Сложно") diffColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
          if (boss.difficulty === "Легендарно") diffColor = "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse";

          return (
            <div
              key={boss.id}
              className={`border rounded-2xl p-5 bg-gradient-to-br ${boss.background} bg-opacity-40 transition-all flex flex-col justify-between relative overflow-hidden ${
                isDefeated 
                  ? "border-emerald-500/40 shadow-lg shadow-emerald-500/5 hover:scale-[1.01]" 
                  : "border-slate-800 hover:border-slate-700 hover:scale-[1.01]"
              }`}
            >
              {/* Giant watermark emoticon decoration at background */}
              <div className="absolute -bottom-6 -right-6 text-8xl opacity-10 select-none pointer-events-none">
                {boss.icon}
              </div>

              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div>
                    <span className="text-xs text-rose-400 font-black uppercase tracking-widest font-mono block">
                      {boss.bossType === "underwater" ? "🌊 Подводная Угроза" : "☁️ Воздушный Рейд"}
                    </span>
                    <h3 className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block text-xl">{boss.icon}</span>
                      {boss.name}
                    </h3>
                  </div>

                  {/* defetated check indicator */}
                  {isDefeated ? (
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-lg uppercase font-bold tracking-wider font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" /> Побежден
                    </span>
                  ) : (
                    <span className={`text-[10px] border px-2.5 py-0.5 rounded-lg uppercase font-bold tracking-wider font-mono ${diffColor}`}>
                      {boss.difficulty}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed italic mb-5 pr-14">
                  "{boss.title}" — {boss.description}
                </p>

                {/* Rewards section */}
                <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-900 mb-6">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Награды за триумф:
                  </div>
                  
                  <div className="flex flex-wrap gap-4 pt-1">
                    {/* Coin Reward card */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-mono bg-yellow-500/5 border border-yellow-500/10 px-2.5 py-1 rounded-lg">
                      <span>🪙</span>
                      <span>+{boss.rewardCoins} Монет</span>
                    </div>

                    {/* Skin unlock markers */}
                    {unlockedSkinsList.map((skin) => (
                      <div 
                        key={skin.id}
                        className="flex items-center gap-1.5 text-xs text-blue-300 font-medium bg-blue-500/5 border border-blue-500/10 px-2.5 py-1 rounded-lg"
                      >
                        <Trophy className="w-3 h-3 text-yellow-400" />
                        <span>Чертеж: <strong className="text-white font-extrabold">{skin.name}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Engagement trigger button */}
              <button
                onClick={() => handleLaunchCombat(boss.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black tracking-wide text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDefeated
                    ? "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                    : "bg-red-600 text-white hover:bg-red-500/90 hover:shadow-lg hover:shadow-red-600/15"
                }`}
              >
                <span>{isDefeated ? "Победить еще раз ⚔️" : "Выйти на смертельный бой ⚔️"}</span>
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
