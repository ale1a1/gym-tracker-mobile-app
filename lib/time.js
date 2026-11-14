// 75 -> "01:15", 3725 -> "1:02:05"
export const formatClock = (seconds) => {
  if (typeof seconds !== "number" || isNaN(seconds)) return "00:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mmss = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  return h > 0 ? `${h}:${mmss}` : mmss
}
