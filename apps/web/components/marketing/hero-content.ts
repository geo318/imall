export type HeroFeatureId = "verified" | "shipping" | "protection";

export type HeroFeature = {
  id: HeroFeatureId;
  titleKey:
    | "home.hero.features.verified.title"
    | "home.hero.features.shipping.title"
    | "home.hero.features.protection.title";
  bodyKey:
    | "home.hero.features.verified.body"
    | "home.hero.features.shipping.body"
    | "home.hero.features.protection.body";
};

export const HERO_FEATURES: HeroFeature[] = [
  {
    id: "verified",
    titleKey: "home.hero.features.verified.title",
    bodyKey: "home.hero.features.verified.body",
  },
  {
    id: "shipping",
    titleKey: "home.hero.features.shipping.title",
    bodyKey: "home.hero.features.shipping.body",
  },
  {
    id: "protection",
    titleKey: "home.hero.features.protection.title",
    bodyKey: "home.hero.features.protection.body",
  },
];
