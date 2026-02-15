import { randomUUID } from "node:crypto";
import { db } from "@repo/db";
import { categories, categoryRelations } from "@repo/db/schema";
import { slugify } from "@repo/shared";

type CategorySeed = {
  key: string;
  icon: string;
  nameEn: string;
  nameKa: string;
  nameRu: string;
  children: Array<{
    key: string;
    icon: string;
    nameEn: string;
    nameKa: string;
    nameRu: string;
  }>;
};

const categorySeeds: CategorySeed[] = [
  {
    key: "electronics",
    icon: "💻",
    nameEn: "Electronics",
    nameKa: "ელექტრონიკა",
    nameRu: "Электроника",
    children: [
      {
        key: "computers-tablets",
        icon: "🖥️",
        nameEn: "Computers & Tablets",
        nameKa: "კომპიუტერები და ტაბლეტები",
        nameRu: "Компьютеры и планшеты",
      },
      {
        key: "phones-accessories",
        icon: "📱",
        nameEn: "Phones & Accessories",
        nameKa: "ტელეფონები და აქსესუარები",
        nameRu: "Телефоны и аксессуары",
      },
      {
        key: "cameras-photo",
        icon: "📷",
        nameEn: "Cameras & Photo",
        nameKa: "კამერები და ფოტო",
        nameRu: "Камеры и фото",
      },
      {
        key: "tv-audio-video",
        icon: "📺",
        nameEn: "TV, Audio & Video",
        nameKa: "ტელევიზორი, აუდიო და ვიდეო",
        nameRu: "ТВ, аудио и видео",
      },
    ],
  },
  {
    key: "motors",
    icon: "🚗",
    nameEn: "Motors",
    nameKa: "ავტომოძრაობა",
    nameRu: "Авто",
    children: [
      {
        key: "auto-parts-accessories",
        icon: "🛞",
        nameEn: "Auto Parts & Accessories",
        nameKa: "ავტო ნაწილები და აქსესუარები",
        nameRu: "Автозапчасти и аксессуары",
      },
      {
        key: "motorcycles",
        icon: "🏍️",
        nameEn: "Motorcycles",
        nameKa: "მოტოციკლები",
        nameRu: "Мотоциклы",
      },
      {
        key: "tools-supplies",
        icon: "🧰",
        nameEn: "Tools & Supplies",
        nameKa: "ინსტრუმენტები და მასალები",
        nameRu: "Инструменты и материалы",
      },
    ],
  },
  {
    key: "fashion",
    icon: "👗",
    nameEn: "Fashion",
    nameKa: "მოდა",
    nameRu: "Мода",
    children: [
      {
        key: "women-fashion",
        icon: "👠",
        nameEn: "Women",
        nameKa: "ქალები",
        nameRu: "Женщины",
      },
      {
        key: "men-fashion",
        icon: "👞",
        nameEn: "Men",
        nameKa: "კაცები",
        nameRu: "Мужчины",
      },
      {
        key: "watches",
        icon: "⌚",
        nameEn: "Watches",
        nameKa: "საათები",
        nameRu: "Часы",
      },
      {
        key: "jewelry",
        icon: "💎",
        nameEn: "Jewelry",
        nameKa: "სამკაული",
        nameRu: "Украшения",
      },
    ],
  },
  {
    key: "collectibles-art",
    icon: "🎨",
    nameEn: "Collectibles & Art",
    nameKa: "კოლექციონირება და ხელოვნება",
    nameRu: "Коллекции и искусство",
    children: [
      {
        key: "trading-cards",
        icon: "🃏",
        nameEn: "Trading Cards",
        nameKa: "საკოლექციო ბარათები",
        nameRu: "Коллекционные карточки",
      },
      {
        key: "art",
        icon: "🖼️",
        nameEn: "Art",
        nameKa: "ხელოვნება",
        nameRu: "Искусство",
      },
      {
        key: "memorabilia",
        icon: "🏆",
        nameEn: "Memorabilia",
        nameKa: "მემორაბილია",
        nameRu: "Памятные предметы",
      },
    ],
  },
  {
    key: "home-garden",
    icon: "🏠",
    nameEn: "Home & Garden",
    nameKa: "სახლი და ბაღი",
    nameRu: "Дом и сад",
    children: [
      {
        key: "furniture",
        icon: "🛋️",
        nameEn: "Furniture",
        nameKa: "ავეჯი",
        nameRu: "Мебель",
      },
      {
        key: "kitchen",
        icon: "🍳",
        nameEn: "Kitchen",
        nameKa: "სამზარეულო",
        nameRu: "Кухня",
      },
      {
        key: "garden",
        icon: "🌿",
        nameEn: "Garden",
        nameKa: "ბაღი",
        nameRu: "Сад",
      },
    ],
  },
  {
    key: "sporting-goods",
    icon: "⚽",
    nameEn: "Sporting Goods",
    nameKa: "სპორტული საქონელი",
    nameRu: "Спортивные товары",
    children: [
      {
        key: "outdoor-sports",
        icon: "🥾",
        nameEn: "Outdoor Sports",
        nameKa: "გარე სპორტი",
        nameRu: "Спорт на открытом воздухе",
      },
      {
        key: "fitness",
        icon: "🏋️",
        nameEn: "Fitness",
        nameKa: "ფიტნესი",
        nameRu: "Фитнес",
      },
      {
        key: "team-sports",
        icon: "🏀",
        nameEn: "Team Sports",
        nameKa: "გუნდური სპორტი",
        nameRu: "Командные виды спорта",
      },
    ],
  },
  {
    key: "toys-hobbies",
    icon: "🧸",
    nameEn: "Toys & Hobbies",
    nameKa: "სათამაშოები და ჰობი",
    nameRu: "Игрушки и хобби",
    children: [
      {
        key: "action-figures",
        icon: "🦸",
        nameEn: "Action Figures",
        nameKa: "ფიგურები",
        nameRu: "Фигурки",
      },
      {
        key: "model-kits",
        icon: "✈️",
        nameEn: "Model Kits",
        nameKa: "ასაწყობი მოდელები",
        nameRu: "Наборы моделей",
      },
      {
        key: "games",
        icon: "🎮",
        nameEn: "Games",
        nameKa: "თამაშები",
        nameRu: "Игры",
      },
    ],
  },
  {
    key: "business-industrial",
    icon: "🏭",
    nameEn: "Business & Industrial",
    nameKa: "ბიზნესი და ინდუსტრია",
    nameRu: "Бизнес и промышленность",
    children: [
      {
        key: "office-supplies",
        icon: "📎",
        nameEn: "Office Supplies",
        nameKa: "საოფისე მარაგები",
        nameRu: "Офисные принадлежности",
      },
      {
        key: "industrial-equipment",
        icon: "⚙️",
        nameEn: "Industrial Equipment",
        nameKa: "სამრეწველო აღჭურვილობა",
        nameRu: "Промышленное оборудование",
      },
    ],
  },
];

async function seedCategories() {
  const [existing] = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing) {
    console.log("Categories already seeded.");
    return;
  }

  const categoryRows: Array<{
    id: string;
    categoryKey: string;
    icon: string;
    name: string;
    nameEn: string;
    nameKa: string;
    nameRu: string;
    slug: string;
    description?: string;
    isActive: boolean;
  }> = [];
  const relationRows: Array<{ parentId: string; childId: string }> = [];

  for (const parent of categorySeeds) {
    const parentId = randomUUID();
    categoryRows.push({
      id: parentId,
      categoryKey: slugify(parent.key),
      icon: parent.icon,
      name: parent.nameEn,
      nameEn: parent.nameEn,
      nameKa: parent.nameKa,
      nameRu: parent.nameRu,
      slug: slugify(parent.nameEn),
      isActive: true,
    });

    for (const child of parent.children) {
      const childId = randomUUID();
      categoryRows.push({
        id: childId,
        categoryKey: slugify(`${parent.key}-${child.key}`),
        icon: child.icon,
        name: child.nameEn,
        nameEn: child.nameEn,
        nameKa: child.nameKa,
        nameRu: child.nameRu,
        slug: slugify(`${parent.nameEn}-${child.nameEn}`),
        isActive: true,
      });
      relationRows.push({ parentId, childId });
    }
  }

  await db.insert(categories).values(categoryRows).onConflictDoNothing();
  if (relationRows.length > 0) {
    await db.insert(categoryRelations).values(relationRows).onConflictDoNothing();
  }

  console.log(`✓ Seeded ${categoryRows.length} categories`);
}

seedCategories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Category seed failed:", err);
    process.exit(1);
  });
