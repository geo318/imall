"use client";

import {
  CreditCard,
  Heart,
  type LucideIcon,
  Package,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Truck,
} from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { type IconNode, useMurmuration } from "./use-murmuration";

type IconPosition = {
  xPct: number;
  yPct?: number;
  edge?: "top" | "bottom";
  icon: string;
};

type HeroLayout = {
  width: number;
  height: number;
};

const EDGE_ICON_OFFSET = 20;
const EDGE_ICON_SIZE = 48;
const TOP_ICON_EXTRA_OFFSET = 50;
const BOTTOM_ICON_EXTRA_OFFSET = -20;
const LAYOUT_EPSILON_PX = 0.5;

const ICON_POSITIONS: IconPosition[] = [
  { xPct: 0.12, yPct: 0.25, icon: "bag" },
  { xPct: 0.88, yPct: 0.2, icon: "tag" },
  { xPct: 0.08, yPct: 0.7, icon: "package" },
  { xPct: 0.92, yPct: 0.65, icon: "heart" },
  { xPct: 0.22, yPct: 0.45, icon: "card" },
  { xPct: 0.78, yPct: 0.42, icon: "star" },
  { xPct: 0.5, edge: "top", icon: "truck" },
  { xPct: 0.5, edge: "bottom", icon: "store" },
];

const ICON_MAP: Record<string, LucideIcon> = {
  bag: ShoppingBag,
  tag: Tag,
  package: Package,
  heart: Heart,
  card: CreditCard,
  star: Star,
  truck: Truck,
  store: Store,
};

export function buildIconNodes(width: number, height: number): IconNode[] {
  const topOffset = EDGE_ICON_OFFSET + TOP_ICON_EXTRA_OFFSET;
  const bottomOffset = Math.max(0, EDGE_ICON_OFFSET + BOTTOM_ICON_EXTRA_OFFSET);
  const topCenterOffset = topOffset + EDGE_ICON_SIZE / 2;
  const bottomCenterOffset = bottomOffset + EDGE_ICON_SIZE / 2;

  return ICON_POSITIONS.map(
    (position): IconNode => ({
      x: position.xPct * width,
      y:
        position.edge === "top"
          ? topCenterOffset
          : position.edge === "bottom"
            ? height - bottomCenterOffset
            : (position.yPct ?? 0.5) * height,
      renderY:
        position.edge === "top"
          ? topOffset
          : position.edge === "bottom"
            ? height - bottomOffset
            : (position.yPct ?? 0.5) * height,
      anchor: position.edge === "top" ? "top" : position.edge === "bottom" ? "bottom" : "center",
      icon: position.icon,
    }),
  );
}

export function areIconNodesEqual(
  previous: ReadonlyArray<IconNode>,
  next: ReadonlyArray<IconNode>,
): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index++) {
    const prev = previous[index] as IconNode;
    const curr = next[index] as IconNode;
    if (
      prev.x !== curr.x ||
      prev.y !== curr.y ||
      prev.renderY !== curr.renderY ||
      prev.anchor !== curr.anchor ||
      prev.icon !== curr.icon
    ) {
      return false;
    }
  }
  return true;
}

export function shouldRecomputeLayout(previous: HeroLayout | null, next: HeroLayout): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.width - next.width) > LAYOUT_EPSILON_PX ||
    Math.abs(previous.height - next.height) > LAYOUT_EPSILON_PX
  );
}

export function resolveIconNodesState(
  previous: ReadonlyArray<IconNode>,
  next: ReadonlyArray<IconNode>,
): ReadonlyArray<IconNode> {
  return areIconNodesEqual(previous, next) ? previous : next;
}

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const lastLayoutRef = useRef<HeroLayout | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  // Provide immediate first render positions so icons don't wait for post-mount measurement.
  const [iconNodes, setIconNodes] = useState<IconNode[]>(() => buildIconNodes(1440, 760));

  const updateIconPositions = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const rect = layer.getBoundingClientRect();
    const nextLayout: HeroLayout = { width: rect.width, height: rect.height };
    if (!shouldRecomputeLayout(lastLayoutRef.current, nextLayout)) {
      return;
    }

    lastLayoutRef.current = nextLayout;
    const nextNodes = buildIconNodes(nextLayout.width, nextLayout.height);
    setIconNodes((previous) => resolveIconNodesState(previous, nextNodes) as IconNode[]);
  }, []);

  useLayoutEffect(() => {
    updateIconPositions();
    window.addEventListener("resize", updateIconPositions);

    return () => {
      window.removeEventListener("resize", updateIconPositions);
    };
  }, [updateIconPositions]);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setPrefersReducedMotion(media.matches);
    };

    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => {
      media.removeEventListener("change", syncPreference);
    };
  }, []);

  useMurmuration(canvasRef, iconNodes);

  return (
    <div ref={layerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="hero-canvas-layer absolute inset-x-0 top-0 h-[100dvh] w-full md:-top-[100px] md:h-[calc(115dvh+100px)]"
        style={{ pointerEvents: "none" }}
      />

      <div className="pointer-events-none absolute inset-0 z-[5]">
        {iconNodes.map((node, index) => {
          const IconComp = ICON_MAP[node.icon];
          if (!IconComp) return null;

          return (
            <div
              key={`${node.icon}-${index}`}
              className="absolute flex items-center justify-center"
              style={{
                left: node.x,
                top: node.renderY ?? node.y,
                transform:
                  node.anchor === "top"
                    ? "translate(-50%, 0%)"
                    : node.anchor === "bottom"
                      ? "translate(-50%, -100%)"
                      : "translate(-50%, -50%)",
              }}
            >
              <div
                className="hero-icon-node group relative"
                style={{
                  animation: prefersReducedMotion
                    ? undefined
                    : `hero-icon-drift-${index % 4} ${6 + (index % 3) * 2}s ease-in-out infinite ${index * 0.6}s`,
                }}
              >
                <div className="animate-pulse-soft absolute inset-0 rounded-full bg-emerald-500/24 blur-md md:blur-lg scale-[1.6] md:scale-[1.85]" />
                <div
                  className="animate-pulse-soft absolute inset-0 rounded-full bg-emerald-500/10 blur-[2px] md:blur-sm scale-105 md:scale-110"
                  style={{ animationDelay: "0.5s" }}
                />
                <div
                  className="animate-pulse-soft shadow-glow relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-50/90 backdrop-blur-[1px] md:backdrop-blur-[2px]"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <IconComp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
