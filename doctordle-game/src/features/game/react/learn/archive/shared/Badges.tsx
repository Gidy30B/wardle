import { DIFFICULTY_TONES, TRACK_COPY } from "../../learn.constants";
import type { PublishTrack } from "../../../../game.types";

export function TrackBadge({ track }: { track: PublishTrack }) {
  const copy = TRACK_COPY[track] ?? TRACK_COPY.DAILY;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-[3px] font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] ${copy.tone}`}
    >
      {copy.label}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const normalized = difficulty.trim().toLowerCase();
  const tone =
    DIFFICULTY_TONES[normalized] ??
    "border border-white/[0.08] bg-white/[0.05] text-white/44";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}
    >
      {normalized || "standard"}
    </span>
  );
}
