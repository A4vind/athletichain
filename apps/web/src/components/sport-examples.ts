/**
 * Example text shown inside empty form boxes ("e.g. ..."), so every athlete and coach sees
 * examples from their own sport. Keyed by sport code (sports.code). A sport an admin adds
 * later falls back to GENERIC. Values are keyed by metric code (sport_metrics.code).
 */
export type SportExamples = {
  position: string;
  event: string;
  conditions: string;
  achievement: { title: string; result: string; event: string };
  milestone: { title: string; result: string; event: string };
  goal: string;
  sessionTypes: string[];
  exercises: string;
  notes: string;
  feedback: string;
  values: Record<string, string>;
};

const GENERIC: SportExamples = {
  position: "Your main event or position",
  event: "District Championship",
  conditions: "Indoor, official timing or scoring",
  achievement: { title: "Tournament winner", result: "1st", event: "State Championship 2026" },
  milestone: { title: "New personal best", result: "Best result so far", event: "Club trial" },
  goal: "Improve your main result",
  sessionTypes: ["Skills training", "Strength and conditioning", "Technique drills", "Match practice", "Fitness", "Recovery"],
  exercises: "Warm-up 15 min, drills 3 × 10, cool-down",
  notes: "Better focus in the second half",
  feedback: "What went well, what to work on next",
  values: {},
};

const EXAMPLES: Record<string, SportExamples> = {
  ATHLETICS: {
    position: "Sprints · 100m and 200m",
    event: "District Athletics Championship",
    conditions: "Wind +0.8 m/s, electronic timing",
    achievement: { title: "100m gold medal", result: "1st · 12.31 s", event: "State Junior Athletics Championship" },
    milestone: { title: "New personal best · 100m", result: "12.28 s", event: "Club time trial" },
    goal: "Run 100m under 12.30 s",
    sessionTypes: ["Speed training", "Block starts", "Speed endurance", "Strength and conditioning", "Technique drills", "Recovery run"],
    exercises: "Block starts ×6, 30m flys ×4, 150m ×3",
    notes: "Better drive phase; arms still crossing",
    feedback: "Strong first 30m. Stay relaxed through the last 20m.",
    values: { "100m": "12.40", "200m": "25.10", "400m": "56.80", long_jump: "5.85", top_speed: "32.5" },
  },
  CRICKET: {
    position: "Opening batter",
    event: "U-17 Inter-District T20",
    conditions: "Turf pitch, overcast, 20 overs",
    achievement: { title: "Player of the Match", result: "78 runs off 52 balls", event: "U-17 Inter-District T20 Final" },
    milestone: { title: "First century", result: "104 runs", event: "Club league match" },
    goal: "Score 35+ runs per innings",
    sessionTypes: ["Net session", "Batting drills", "Bowling spell", "Fielding drills", "Fitness", "Match simulation"],
    exercises: "Throwdowns ×60, slip catches ×30, 6-over spell",
    notes: "Playing late, good leaves outside off stump",
    feedback: "Good shot selection. Rotate the strike more in the middle overs.",
    values: { runs: "64", wickets: "3", strike_rate: "128.50", economy: "6.25" },
  },
  FOOTBALL: {
    position: "Central midfielder",
    event: "U-15 District League · Matchday 6",
    conditions: "Grass pitch, 2 × 35 min, rain",
    achievement: { title: "League top scorer", result: "11 goals", event: "U-15 District League 2026" },
    milestone: { title: "First hat-trick", result: "3 goals", event: "League match vs City FC Academy" },
    goal: "Score 10 league goals this season",
    sessionTypes: ["Passing drills", "Small-sided games", "Finishing practice", "Set pieces", "Fitness and agility", "Match analysis"],
    exercises: "Rondo 5v2 ×4, finishing from crosses ×20",
    notes: "Scanning more before receiving the ball",
    feedback: "Great movement off the ball. Release passes one touch earlier.",
    values: { goals: "2", assists: "1", pass_accuracy: "84.5", sprint_speed: "29.4" },
  },
  BADMINTON: {
    position: "Singles",
    event: "State Junior Ranking Tournament",
    conditions: "Indoor, wooden court, feather shuttle",
    achievement: { title: "U-17 singles champion", result: "Winner · 21-17, 21-19", event: "State Junior Ranking Tournament" },
    milestone: { title: "Entered state top 10", result: "Ranked 8th", event: "State ranking list" },
    goal: "Reach the state top 5",
    sessionTypes: ["Footwork drills", "Multi-shuttle feeding", "Smash and defence", "Net play", "Match practice", "Agility and fitness"],
    exercises: "Six-corner footwork ×8, multi-shuttle ×100, net kills ×30",
    notes: "Faster recovery to base after the smash",
    feedback: "Smash is sharper. Work on deception at the net.",
    values: { matches_won: "4", ranking: "12", smash_speed: "210" },
  },
  BASKETBALL: {
    position: "Point guard",
    event: "U-18 Inter-School League",
    conditions: "Indoor, 4 × 10 min quarters",
    achievement: { title: "Tournament MVP", result: "18.5 points per game", event: "U-18 Inter-School Championship" },
    milestone: { title: "First double-double", result: "16 pts · 11 reb", event: "League game vs St. Xavier's" },
    goal: "Raise free-throw percentage above 75%",
    sessionTypes: ["Shooting drills", "Ball handling", "Defensive slides", "Fast-break drills", "Scrimmage", "Conditioning"],
    exercises: "Form shooting ×100, Mikan drill 3 min, 3-man weave ×6",
    notes: "Better decisions on the pick-and-roll",
    feedback: "Good court vision. Keep the dribble lower under pressure.",
    values: { points: "14.5", rebounds: "6.0", ft_pct: "72.5" },
  },
  COMBAT: {
    position: "MMA · Lightweight (70 kg)",
    event: "State Amateur MMA Championship",
    conditions: "3 × 3 min rounds, amateur rules",
    achievement: { title: "Gold medal · 70 kg", result: "Won 3 bouts · final by decision", event: "State Amateur MMA Championship" },
    milestone: { title: "First win by submission", result: "Rear-naked choke, round 2", event: "Inter-club fight night" },
    goal: "Win 5 amateur bouts this season",
    sessionTypes: ["Striking pads", "Grappling and wrestling", "Sparring", "Bag work", "Strength and conditioning", "Technique drills"],
    exercises: "Pad rounds 5 × 3 min, takedown drills ×20, sparring 3 rounds",
    notes: "Keeping the guard up after combinations",
    feedback: "Good pressure. Reset your stance after every takedown attempt.",
    values: { bouts_won: "2", strikes_landed: "38" },
  },
};

export function examplesFor(sportCode: string | null | undefined): SportExamples {
  return (sportCode && EXAMPLES[sportCode]) || GENERIC;
}

/** "e.g. 12.40" for the chosen metric; falls back to a number with the metric's decimals. */
export function valueExample(sportCode: string | null | undefined, metric?: { code: string; decimals: number } | null): string {
  if (!metric) return `e.g. ${Object.values(examplesFor(sportCode).values)[0] ?? "12"}`;
  const known = examplesFor(sportCode).values[metric.code];
  return `e.g. ${known ?? (metric.decimals > 0 ? (12.5).toFixed(metric.decimals) : "12")}`;
}

/** The sport most of these athletes play (for coach forms that cover several athletes). */
export function mainSport(codes: (string | null | undefined)[]): string | undefined {
  const count = new Map<string, number>();
  for (const c of codes) if (c) count.set(c, (count.get(c) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
