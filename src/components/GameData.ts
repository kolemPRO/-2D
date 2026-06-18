import { Skin, Boss, Upgrade } from "../types";

export const SHIPS_SKINS: Skin[] = [
  {
    id: "ship_classic",
    name: "Катер 'Альбатрос'",
    description: "Стандартный патрульный катер береговой охраны. Юркий и надёжный.",
    price: 0,
    tint: "#3b82f6", // Blue
    particleColor: "#60a5fa",
    maxHpBonus: 0,
    damageBonus: 0,
    speedBonus: 0,
    specialAbility: "Ускорение: Кратковременно увеличивает скорость маневрирования на 80%."
  },
  {
    id: "ship_ironclad",
    name: "Броненосец 'Варяг'",
    description: "Бронированный ветеран флота. Снижает входящий урон на 20%.",
    price: 180,
    tint: "#64748b", // Slate
    particleColor: "#94a3b8",
    maxHpBonus: 40,
    damageBonus: 5,
    speedBonus: -1,
    specialAbility: "Стальной Щит: Создает силовой щит, поглощающий выстрелы в течение 4 секунд."
  },
  {
    id: "ship_cyberpunk",
    name: "Кибер-Эсминец 'Неон'",
    description: "Эсминец будущего с плазменным двигателем. Выпускает неоновые снаряды.",
    price: 350,
    tint: "#06b6d4", // Cyan
    particleColor: "#22d3ee",
    maxHpBonus: 20,
    damageBonus: 15,
    speedBonus: 2,
    specialAbility: "Вспышка: Прыжок вперед с выделением мощных плазменных искр вокруг."
  },
  {
    id: "ship_golden",
    name: "Яхта магната 'Мидас'",
    description: "Покрыта чистым золотом. Увеличивает количество получаемых монеток на 50%.",
    price: 600,
    tint: "#eab308", // Yellow / Gold
    particleColor: "#fde047",
    maxHpBonus: 10,
    damageBonus: 10,
    speedBonus: 1,
    specialAbility: "Золотой Дождь: Вызывает залп монетных осколков, повреждающих всех врагов."
  },
  {
    id: "ship_pirate",
    name: "Летучий Голландец",
    description: "Призрачный проклятый фрегат Kraken Hunter. Стреляет в 3 направлениях.",
    price: 0,
    bossUnlockId: "boss_kraken",
    tint: "#10b981", // Emerald/Ghost Green
    particleColor: "#34d399",
    maxHpBonus: 60,
    damageBonus: 25,
    speedBonus: 1,
    specialAbility: "Проклятие Бездны: Замедляет всех видимых врагов и боссов на 50% на 5 секунд."
  },
  {
    id: "ship_icebreaker",
    name: "Ледокол 'Арктика'",
    description: "Закаленный во льдах гигант. Замораживает и замедляет подбитых врагов.",
    price: 0,
    bossUnlockId: "boss_zeppelin",
    tint: "#38bdf8", // Sky blue
    particleColor: "#e0f2fe",
    maxHpBonus: 80,
    damageBonus: 20,
    speedBonus: 0,
    specialAbility: "Обморожение: Замораживает пули врагов, превращая их в хрупкий безвредный лед."
  },
  {
    id: "ship_dreadnought",
    name: "Линкор 'Император'",
    description: "Флагман со сверхмощной спаренной артиллерийской башней. Сметает всё на пути.",
    price: 1200,
    tint: "#f43f5e", // Rose
    particleColor: "#fb7185",
    maxHpBonus: 120,
    damageBonus: 40,
    speedBonus: -0.5,
    specialAbility: "Главный Калибр: Запускает разрушительную заградительную бомбардировку."
  }
];

export const SUBMARINE_SKINS: Skin[] = [
  {
    id: "sub_classic",
    name: "Подлодка 'Малютка'",
    description: "Стандартная дизельная субмарина. Стреляет надежными торпедами.",
    price: 0,
    tint: "#475569", // Dark Slate
    particleColor: "#38bdf8",
    maxHpBonus: 0,
    damageBonus: 0,
    speedBonus: 0,
    specialAbility: "Твистер: Выпускает водоворот пузырей, блокирующий вражеские торпеды."
  },
  {
    id: "sub_gold",
    name: "Субмарина 'Кусто'",
    description: "Научно-исследовательская лодка из золотого сплава. Притягивает монетки магнитом.",
    price: 250,
    tint: "#ca8a04", // Gold
    particleColor: "#facc15",
    maxHpBonus: 15,
    damageBonus: 5,
    speedBonus: 1.5,
    specialAbility: "Эхолокатор: Раскрывает позиции всех врагов и наносит урон эхо-волной."
  },
  {
    id: "sub_nautilus",
    name: "Стимпанк 'Наутилус'",
    description: "Шедевр инженерии капитана Немо. Стреляет паровыми струями и самонаводящимися минами.",
    price: 450,
    tint: "#b45309", // Amber/Bronze
    particleColor: "#f59e0b",
    maxHpBonus: 45,
    damageBonus: 20,
    speedBonus: 0.5,
    specialAbility: "Выброс Пара: Котлы закипают! Выжигает всех врагов вблизи паровым облаком."
  },
  {
    id: "sub_leviathan",
    name: "Чужой 'Левиафан'",
    description: "Секретная био-механическая подлодка. Выпускает самонаводящиеся плазменные споры.",
    price: 0,
    bossUnlockId: "boss_kraken",
    tint: "#a21caf", // Purple
    particleColor: "#d946ef",
    maxHpBonus: 65,
    damageBonus: 30,
    speedBonus: 1.2,
    specialAbility: "Кислотная Волна: Извергает струю кислоты, разъедающую обшивку врагов."
  },
  {
    id: "sub_angler",
    name: "Глубоководный 'Морской Дёрт'",
    description: "Биолюминесцентная глубинная лодка. Слепит врагов, замедляя их темп стрельбы.",
    price: 0,
    bossUnlockId: "boss_megalodon",
    tint: "#db2777", // Pink
    particleColor: "#f472b6",
    maxHpBonus: 75,
    damageBonus: 25,
    speedBonus: 0.8,
    specialAbility: "Вспышка Бездны: Ослепляет подводный мир, парализуя мелких врагов на 4 секунды."
  },
  {
    id: "sub_shadow",
    name: "Ядерная 'Черная Акула'",
    description: "Стелс-субмарина пятого поколения. Оснащена квантовыми сверхбыстрыми торпедами.",
    price: 900,
    tint: "#18181b", // Dark Gray
    particleColor: "#a1a1aa",
    maxHpBonus: 100,
    damageBonus: 35,
    speedBonus: 2.0,
    specialAbility: "Инфразвуковой Удар: Вызывает мощное сотрясение воды, уничтожающее все снаряды."
  }
];

export const AIRPLANE_SKINS: Skin[] = [
  {
    id: "plane_classic",
    name: "УБ-2 'Стриж'",
    description: "Винтовой истребитель-моноплан. Стреляет быстрыми свинцовыми очередями.",
    price: 0,
    tint: "#1e3a8a", // Navy
    particleColor: "#cbd5e1",
    maxHpBonus: 0,
    damageBonus: 0,
    speedBonus: 0,
    specialAbility: "Мертвая Петля: Круговое уклонение, дающее временную неуязвимость на 1.5 секунды."
  },
  {
    id: "plane_redbaron",
    name: "Триплан 'Красный Барон'",
    description: "Легендарный багровый триплан Первой Мировой. Выпускает спаренные пулеметные очереди.",
    price: 200,
    tint: "#dc2626", // Red
    particleColor: "#ef4444",
    maxHpBonus: 20,
    damageBonus: 10,
    speedBonus: 1.5,
    specialAbility: "Берсерк: Повышает скорострельность на 150% на 4 секунды."
  },
  {
    id: "plane_stealth",
    name: "Стелс 'F-117 Ночной Охотник'",
    description: "Сверхзвуковой бомбардировщик-невидимка. Стреляет ракетами класса воздух-земля.",
    price: 0,
    bossUnlockId: "boss_storm_eagle",
    tint: "#27272a", // Dark grey
    particleColor: "#ff7849",
    maxHpBonus: 50,
    damageBonus: 30,
    speedBonus: 2.5,
    specialAbility: "Режим Стелс: Полная невидимость для вражеских снарядов на 4 секунды."
  },
  {
    id: "plane_fortress",
    name: "Крепость 'Б-29 Супербомбер'",
    description: "Тяжелая воздушная цитадель. Сбрасывает разрушительные кассетные бомбы группами по 5 штук.",
    price: 0,
    bossUnlockId: "boss_zeppelin",
    tint: "#15803d", // Green
    particleColor: "#22c55e",
    maxHpBonus: 90,
    damageBonus: 40,
    speedBonus: -1.0,
    specialAbility: "Ковровый Сброс: Сбрасывает шквал бомб по всему экрану под самолетом."
  },
  {
    id: "plane_golden",
    name: "Истребитель 'Беркут-Gold'",
    description: "Золотой реактивный истребитель с крылом обратной стреловидности. Магнит для богатства.",
    price: 500,
    tint: "#ca8a04", // Darker gold
    particleColor: "#fbbf24",
    maxHpBonus: 30,
    damageBonus: 15,
    speedBonus: 2.0,
    specialAbility: "Золотой Залп: Наводящиеся ракеты, взрывы которых приносят дополнительные монетки."
  },
  {
    id: "plane_ufo",
    name: "Грави-Блюдце 'Зета-9'",
    description: "Внеземное летающее судно. Стреляет дезинтегрирующими лучами, пробивающими врагов насквозь.",
    price: 1000,
    tint: "#86198f", // Violet
    particleColor: "#f43f5e",
    maxHpBonus: 110,
    damageBonus: 50,
    speedBonus: 3.0,
    specialAbility: "Гравитационный Импульс: Притягивает все монетки и бонусы с экрана."
  }
];

export const BOSSES: Boss[] = [
  {
    id: "boss_kraken",
    name: "Гигантский Кракен",
    title: "Исполин Марианской Впадины",
    description: "Легендарный левиафан, способный переворачивать флоты. Его щупальца извергают концентрированные чернильные залпы, а подводные водовороты затягивают любые суда.",
    hp: 1400,
    maxHp: 1400,
    rewardCoins: 250,
    unlocksSkins: ["sub_leviathan", "ship_pirate"],
    difficulty: "Нормально",
    bossType: "underwater",
    icon: "🦑",
    background: "from-blue-900 to-indigo-950"
  },
  {
    id: "boss_megalodon",
    name: "Реликтовый Мегалодон",
    title: "Патриарх Глубоководных Хищников",
    description: "Древнейшая акула гигантских размеров. Безумно быстрая и яростная. Она идет на таран, создает подводные звуковые волны и пожирает все живое на своем пути.",
    hp: 2200,
    maxHp: 2200,
    rewardCoins: 350,
    unlocksSkins: ["sub_angler"],
    difficulty: "Сложно",
    bossType: "underwater",
    icon: "🦈",
    background: "from-cyan-900 to-slate-900"
  },
  {
    id: "boss_zeppelin",
    name: "Крейсер 'Ураган'",
    title: "Железный Дредноут Цеппелин",
    description: "Гигантский бронированный авианосец-дирижабль. Застилает небо тучами дыма, сбрасывает кассетные бомбы, стреляет ракетами и заградительными лучами.",
    hp: 3500,
    maxHp: 3500,
    rewardCoins: 500,
    unlocksSkins: ["plane_fortress", "ship_icebreaker"],
    difficulty: "Сложно",
    bossType: "air",
    icon: "🛸",
    background: "from-zinc-800 to-red-950"
  },
  {
    id: "boss_storm_eagle",
    name: "Штормовой Гриф 'Орион'",
    title: "Сверхтехнологичный Дрон-Истребитель",
    description: "Прототип роботизированного истребителя пятого поколения. Манёвренность превосходит человеческие законы физики. Атакует молниями, огненными лазерами и умными ищейками.",
    hp: 5000,
    maxHp: 5000,
    rewardCoins: 750,
    unlocksSkins: ["plane_stealth"],
    difficulty: "Легендарно",
    bossType: "air",
    icon: "🦅",
    background: "from-indigo-950 to-rose-950"
  }
];

export const UPGRADES: Upgrade[] = [
  {
    id: "hp",
    name: "Прочность Корпуса (HP)",
    description: "Увеличивает максимальный запас здоровья корабля, подлодки или самолета.",
    level: 1,
    maxLevel: 6,
    priceScale: [60, 150, 300, 600, 1200]
  },
  {
    id: "damage",
    name: "Огневая Мощь (DMG)",
    description: "Увеличивает урон всех снарядов: снарядов палубного орудия, торпед и авиабомб.",
    level: 1,
    maxLevel: 6,
    priceScale: [80, 180, 350, 700, 1400]
  },
  {
    id: "speed",
    name: "Форсаж Двигателя (SPD)",
    description: "Увеличивает скорость перемещения, разгона, уклонения и силу прыжка.",
    level: 1,
    maxLevel: 6,
    priceScale: [50, 120, 250, 500, 1000]
  }
];

export const getSkinById = (skinId: string): Skin | undefined => {
  return (
    SHIPS_SKINS.find(s => s.id === skinId) ||
    SUBMARINE_SKINS.find(s => s.id === skinId) ||
    AIRPLANE_SKINS.find(s => s.id === skinId)
  );
};
