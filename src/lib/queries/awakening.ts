export function levelToGenPrefix(level: number): string | null {
  if (level < 1) return null;
  if (level >= 200) return "200";
  if (level >= 180) return "180";
  if (level >= 160) return "160";
  if (level >= 140) return "140";
  if (level >= 120) return "120";
  if (level >= 100) return "100";
  if (level >= 80) return "80";
  if (level >= 60) return "60";
  if (level >= 40) return "40";
  return "20"; // 1~39
}
