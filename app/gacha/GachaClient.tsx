"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useRef, useState } from "react";

type Props = {
  tagId?: string;
};

type GachaStep =
  | "idle"
  | "bubble_appeared"
  | "result_revealed"
  | "collection";

type GachaReward = {
  id: number;
  name: string;
  imagePlaceholder: string;
};

type Particle = {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  s: number;
  d: number;
};

const GACHA_POOL: GachaReward[] = [
  { id: 1, name: "Aqua Pearl", imagePlaceholder: "[Aqua Pearl Image]" },
  { id: 2, name: "Sky Lagoon", imagePlaceholder: "[Sky Lagoon Image]" },
];

const BUTTON_SPRING = { type: "spring" as const, stiffness: 400, damping: 15 };

const CARD_BURST_TRANSITION = {
  duration: 0.42,
  ease: [0.1, 0.9, 0.2, 1] as const,
};

/** 유리 카드 내부 버튼 영역 기준 — 테두리 파티클 좌표 */
const CARD_FRAME_HW = 172;
const CARD_FRAME_HH = 96;

const DEFAULT_COLLECTED_REWARDS: GachaReward[] = GACHA_POOL.slice(0, 2);

function pickRandomReward(): GachaReward {
  return GACHA_POOL[Math.floor(Math.random() * GACHA_POOL.length)]!;
}

function addRewardToCollection(
  rewards: GachaReward[],
  reward: GachaReward,
): GachaReward[] {
  if (rewards.some((r) => r.id === reward.id)) return rewards;
  return [...rewards, reward];
}

type SwimMotion = {
  x: number[];
  y: number[];
  rotate: number[];
  duration: number;
};

function makeSwimMotion(seed: number): SwimMotion {
  let t = seed + 1;
  const rnd = () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 2 ** 32;
  };

  const x: number[] = [0];
  const y: number[] = [0];
  const rotate: number[] = [0];

  for (let i = 0; i < 4; i++) {
    x.push((rnd() * 2 - 1) * (80 + rnd() * 120));
    y.push((rnd() * 2 - 1) * (50 + rnd() * 90));
    rotate.push((rnd() * 2 - 1) * 8);
  }

  x.push(0);
  y.push(0);
  rotate.push(0);

  return { x, y, rotate, duration: 12 + rnd() * 8 };
}

function makeAquariumPlacement(seed: number) {
  let t = seed + 7;
  const rnd = () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 2 ** 32;
  };

  return {
    left: 12 + rnd() * 68,
    top: 14 + rnd() * 62,
    scale: 0.85 + rnd() * 0.35,
  };
}

function makeParticles(seed: number, count: number): Particle[] {
  let t = seed + 1;
  const rnd = () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 2 ** 32;
  };

  const centerCount = Math.ceil(count * 0.45);
  const frameCount = count - centerCount;
  const particles: Particle[] = [];
  let id = 0;

  for (let i = 0; i < centerCount; i++) {
    const a = rnd() * Math.PI * 2;
    const r = (46 + rnd() * 56) * 1.35;
    particles.push({
      id: id++,
      ox: 0,
      oy: 0,
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.9,
      s: 0.6 + rnd() * 0.8,
      d: 0.75 + rnd() * 0.25,
    });
  }

  for (let i = 0; i < frameCount; i++) {
    const edge = Math.floor(rnd() * 4);
    let ox: number;
    let oy: number;
    let nx: number;
    let ny: number;

    const along = (rnd() * 2 - 1) * 0.92;

    switch (edge) {
      case 0:
        ox = along * CARD_FRAME_HW;
        oy = -CARD_FRAME_HH;
        nx = 0;
        ny = -1;
        break;
      case 1:
        ox = CARD_FRAME_HW;
        oy = along * CARD_FRAME_HH;
        nx = 1;
        ny = 0;
        break;
      case 2:
        ox = along * CARD_FRAME_HW;
        oy = CARD_FRAME_HH;
        nx = 0;
        ny = 1;
        break;
      default:
        ox = -CARD_FRAME_HW;
        oy = along * CARD_FRAME_HH;
        nx = -1;
        ny = 0;
        break;
    }

    const spread = (rnd() - 0.5) * 0.65;
    const out = (40 + rnd() * 70) * 1.55;
    const tx = nx + spread * (ny !== 0 ? 1 : 0);
    const ty = ny + spread * (nx !== 0 ? 1 : 0);
    const len = Math.hypot(tx, ty) || 1;

    particles.push({
      id: id++,
      ox,
      oy,
      x: ox + (tx / len) * out,
      y: oy + (ty / len) * out * 0.92,
      s: 0.7 + rnd() * 0.8,
      d: 0.8 + rnd() * 0.3,
    });
  }

  return particles;
}

function makeBurstParticles(seed: number, count: number): Particle[] {
  let t = seed + 1;
  const rnd = () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 2 ** 32;
  };

  return Array.from({ length: count }).map((_, i) => {
    const a = rnd() * Math.PI * 2;
    const r = 72 + rnd() * 96;
    return {
      id: i,
      ox: 0,
      oy: 0,
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.92,
      s: 0.7 + rnd() * 1.1,
      d: 0.5 + rnd() * 0.35,
    };
  });
}

function ButtonBurstEffects({
  burstKey,
  particles,
}: {
  burstKey: number;
  particles: Particle[];
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      <motion.span
        key={`ripple-${burstKey}`}
        className="pointer-events-none absolute left-1/2 top-[58%] z-0 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={{ scale: 0.1, opacity: 0.8 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(130,240,255,0.4) 50%, transparent 70%)",
        }}
      />
      <span className="pointer-events-none absolute inset-0 z-0 overflow-visible">
        {particles.map((p) => (
          <motion.span
            key={`btn-p-${burstKey}-${p.id}`}
            className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{ x: p.ox, y: p.oy, opacity: 0, scale: 0.2 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: [0, 1, 0],
              scale: [0.2, p.s, 0.05],
            }}
            transition={{ duration: p.d, ease: [0.1, 0.85, 0.25, 1] }}
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,1), rgba(0,210,255,0.65) 70%, transparent)",
              filter: "drop-shadow(0 2px 4px rgba(0,150,255,0.3))",
            }}
          />
        ))}
      </span>
    </div>
  );
}

function MegaBubbleStage({
  isPopping,
  popKey,
  popParticles,
  onPop,
}: {
  isPopping: boolean;
  popKey: number;
  popParticles: Particle[];
  onPop: () => void;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center">
      <p className="aero-subtle relative z-20 mb-8 max-w-xs text-center text-sm drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
        뽕롱뽕롱… 물방울을 터뜨려 결과를 확인하세요
      </p>

      <div className="relative z-10 flex h-[220px] w-[220px] items-center justify-center">
        <motion.div
          className="pointer-events-none absolute inset-0 z-0 rounded-full"
          animate={{ scale: [1, 1.12, 1.05], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(circle, rgba(120,235,255,0.55), rgba(70,150,255,0.15) 55%, transparent 70%)",
            filter: "blur(18px)",
          }}
        />

        <AnimatePresence>
          {!isPopping ? (
            <motion.button
              key="mega-bubble"
              type="button"
              aria-label="물방울 터뜨리기"
              className="relative z-20 h-[200px] w-[200px] cursor-pointer rounded-full border-2 border-white/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/40"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 0.92,
                y: [0, -10, 6, -7, 0],
                x: [0, 7, -5, 4, 0],
                rotate: [0, 2, -2, 1.5, 0],
              }}
              exit={{ scale: 1.45, opacity: 0 }}
              transition={{
                scale: { type: "spring", stiffness: 320, damping: 20 },
                opacity: { duration: 0.2 },
                y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
                x: { duration: 6.2, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 7, repeat: Infinity, ease: "easeInOut" },
              }}
              whileTap={{ scale: 0.94 }}
              onClick={onPop}
              style={{
                background: `
                  radial-gradient(ellipse 55% 45% at 28% 22%, rgba(255,255,255,0.95), transparent 50%),
                  radial-gradient(ellipse 40% 35% at 72% 68%, rgba(120,235,255,0.55), transparent 55%),
                  radial-gradient(circle at 50% 55%, rgba(80,200,255,0.95) 0%, rgba(40,140,220,0.92) 45%, rgba(20,90,180,0.88) 100%)
                `,
                boxShadow: `
                  0 0 0 1px rgba(255,255,255,0.35) inset,
                  0 24px 48px rgba(0,40,90,0.45),
                  0 8px 24px rgba(80,220,255,0.35),
                  inset 0 -12px 28px rgba(0,60,120,0.35),
                  inset 0 8px 20px rgba(255,255,255,0.4)
                `,
                filter: "drop-shadow(0 12px 28px rgba(0,80,140,0.4))",
              }}
            >
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-full"
                animate={{
                  borderRadius: [
                    "50%",
                    "48% 52% 50% 48%",
                    "52% 48% 51% 49%",
                    "49% 51% 48% 52%",
                    "50%",
                  ],
                  scaleX: [1, 1.04, 0.97, 1.02, 1],
                  scaleY: [1, 0.97, 1.03, 0.98, 1],
                }}
                transition={{
                  duration: 5.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  background:
                    "radial-gradient(ellipse 70% 50% at 35% 18%, rgba(255,255,255,0.5), transparent 55%)",
                  mixBlendMode: "screen",
                }}
              />
              <span className="sr-only">가챠 결과 물방울</span>
            </motion.button>
          ) : (
            <motion.div
              key="bubble-burst"
              className="absolute left-1/2 top-1/2 z-20 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2"
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.7), rgba(120,235,255,0.4) 40%, transparent 70%)",
                  filter: "blur(4px)",
                }}
              />
              <span className="pointer-events-none absolute inset-0">
                {popParticles.map((p) => (
                  <motion.span
                    key={`pop-p-${popKey}-${p.id}`}
                    className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    initial={{ x: p.ox, y: p.oy, opacity: 0, scale: 0.2 }}
                    animate={{
                      x: p.x,
                      y: p.y,
                      opacity: [0, 0.95, 0],
                      scale: [0.2, p.s, 0.1],
                    }}
                    transition={{ duration: p.d, ease: [0.12, 0.8, 0.2, 1] }}
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(80,220,255,0.55) 72%, transparent)",
                    }}
                  />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SwimmingRewardItem({
  reward,
  seed,
}: {
  reward: GachaReward;
  seed: number;
}) {
  const swim = useMemo(() => makeSwimMotion(seed), [seed]);
  const placement = useMemo(() => makeAquariumPlacement(seed), [seed]);

  return (
    <motion.div
      className="pointer-events-none absolute z-10 flex flex-col items-center gap-2"
      style={{
        left: `${placement.left}%`,
        top: `${placement.top}%`,
        scale: placement.scale,
      }}
      animate={{
        x: swim.x,
        y: swim.y,
        rotate: swim.rotate,
      }}
      transition={{
        duration: swim.duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <div className="flex h-20 w-28 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-cyan-400/25 via-sky-500/15 to-blue-600/25 px-2 text-center text-xs font-medium text-white/85 shadow-[0_8px_32px_rgba(0,80,160,0.25)] backdrop-blur-sm">
        {reward.imagePlaceholder}
      </div>
      <span className="aero-subtle text-xs font-semibold tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
        {reward.name}
      </span>
    </motion.div>
  );
}

function AquariumCollectionView({
  rewards,
  onDrawAgain,
}: {
  rewards: GachaReward[];
  onDrawAgain: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 overflow-hidden"
      aria-label="수족관 컬렉션"
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(60,180,255,0.12), transparent 70%)",
        }}
      />

      {rewards.map((reward, index) => (
        <SwimmingRewardItem
          key={reward.id}
          reward={reward}
          seed={reward.id * 97 + index * 13}
        />
      ))}

      {rewards.length === 0 && (
        <p className="aero-subtle absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-sm">
          아직 수집한 아이템이 없어요. 가챠를 뽑아 보세요!
        </p>
      )}

      <motion.button
        type="button"
        className="aero-button absolute bottom-6 left-6 z-40 px-4 py-2 text-sm"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.95 }}
        transition={BUTTON_SPRING}
        onClick={onDrawAgain}
      >
        다시 뽑기
      </motion.button>
    </div>
  );
}

function StageHeader({ tagId }: { tagId?: string }) {
  return (
    <div className="mb-5 space-y-1">
      <div className="aero-title text-xl font-semibold tracking-tight">
        Gacha Capsule Exchange
      </div>
      <div className="aero-subtle text-sm">
        태그:{" "}
        <span className="font-mono text-white/90">{tagId ?? "unknown"}</span>
      </div>
    </div>
  );
}

export default function GachaClient({ tagId }: Props) {
  const [gachaStep, setGachaStep] = useState<GachaStep>("idle");
  const [selectedReward, setSelectedReward] = useState<GachaReward | null>(null);
  const [collectedRewards, setCollectedRewards] = useState<GachaReward[]>(
    DEFAULT_COLLECTED_REWARDS,
  );
  const [buttonBurstKey, setButtonBurstKey] = useState(0);
  const [collectionBurstKey, setCollectionBurstKey] = useState(0);
  const [bubblePopKey, setBubblePopKey] = useState(0);
  const [buttonCooldown, setButtonCooldown] = useState(false);
  const [isPoppingBubble, setIsPoppingBubble] = useState(false);
  const [idleCardVisible, setIdleCardVisible] = useState(true);
  const [resultCardVisible, setResultCardVisible] = useState(true);
  const pendingBubbleRef = useRef(false);
  const pendingCollectionRef = useRef(false);

  const showButtonBurst = buttonBurstKey > 0;

  const buttonParticles = useMemo(
    () => (buttonBurstKey > 0 ? makeParticles(buttonBurstKey, 18) : []),
    [buttonBurstKey],
  );

  const collectionButtonParticles = useMemo(
    () =>
      collectionBurstKey > 0 ? makeParticles(collectionBurstKey, 18) : [],
    [collectionBurstKey],
  );

  const showCollectionBurst = collectionBurstKey > 0;

  const bubblePopParticles = useMemo(
    () =>
      gachaStep === "bubble_appeared" && isPoppingBubble
        ? makeBurstParticles(bubblePopKey, 16)
        : [],
    [bubblePopKey, gachaStep, isPoppingBubble],
  );

  const finishCardBurst = useCallback(() => {
    if (!pendingBubbleRef.current) return;
    pendingBubbleRef.current = false;
    setGachaStep("bubble_appeared");
    setButtonCooldown(false);
  }, []);

  const finishResultCardBurst = useCallback(() => {
    if (!pendingCollectionRef.current) return;
    pendingCollectionRef.current = false;
    setGachaStep("collection");
    setResultCardVisible(true);
  }, []);

  const handleDrawClick = () => {
    if (buttonCooldown || gachaStep !== "idle" || !idleCardVisible) return;
    setButtonCooldown(true);
    setSelectedReward(pickRandomReward());
    setButtonBurstKey((k) => k + 1);
    pendingBubbleRef.current = true;
    setIdleCardVisible(false);
    window.setTimeout(() => finishCardBurst(), 460);
  };

  const handleBubblePop = () => {
    if (isPoppingBubble || gachaStep !== "bubble_appeared") return;
    setIsPoppingBubble(true);
    setBubblePopKey((k) => k + 1);
    window.setTimeout(() => {
      setGachaStep("result_revealed");
      setIsPoppingBubble(false);
      setResultCardVisible(true);
      if (selectedReward) {
        setCollectedRewards((prev) =>
          addRewardToCollection(prev, selectedReward),
        );
      }
    }, 520);
  };

  const handleGoToCollection = () => {
    if (gachaStep !== "result_revealed" || !resultCardVisible) return;
    setCollectionBurstKey((k) => k + 1);
    pendingCollectionRef.current = true;
    setResultCardVisible(false);
    window.setTimeout(() => finishResultCardBurst(), 460);
  };

  const handleDrawAgain = () => {
    setGachaStep("idle");
    setIdleCardVisible(true);
    setResultCardVisible(true);
    setButtonCooldown(false);
    setSelectedReward(null);
    pendingBubbleRef.current = false;
    pendingCollectionRef.current = false;
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {gachaStep === "idle" && (
          <motion.div
            key="idle-glass-card"
            className="relative w-full max-w-md origin-center overflow-visible"
            initial={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            animate={
              idleCardVisible
                ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                : {
                    opacity: [1, 0.92, 0],
                    scale: [1, 1.12, 1.4],
                    filter: ["blur(0px)", "blur(2px)", "blur(4px)"],
                  }
            }
            exit={{ scale: 1.4, opacity: 0, filter: "blur(4px)" }}
            transition={CARD_BURST_TRANSITION}
          >
            {showButtonBurst && (
              <ButtonBurstEffects
                burstKey={buttonBurstKey}
                particles={buttonParticles}
              />
            )}

            <motion.div
              className="aero-glass relative overflow-visible px-6 py-7"
              animate={
                idleCardVisible
                  ? { scale: 1 }
                  : { scale: [1, 0.97, 1.08] }
              }
              transition={
                idleCardVisible
                  ? { duration: 0 }
                  : { duration: 0.42, ease: [0.1, 0.9, 0.2, 1] }
              }
            >
              <StageHeader tagId={tagId} />
              <div className="relative isolate flex min-h-[260px] items-center justify-center overflow-visible">
                <motion.button
                  type="button"
                  className="aero-button relative z-20 w-full"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={BUTTON_SPRING}
                  onClick={handleDrawClick}
                >
                  <span className="relative z-10">가챠 교환권 뽑기 1회!</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {gachaStep === "bubble_appeared" && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center px-6"
          aria-label="가챠 물방울 대기"
        >
          <MegaBubbleStage
            isPopping={isPoppingBubble}
            popKey={bubblePopKey}
            popParticles={bubblePopParticles}
            onPop={handleBubblePop}
          />
        </div>
      )}

      {gachaStep === "result_revealed" && selectedReward && (
        <motion.div
          key="result-glass-card"
          className="relative w-full max-w-md origin-center overflow-visible"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={
            resultCardVisible
              ? { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
              : {
                  opacity: [1, 0.92, 0],
                  scale: [1, 1.12, 1.4],
                  filter: ["blur(0px)", "blur(2px)", "blur(4px)"],
                  y: 0,
                }
          }
          transition={
            resultCardVisible ? BUTTON_SPRING : CARD_BURST_TRANSITION
          }
        >
          {showCollectionBurst && (
            <ButtonBurstEffects
              burstKey={collectionBurstKey}
              particles={collectionButtonParticles}
            />
          )}

          <motion.div
            className="aero-glass relative overflow-visible px-6 py-7"
            animate={
              resultCardVisible ? { scale: 1 } : { scale: [1, 0.97, 1.08] }
            }
            transition={
              resultCardVisible
                ? { duration: 0 }
                : { duration: 0.42, ease: [0.1, 0.9, 0.2, 1] }
            }
          >
            <motion.p
              className="aero-subtle mb-5 text-center text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              가챠 결과 공개!
            </motion.p>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-28 w-full max-w-xs items-center justify-center rounded-2xl border border-white/25 bg-gradient-to-br from-cyan-400/30 via-sky-500/20 to-blue-600/30 text-lg font-medium text-white/80 backdrop-blur-md">
                {selectedReward.imagePlaceholder}
              </div>
              <h2 className="aero-title mb-6 text-2xl font-bold tracking-tight">
                {selectedReward.name}
              </h2>

              <motion.button
                type="button"
                className="aero-button relative z-20 w-full"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
                transition={BUTTON_SPRING}
                onClick={handleGoToCollection}
              >
                <span className="relative z-10">수족관 컬렉션 가기</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {gachaStep === "collection" && (
        <AquariumCollectionView
          rewards={collectedRewards}
          onDrawAgain={handleDrawAgain}
        />
      )}
    </>
  );
}