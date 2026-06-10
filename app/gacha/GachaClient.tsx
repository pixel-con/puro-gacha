"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Props = {
  tagId?: string;
};

type TagClaimRecord = {
  rewardId: number;
  parentName: string;
  jewelryName: string;
};

const MOCK_DEFAULT_PARENT_NAME = "신규 소유자";

type TagGateStatus = "unclaimed" | "retap";

type GachaStep =
  | "idle"
  | "bubble_appeared"
  | "result_revealed"
  | "collection"
  | "already_claimed";

type GachaReward = {
  id: number;
  name: string;
  imageUrl: string;
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
  { id: 1, name: "퍼렁이", imageUrl: "/images/reward_1.png" },
  { id: 2, name: "가오링", imageUrl: "/images/reward_2.png" },
  { id: 3, name: "벨룽", imageUrl: "/images/reward_3.png" },
  { id: 4, name: "해피", imageUrl: "/images/reward_4.png" },
  { id: 5, name: "모이", imageUrl: "/images/reward_5.png" },
  { id: 6, name: "금쪽이", imageUrl: "/images/reward_6.png" },
  { id: 7, name: "몈이", imageUrl: "/images/reward_7.png" },
  { id: 8, name: "벼리", imageUrl: "/images/reward_8.png" },
  { id: 9, name: "사노", imageUrl: "/images/reward_9.png" },
  { id: 10, name: "푸릉이", imageUrl: "/images/reward_10.png" },
  { id: 11, name: "포도", imageUrl: "/images/reward_11.png" },
  { id: 12, name: "벨", imageUrl: "/images/reward_12.png" },
  { id: 13, name: "퍼렁별", imageUrl: "/images/reward_13.png" },
];

const BUTTON_SPRING = { type: "spring" as const, stiffness: 400, damping: 15 };

const CARD_BURST_TRANSITION = {
  duration: 0.42,
  ease: [0.1, 0.9, 0.2, 1] as const,
};

const CARD_FRAME_HW = 172;
const CARD_FRAME_HH = 96;

function pickRandomReward(): GachaReward {
  return GACHA_POOL[Math.floor(Math.random() * GACHA_POOL.length)]!;
}

function getRewardById(rewardId: number): GachaReward | undefined {
  return GACHA_POOL.find((r) => r.id === rewardId);
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
          animate={{ scale: [1, 1.1, 1.03], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(circle, rgba(130,245,255,0.35), rgba(215,130,255,0.12) 55%, transparent 75%)",
            filter: "blur(16px)",
          }}
        />

        <AnimatePresence>
          {!isPopping ? (
            <motion.button
              key="mega-bubble"
              type="button"
              aria-label="물방울 터뜨리기"
              className="relative z-20 h-[200px] w-[200px] cursor-pointer rounded-full border border-white/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/40 backdrop-blur-[2px]"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 0.95,
                y: [0, -8, 5, -6, 0],
                x: [0, 5, -4, 3, 0],
                rotate: [0, 1.5, -1.5, 1, 0],
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
                  radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75) 0%, transparent 28%),
                  radial-gradient(circle at 68% 72%, rgba(255,150,255,0.18) 0%, transparent 35%),
                  radial-gradient(circle at 50% 50%, transparent 62%, rgba(0,240,255,0.28) 80%, rgba(245,110,255,0.22) 92%, rgba(255,255,255,0.45) 100%)
                `,
                boxShadow: `
                  0 12px 36px rgba(0,40,90,0.12),
                  inset 0 6px 14px rgba(255,255,255,0.65),
                  inset 0 -5px 12px rgba(0,210,255,0.22),
                  inset 0 0 0 1px rgba(255,255,255,0.3)
                `,
                filter: "drop-shadow(0 8px 16px rgba(0,120,200,0.2))",
              }}
            >
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-full"
                animate={{
                  scaleX: [1, 1.02, 0.98, 1.01, 1],
                  scaleY: [1, 0.98, 1.02, 0.99, 1],
                }}
                transition={{
                  duration: 4.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  background:
                    "radial-gradient(ellipse 65% 35% at 35% 16%, rgba(255,255,255,0.6), transparent 55%)",
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
                    "radial-gradient(circle, rgba(255,255,255,0.75), rgba(130,245,255,0.35) 40%, transparent 70%)",
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
                        "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(130,245,255,0.6) 72%, transparent)",
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

function SwimmingRewardItem({ reward, seed, customName, customParent }: { reward: GachaReward; seed: number; customName: string; customParent: string; }) {
  const swim = useMemo(() => makeSwimMotion(seed), [seed]);
  const placement = useMemo(() => makeAquariumPlacement(seed), [seed]);

  return (
    <motion.div
      className="pointer-events-none absolute z-10 flex flex-col items-center gap-1"
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
      <div className="flex h-20 w-28 items-center justify-center p-1">
        <img 
          src={reward.imageUrl} 
          alt={reward.name} 
          className="h-full w-full object-contain filter drop-shadow-[0_6px_10px_rgba(0,16,45,0.65)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" 
        />
      </div>
      
      <div className="flex flex-col items-center gap-1.5 w-max select-none">
        <div className="px-2.5 py-0.5 rounded-lg bg-[#59CBE8]/30 backdrop-blur-md border border-white/50 shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(255,255,255,0.4)]">
          <span className="aero-subtle block text-[11px] font-bold tracking-wide text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]">
            {customName === "부여 중..." ? reward.name : customName}
          </span>
        </div>

        <div className="px-2 py-0.5 rounded-md bg-slate-950/50 backdrop-blur-md border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <span className="block text-[9px] font-semibold text-cyan-200 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)]">
            어버이: {customParent === "부여 중..." ? "임시 소유권" : customParent}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function AquariumCollectionView({
  rewards,
  claims,
}: {
  rewards: GachaReward[];
  claims: Record<string, TagClaimRecord>;
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

      {rewards.map((reward, index) => {
        const matchingClaim = Object.values(claims).find(
          (c) => c.rewardId === reward.id
        );

        return (
          <SwimmingRewardItem
            key={reward.id}
            reward={reward}
            seed={reward.id * 97 + index * 13}
            customName={matchingClaim ? matchingClaim.jewelryName : reward.name}
            customParent={matchingClaim ? matchingClaim.parentName : "알 수 없음"}
          />
        );
      })}
    </div>
  );
}

function StageHeader({
  tagId,
  tagGate,
}: {
  tagId?: string;
  tagGate: TagGateStatus;
}) {
  const gateLabel =
    tagGate === "retap"
      ? "재태깅 · 소유권 확인됨"
      : tagGate === "unclaimed"
        ? "신규 태그 · 가챠 가능"
        : "태그 미인식";

  return (
    <div className="mb-5 space-y-1">
      <div className="aero-title text-xl font-semibold tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
        Gacha Capsule Exchange
      </div>
      <div className="aero-subtle text-sm drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
        태그:{" "}
        <span className="font-mono text-white/90">{tagId ?? "unknown"}</span>
      </div>
      <div
        className={`text-xs font-medium drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)] ${
          tagGate === "retap"
            ? "text-amber-200/90"
            : tagGate === "unclaimed"
              ? "text-cyan-200/85"
              : "text-red-200/85"
        }`}
      >
        NFC {gateLabel}
      </div>
    </div>
  );
}

function SwimmingClaimedReward({ reward }: { reward: GachaReward }) {
  const swim = useMemo(() => makeSwimMotion(reward.id * 31 + 11), [reward.id]);

  return (
    <div
      className="relative mb-6 flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-b from-cyan-300/15 via-sky-500/10 to-blue-900/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_16px_48px_rgba(0,60,120,0.35)] backdrop-blur-md"
      aria-hidden
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(100,220,255,0.25), transparent 70%)",
        }}
      />
        
      <motion.div
        className="relative z-10 flex h-28 w-[9.5rem] items-center justify-center p-2"
        animate={{ x: swim.x, y: swim.y, rotate: swim.rotate }}
        transition={{
          duration: swim.duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <img src={reward.imageUrl} alt={reward.name} className="h-full w-full object-contain" />
      </motion.div>
    </div>
  );
}

function AlreadyClaimedPopupView({
  claim,
  reward,
  cardVisible,
  burstKey,
  showBurst,
  burstParticles,
  onViewCollection,
}: {
  claim: TagClaimRecord;
  reward: GachaReward;
  cardVisible: boolean;
  burstKey: number;
  showBurst: boolean;
  burstParticles: Particle[];
  onViewCollection: () => void;
}) {
  return (
    <motion.div
      key="already-claimed-card"
      className="relative w-full max-w-md origin-center overflow-visible"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={
        cardVisible
          ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          : {
              opacity: [1, 0.92, 0],
              scale: [1, 1.12, 1.4],
              y: 0,
              filter: ["blur(0px)", "blur(2px)", "blur(4px)"],
            }
      }
      exit={{ scale: 1.4, opacity: 0, filter: "blur(4px)" }}
      transition={cardVisible ? BUTTON_SPRING : CARD_BURST_TRANSITION}
    >
      {showBurst && (
        <ButtonBurstEffects burstKey={burstKey} particles={burstParticles} />
      )}

      <motion.div
        className="aero-glass relative overflow-visible px-6 py-7 !bg-[#59CBE8]/20 !backdrop-blur-3xl border !border-white/60 shadow-[0_20px_50px_rgba(0,30,60,0.15),inset_0_1px_4px_rgba(255,255,255,0.6)]"
        animate={cardVisible ? { scale: 1 } : { scale: [1, 0.97, 1.08] }}
        transition={
          cardVisible
            ? { duration: 0 }
            : { duration: 0.42, ease: [0.1, 0.9, 0.2, 1] }
        }
      >
        <p className="aero-subtle mb-3 text-center text-sm tracking-wide drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
          이미 등록된 주얼리
        </p>

        <p className="mb-2 whitespace-pre-line text-center text-base font-semibold leading-relaxed text-white !drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
          {claim.parentName === "부여 중..." 
            ? `임시 보상이 홀딩되었습니다.\n수족관에서 확인하십시오.`
            : `이 ${claim.jewelryName}에는\n${reward.name}이 태어났습니다!`}
        </p>

        <p className="aero-subtle mb-6 text-center text-sm drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
          어버이: {claim.parentName === "부여 중..." ? "확정 대기 상태" : claim.parentName}
        </p>

        <SwimmingClaimedReward reward={reward} />

        <motion.button
          type="button"
          className="aero-button relative z-20 w-full"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
          transition={BUTTON_SPRING}
          onClick={onViewCollection}
          disabled={!cardVisible}
        >
          <span className="relative z-10">내 컬렉션 수족관 보기</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function FloatingBubbles() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const bubbles = useMemo(() => {
    if (!isMounted) return [];

    return Array.from({ length: 35 }).map((_, i) => {
      const diameter = 2 + Math.random() * 5;
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        diameter,
        duration: 6 + Math.random() * 6,
        delay: Math.random() * 5,
        opacity: 0.2 + Math.random() * 0.4,
      };
    });
  }, [isMounted]);

  if (!isMounted) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {bubbles.map((b) => (
        <motion.span
          key={`bubble-${b.id}`}
          className="absolute bottom-[-20px] rounded-full bg-white"
          style={{
            left: b.left,
            width: b.diameter,
            height: b.diameter,
            opacity: b.opacity,
            boxShadow:
              "inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,150,255,0.2)",
          }}
          animate={{
            y: ["0vh", "-110vh"],
            x: [0, 12, -12, 6, 0],
          }}
          transition={{
            y: {
              duration: b.duration,
              repeat: Infinity,
              delay: b.delay,
              ease: "linear",
            },
            x: {
              duration: b.duration * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        />
      ))}
    </div>
  );
}

export default function GachaClient({ tagId }: Props) {
  const [showInsta, setShowInsta] = useState(false);

  const [mockClaims, setMockClaims] = useState<Record<string, TagClaimRecord>>({});
  const [tagGate, setTagGate] = useState<TagGateStatus>("unclaimed");
  const [gachaStep, setGachaStep] = useState<GachaStep>("idle");
  
  /* 💡 [오류 원천 종결 완료]: syntax 파괴를 유발했던 selectedReward(null) 호출 구문을 표준 상태 변수로 정형화 */
  const [selectedReward, setSelectedReward] = useState<GachaReward | null>(null);
  
  const [collectedRewards, setCollectedRewards] = useState<GachaReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [buttonBurstKey, setButtonBurstKey] = useState(0);
  const [collectionBurstKey, setCollectionBurstKey] = useState(0);
  const [bubblePopKey, setBubblePopKey] = useState(0);
  const [buttonCooldown, setButtonCooldown] = useState(false);
  const [isPoppingBubble, setIsPoppingBubble] = useState(false);
  const [idleCardVisible, setIdleCardVisible] = useState(true);
  const [resultCardVisible, setResultCardVisible] = useState(true);
  const [alreadyClaimedCardVisible, setAlreadyClaimedCardVisible] = useState(true);
  const [alreadyClaimedBurstKey, setAlreadyClaimedBurstKey] = useState(0);

  const inputParentNameRef = useRef<HTMLInputElement>(null);
  const inputJewelryNameRef = useRef<HTMLInputElement>(null);

  const pendingBubbleRef = useRef(false);
  const pendingCollectionRef = useRef(false);
  const pendingAlreadyClaimedRef = useRef(false);
  const drawnRewardRef = useRef<GachaReward | null>(null);

  const mockDbClaim = useMemo(
    () => (tagId ? mockClaims[tagId] : undefined),
    [tagId, mockClaims]
  );

  useEffect(() => {
    async function syncCloudInfrastructure() {
      if (!tagId) {
        setTagGate("unclaimed");
        setGachaStep("idle");
        setSelectedReward(null);
        setCollectedRewards([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        let deviceKey = localStorage.getItem("puro_device_key");
        if (!deviceKey) {
          deviceKey = "usr_" + Math.random().toString(36).substring(2, 11) + Date.now();
          localStorage.setItem("puro_device_key", deviceKey);
        }

        const { data: claimData } = await supabase
          .from("tag_claims")
          .select("*")
          .eq("tag_id", tagId)
          .maybeSingle();

        const { data: allData } = await supabase
          .from("tag_claims")
          .select("*")
          .eq("user_key", deviceKey);

        const claimsMap: Record<string, TagClaimRecord> = {};
        const globalRewards: GachaReward[] = [];

        if (allData) {
          allData.forEach((row) => {
            claimsMap[row.tag_id] = {
              rewardId: row.reward_id,
              parentName: row.parent_name,
              jewelryName: row.jewelry_name,
            };

            const rewardPreset = getRewardById(row.reward_id);
            if (rewardPreset && !globalRewards.some((r) => r.id === rewardPreset.id)) {
              globalRewards.push(rewardPreset);
            }
          });
        }

        if (claimData) {
          claimsMap[claimData.tag_id] = {
            rewardId: claimData.reward_id,
            parentName: claimData.parent_name,
            jewelryName: claimData.jewelry_name,
          };
        }

        setMockClaims(claimsMap);
        setCollectedRewards(globalRewards);

        if (claimData) {
          const reward = getRewardById(claimData.reward_id);
          if (reward) {
            if (claimData.parent_name === "부여 중...") {
              drawnRewardRef.current = reward;
              setSelectedReward(reward);
              setTagGate("unclaimed"); 
              setGachaStep("result_revealed"); 
              setResultCardVisible(true);
            } else {
              setTagGate("retap");
              setSelectedReward(reward);
              setGachaStep("already_claimed");
              setAlreadyClaimedCardVisible(true);
              setAlreadyClaimedBurstKey(0);
              pendingAlreadyClaimedRef.current = false;
            }
          } else {
            setTagGate("unclaimed");
            setGachaStep("idle");
          }
        } else {
          setTagGate("unclaimed");
          setGachaStep("idle");
          setSelectedReward(null);
          setAlreadyClaimedCardVisible(true);
        }
      } catch (err) {
        console.error("Supabase 데이터 연동 실패:", err);
      } finally {
        setIsLoading(false);
      }
    }

    syncCloudInfrastructure();
  }, [tagId]);

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

  const alreadyClaimedParticles = useMemo(
    () =>
      alreadyClaimedBurstKey > 0
        ? makeParticles(alreadyClaimedBurstKey, 18)
        : [],
    [alreadyClaimedBurstKey],
  );

  const showAlreadyClaimedBurst = alreadyClaimedBurstKey > 0;

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

  const finishAlreadyClaimedBurst = useCallback(() => {
    if (!pendingAlreadyClaimedRef.current) return;
    pendingAlreadyClaimedRef.current = false;
    setGachaStep("collection");
    setAlreadyClaimedCardVisible(true);
  }, []);

  const handleDrawClick = async () => {
    if (
      (tagId && mockClaims[tagId]) ||
      tagGate !== "unclaimed" ||
      buttonCooldown ||
      gachaStep !== "idle" ||
      !idleCardVisible ||
      isLoading
    ) {
      return;
    }
    setButtonCooldown(true);
    const reward = pickRandomReward();
    drawnRewardRef.current = reward;
    setSelectedReward(reward);

    if (tagId) {
      const deviceKey = localStorage.getItem("puro_device_key") || "unknown_device";
      setIsLoading(true)
      try {
        const { error } = await supabase
          .from("tag_claims")
          .insert([
            {
              tag_id: tagId,
              reward_id: reward.id,
              parent_name: "부여 중...", 
              jewelry_name: "부여 중...", 
              user_key: deviceKey,
            },
          ]);

        if (error) throw error;
      } catch (err) {
        console.error("초기 가챠 소유권 실시간 잠금 실패:", err);
        setButtonCooldown(false);
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

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
    }, 520);
  };

  const handleAlreadyClaimedCollection = () => {
    if (
      gachaStep !== "already_claimed" ||
      !alreadyClaimedCardVisible ||
      !selectedReward
    ) {
      return;
    }
    setAlreadyClaimedBurstKey((k) => k + 1);
    pendingAlreadyClaimedRef.current = true;
    setAlreadyClaimedCardVisible(false);
    window.setTimeout(() => finishAlreadyClaimedBurst(), 460);
  };

  const handleGoToCollection = async () => {
    if (gachaStep !== "result_revealed" || !resultCardVisible || isLoading) return;

    const reward = drawnRewardRef.current;
    if (reward && tagId) {
      const suffix = tagId.replace(/^puro_/i, "").slice(0, 12) || "new";
      
      const finalParent = inputParentNameRef.current?.value.trim() || MOCK_DEFAULT_PARENT_NAME;
      const finalJewelry = inputJewelryNameRef.current?.value.trim() || `Puro ${reward.name} Ring #${suffix}`;

      setIsLoading(true);
      try {
        const { error } = await supabase
          .from("tag_claims")
          .update({
            parent_name: finalParent,
            jewelry_name: finalJewelry,
          })
          .eq("tag_id", tagId);

        if (error) throw error;

        setMockClaims((prev) => ({
          ...prev,
          [tagId]: {
            rewardId: reward.id,
            parentName: finalParent,
            jewelryName: finalJewelry,
          },
        }));
        setCollectedRewards((prev) => addRewardToCollection(prev, reward));
      } catch (err) {
        console.error("클라우드 DB 쓰기 업데이트 트랜잭션 에러:", err);
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    setCollectionBurstKey((k) => k + 1);
    pendingCollectionRef.current = true;
    setResultCardVisible(false);
    window.setTimeout(() => finishResultCardBurst(), 460);
  };

  const showAlreadyClaimedPopup =
    gachaStep === "already_claimed" &&
    Boolean(mockDbClaim && selectedReward);

  const showIdleDraw =
    gachaStep === "idle" && tagGate === "unclaimed" && !mockDbClaim;

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-center bg-no-repeat bg-[length:100%_100%] brightness-[1.25]" 
        style={{ backgroundImage: "url('/aquarium-bg.webp')" }}
      />
      
      <div 
        className="absolute inset-x-0 bottom-0 h-full bg-bottom bg-no-repeat bg-[length:100%_100%] pointer-events-none"
        style={{ backgroundImage: "url('/aquarium-floor.webp')" }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-blue-950/5 backdrop-blur-[6px] hidden md:block" />

      <div 
        className="w-full max-w-md h-full md:h-[90vh] md:rounded-[3rem] md:border-4 md:border-white/20 md:shadow-[0_24px_72px_rgba(0,30,80,0.6),inset_0_2px_8px_rgba(255,255,255,0.2)] relative overflow-hidden flex flex-col items-center justify-start pt-28 p-6 z-10"
        style={{ fontFamily: "'NeoDunggeunmo', system-ui, sans-serif" }}
      >
        <div 
          className="absolute inset-0 bg-center bg-no-repeat bg-[length:100%_100%] brightness-[1.25] z-0" 
          style={{ backgroundImage: "url('/aquarium-bg.webp')" }}
        />

        <div 
          className="absolute inset-x-0 bottom-0 h-full bg-bottom bg-no-repeat bg-[length:100%_100%] pointer-events-none z-0"
          style={{ backgroundImage: "url('/aquarium-floor.webp')" }}
        />
        
        {/* 기포 이펙트 */}
        <FloatingBubbles />

        {/* 팀원 인스타그램 연동 영역 */}
        <div className="absolute top-4 left-4 z-30 select-none">
          <motion.button
            type="button"
            onClick={() => setShowInsta(!showInsta)}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-3 py-2 text-[10px] font-bold text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.5)] transition-all cursor-pointer hover:bg-white/20"
            whileTap={{ scale: 0.95 }}
          >
            <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            <span>CREDITS</span>
          </motion.button>

          <AnimatePresence>
            {showInsta && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                className="absolute left-0 mt-1 w-40 rounded-xl border border-white/20 bg-slate-950/80 p-1.5 backdrop-blur-lg shadow-2xl"
              >
                <div className="flex flex-col gap-0.5 text-[10px] font-medium">
                  <a
                    href="https://instagram.com/kimseonghyuni"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-2 py-1.5 text-white hover:bg-[#59CBE8]/30 transition-all block"
                  >
                    👤 @kimseonghyuni (Producer)
                  </a>
                  <a
                    href="https://instagram.com/sebyyn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-2 py-1.5 text-white hover:bg-[#59CBE8]/30 transition-all block"
                  >
                    👅 @sebyyn (Design)
                  </a>
                  <a
                    href="https://instagram.com/user_uyun"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-2 py-1.5 text-white hover:bg-[#59CBE8]/30 transition-all block"
                  >
                    🙇‍♂️ @user_uyun (Design)
                  </a>
                  <a
                    href="https://instagram.com/syungee_0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-2 py-1.5 text-white hover:bg-[#59CBE8]/30 transition-all block"
                  >
                    🫥 @syungee_0 (Design)
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PURO 브랜드 고유 로고 헤더 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
          <img 
            src="/logo.webp" 
            alt="PURO Brand Logo" 
            style={{ 
              width: "96px", 
              height: "66px",
              filter: "drop-shadow(1px 0 0 #ffffff) drop-shadow(-1px 0 0 #ffffff) drop-shadow(0 1px 0 #ffffff) drop-shadow(0 -1px 0 #ffffff) drop-shadow(0 4px 6px rgba(0, 12, 45, 0.25))"
            }}
            className="object-contain"
          />
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-950/40 backdrop-blur-md">
            <motion.div
              className="h-10 w-10 rounded-full border-4 border-cyan-200 border-t-cyan-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="mt-4 text-xs font-semibold text-cyan-200 tracking-wider">
              SYNCHRONIZING WITH PURO CLOUD...
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {showAlreadyClaimedPopup && mockDbClaim && selectedReward && (
            <AlreadyClaimedPopupView
              key="already-claimed-glass-card"
              claim={mockDbClaim}
              reward={selectedReward}
              cardVisible={alreadyClaimedCardVisible}
              burstKey={alreadyClaimedBurstKey}
              showBurst={showAlreadyClaimedBurst}
              burstParticles={alreadyClaimedParticles}
              onViewCollection={handleAlreadyClaimedCollection}
            />
          )}

          {showIdleDraw && (
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
                className="aero-glass relative overflow-visible px-6 py-7 !bg-[#59CBE8]/20 !backdrop-blur-3xl border !border-white/60 shadow-[0_20px_50px_rgba(0,30,60,0.15),inset_0_1px_4px_rgba(255,255,255,0.6)]"
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
                <StageHeader tagId={tagId} tagGate={tagGate} />
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
            className="absolute inset-0 z-20 flex items-center justify-center px-6"
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
              className="aero-glass relative overflow-visible px-6 py-7 !bg-[#59CBE8]/20 !backdrop-blur-3xl border !border-white/60 shadow-[0_20px_50px_rgba(0,30,60,0.15),inset_0_1px_4px_rgba(255,255,255,0.6)]"
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
                className="aero-subtle mb-5 text-center text-sm drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                가챠 결과 공개!
              </motion.p>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-28 w-full max-w-xs items-center justify-center rounded-2xl border border-white/25 bg-gradient-to-br from-cyan-400/30 via-sky-500/20 to-blue-600/30 p-4 backdrop-blur-md">
                  <img src={selectedReward.imageUrl} alt={selectedReward.name} className="h-full w-full object-contain" />
                </div>
                <h2 className="aero-title mb-5 text-2xl font-bold tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                  {selectedReward.name}
                </h2>

                <div className="w-full space-y-3 mb-6 text-left">
                  <div>
                    <label className="block text-xs font-bold text-white mb-1 ml-1 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                      어버이 이름 (소유자)
                    </label>
                    <input
                      type="text"
                      placeholder="이름을 입력하세요"
                      ref={inputParentNameRef}
                      className="w-full px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-300/20 outline-none text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white mb-1 ml-1 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                      주얼리 별명
                    </label>
                    <input
                      type="text"
                      placeholder="주얼리의 이름을 지어주세요"
                      ref={inputJewelryNameRef}
                      className="w-full px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-300/20 outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <motion.button
                  type="button"
                  className="aero-button relative z-20 w-full"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={BUTTON_SPRING}
                  onClick={handleGoToCollection}
                >
                  <span className="relative z-10">이름 등록하고 수족관 가기</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {gachaStep === "collection" && (
          <AquariumCollectionView rewards={collectedRewards} claims={mockClaims} />
        )}
      </div>
    </div>
  );
}