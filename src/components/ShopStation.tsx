import React, { useState } from "react";
import { VehicleType, PlayerStats, Skin } from "../types";
import { SHIPS_SKINS, SUBMARINE_SKINS, AIRPLANE_SKINS, BOSSES } from "./GameData";
import { synth } from "./SoundSynth";
import { ShoppingBag, Lock, CheckCircle2, ChevronRight, Zap, Target } from "lucide-react";

interface ShopStationProps {
  stats: PlayerStats;
  onSkinPurchased: (skinId: string, updatedCoins: number) => void;
  onSkinSelected: (type: VehicleType, skinId: string) => void;
}

export default function ShopStation({
  stats,
  onSkinPurchased,
  onSkinSelected
}: ShopStationProps) {
  const [activeTab, setActiveTab] = useState<VehicleType>("ship");

  // Get current skin list for active tab
  const getSkinList = (): Skin[] => {
    switch (activeTab) {
      case "ship": return SHIPS_SKINS;
      case "submarine": return SUBMARINE_SKINS;
      case "airplane": return AIRPLANE_SKINS;
    }
  };

  const getVehicleLabel = (type: VehicleType) => {
    switch (type) {
      case "ship": return "Корабли 🚢";
      case "submarine": return "Подлодки 🐙";
      case "airplane": return "Самолеты ✈️";
    }
  };

  const currentSkins = getSkinList();

  const handleAction = (skin: Skin) => {
    const isUnlocked = stats.unlockedSkins.includes(skin.id) || skin.price === 0;

    if (isUnlocked) {
      // Direct select
      onSkinSelected(activeTab, skin.id);
      synth.playPowerup();
    } else {
      // Attempt Purchase
      if (skin.bossUnlockId) {
        // Needs boss defeat!
        return;
      }

      if (stats.coins >= skin.price) {
        const remainingCoins = stats.coins - skin.price;
        synth.playPowerup();
        onSkinPurchased(skin.id, remainingCoins);
      } else {
        synth.playAlarm();
      }
    }
  };

  return (
    <div id="shop-station-panel" className="bg-[#0B0F17]/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
      {/* Shop Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-yellow-500 fill-current" />
            Военная Верфь & Магазин Чертежей
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Купите премиальные чертежи за золотые монеты или разблокируйте легендарные скины, побеждая боссов глубин и небес!
          </p>
        </div>

        {/* Balance counter in page block */}
        <div className="flex items-center gap-2 bg-slate-900 border border-yellow-500/20 px-4 py-2 rounded-2xl w-fit">
          <span className="text-lg">🪙</span>
          <span className="font-extrabold text-amber-300 font-mono text-sm tracking-wide">
            {stats.coins.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold">МОНЕТ</span>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex gap-2.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-900 mb-6 w-fit">
        {(["ship", "submarine", "airplane"] as VehicleType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              synth.playJump();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            {getVehicleLabel(tab)}
          </button>
        ))}
      </div>

      {/* Skins grid cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {currentSkins.map((skin) => {
          const isSelected = stats.selectedSkins[activeTab] === skin.id;
          const isUnlocked = stats.unlockedSkins.includes(skin.id) || skin.price === 0 || (skin.bossUnlockId && stats.defeatedBosses.includes(skin.bossUnlockId));
          const canAfford = stats.coins >= skin.price;

          // Find associated boss config if there's an unlock key
          const bossConfig = skin.bossUnlockId ? BOSSES.find((b) => b.id === skin.bossUnlockId) : null;

          return (
            <div
              key={skin.id}
              className={`border rounded-2xl p-4.5 flex flex-col justify-between transition-all relative overflow-hidden ${
                isSelected
                  ? "bg-blue-950/20 border-blue-500 shadow-md shadow-blue-500/10"
                  : isUnlocked
                  ? "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  : "bg-slate-950/30 border-slate-900/90 text-slate-500"
              }`}
            >
              {/* Colored vector glow decorator */}
              <div 
                className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 filter blur-xl"
                style={{ backgroundColor: skin.tint }}
              />

              {/* Card top Title info */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-full inline-block" 
                      style={{ backgroundColor: skin.tint }}
                    />
                    {skin.name}
                  </h3>
                  {isSelected && (
                    <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider font-mono">
                      В СТРОЮ
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[38px]">
                  {skin.description}
                </p>

                {/* Stat Bonuses breakdown */}
                <div className="mt-3.5 space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Доп. Прочность HP:</span>
                    <span className={skin.maxHpBonus >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {skin.maxHpBonus >= 0 ? `+${skin.maxHpBonus}` : skin.maxHpBonus}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Доп. Огневой Урон DMG:</span>
                    <span className={skin.damageBonus >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {skin.damageBonus >= 0 ? `+${skin.damageBonus}` : skin.damageBonus}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Мобильность Хода SPD:</span>
                    <span className={skin.speedBonus >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {skin.speedBonus >= 0 ? `+${skin.speedBonus}` : skin.speedBonus}
                    </span>
                  </div>
                </div>

                {/* Ultimate passive specs */}
                <div className="mt-3.5 flex items-start gap-1.5 p-2 bg-blue-500/5 rounded-lg border border-blue-500/10 text-[10px] text-blue-300">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5 fill-current" />
                  <div>
                    <span className="font-black uppercase tracking-wider text-[9px] text-blue-400 block mb-0.5">Суперспособность:</span>
                    {skin.specialAbility}
                  </div>
                </div>
              </div>

              {/* Footer action buttons */}
              <div className="mt-5 pt-3.5 border-t border-slate-900/60">
                {isUnlocked ? (
                  <button
                    onClick={() => handleAction(skin)}
                    disabled={isSelected}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800"
                        : "bg-blue-600/80 text-white hover:bg-blue-600 active:scale-95"
                    }`}
                  >
                    {isSelected ? "Уже выбрано в ангаре" : "Вывесить флаг боекомплекта ⚡"}
                  </button>
                ) : skin.bossUnlockId ? (
                  <div className="bg-red-950/20 border border-red-900/40 text-red-400 p-2 rounded-xl flex items-center gap-2 text-[10.5px]">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Заблокировано! Одолейте босса <b>{bossConfig ? bossConfig.name : "Kraken"}</b> {bossConfig?.icon} чтобы открыть чертеж!
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAction(skin)}
                    disabled={!canAfford}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      canAfford
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold active:scale-95"
                        : "bg-slate-900/40 border border-slate-850 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Купить чертеж за {skin.price} 🪙
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
