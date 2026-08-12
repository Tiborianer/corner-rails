export function catenaryPolePositions(length: number): number[] {
  const count = Math.max(2, Math.ceil(length / 6));
  return Array.from(
    { length: count },
    (_, index) => -length / 2 + 2.2 + (index / (count - 1)) * (length - 4.4),
  );
}

export function trainMotionPosition(
  phase: "approach" | "dwell" | "depart",
  elapsed: number,
  duration: number,
  entryX: number,
  stationX: number,
  exitX: number,
): number {
  const progress = Math.min(1, Math.max(0, elapsed / Math.max(0.001, duration)));
  if (phase === "approach") return entryX + (stationX - entryX) * (1 - Math.pow(1 - progress, 3));
  if (phase === "depart") return stationX + (exitX - stationX) * progress * progress;
  return stationX;
}
