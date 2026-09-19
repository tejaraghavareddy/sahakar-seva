import {
  Zap,
  Droplets,
  Hammer,
  BrickWall,
  PaintRoller,
  Wrench,
  Plug,
  Cable,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  Gauge,
  ShowerHead,
  Waves,
  Droplet,
  Pipette,
  Ruler,
  Pin,
  Drill,
  TreePine,
  Layers,
  Paintbrush,
  PaintBucket,
  Grid2x2,
  Wind,
  Snowflake,
  CircuitBoard,
  BatteryCharging,
  type LucideIcon,
} from "lucide-react";

/* ---------------- Trades ---------------- */

export type TradeId =
  | "electrician"
  | "plumber"
  | "carpenter"
  | "mason"
  | "painter"
  | "appliance";

export interface Trade {
  id: TradeId;
  icon: LucideIcon;
  baseRate: number; // union standard base day rate, INR
}

export const TRADES: Trade[] = [
  { id: "electrician", icon: Zap, baseRate: 850 },
  { id: "plumber", icon: Droplets, baseRate: 800 },
  { id: "carpenter", icon: Hammer, baseRate: 900 },
  { id: "mason", icon: BrickWall, baseRate: 820 },
  { id: "painter", icon: PaintRoller, baseRate: 750 },
  { id: "appliance", icon: Wrench, baseRate: 880 },
];

export function getTrade(id: string): Trade | undefined {
  return TRADES.find((t) => t.id === id);
}

/* ---------------- Cooperative societies ---------------- */

export interface Society {
  id: string;
  name: string;
  district: string;
  state: string;
  code: string;
}

export const SOCIETIES: Society[] = [
  {
    id: "hyd-cec",
    name: "Hyderabad Central Electrical Co-op",
    district: "Hyderabad",
    state: "Telangana",
    code: "TS-HYD-01",
  },
  {
    id: "blr-btf",
    name: "Bengaluru Trades Federation",
    district: "Bengaluru (Urban)",
    state: "Karnataka",
    code: "KA-BLR-04",
  },
  {
    id: "che-mcw",
    name: "Chennai Metro Construction Workers Co-op",
    district: "Chennai",
    state: "Tamil Nadu",
    code: "TN-CHN-07",
  },
  {
    id: "kol-mlc",
    name: "Kolkata Municipal Labour Cooperative",
    district: "Kolkata",
    state: "West Bengal",
    code: "WB-KOL-11",
  },
  {
    id: "del-caw",
    name: "Delhi Capital Artisans Welfare Co-op",
    district: "New Delhi",
    state: "Delhi",
    code: "DL-DEL-02",
  },
  {
    id: "vja-kdw",
    name: "Vijayawada District Workers Co-op",
    district: "Vijayawada",
    state: "Andhra Pradesh",
    code: "AP-VJA-09",
  },
];

export function getSociety(id: string): Society | undefined {
  return SOCIETIES.find((s) => s.id === id);
}

/* ---------------- Voice skill quiz ---------------- */

export interface QuizQuestion {
  icon: LucideIcon;
  options: string[]; // pictorial options described in words (read aloud + shown)
  answer: number; // index of correct option
  explain: string;
}

export const QUIZ: Record<TradeId, QuizQuestion[]> = {
  electrician: [
    {
      icon: Cable,
      options: ["Live wire", "Neutral wire", "Earth wire", "Data cable"],
      answer: 2,
      explain: "Green insulation is always the protective earth conductor.",
    },
    {
      icon: AlertTriangle,
      options: [
        "Reset it and continue working",
        "Switch off mains and inspect the circuit",
        "Tie it in the ON position",
        "Paint over the panel",
      ],
      answer: 1,
      explain: "A tripping MCB signals a fault — isolate mains before inspecting.",
    },
    {
      icon: Plug,
      options: [
        "15/16 A, earthed",
        "5 A two-pin",
        "Any spare socket",
        "Extension board daisy-chain",
      ],
      answer: 0,
      explain: "Heavy appliances need a dedicated 15/16 A earthed point.",
    },
    {
      icon: ShieldCheck,
      options: [
        "Colored tape",
        "Sleeves over joints",
        "Insulated gloves and a voltage tester",
        "A wet cloth",
      ],
      answer: 2,
      explain: "Test-before-touch: insulated gloves plus a working voltage tester.",
    },
    {
      icon: Lightbulb,
      options: ["Series", "Parallel", "Mixed random", "Through the switch only"],
      answer: 1,
      explain: "Home lighting circuits wire lamps in parallel for independent control.",
    },
  ],
  plumber: [
    {
      icon: ShowerHead,
      options: ["P-trap", "S-curve hose", "Ball valve", "Gate valve"],
      answer: 0,
      explain: "The P-trap's water seal blocks sewer gases from entering.",
    },
    {
      icon: Droplet,
      options: [
        "Tighten the packing nut / replace the washer",
        "Wrap tape outside and leave it",
        "Increase water pressure",
        "Remove the entire pipeline",
      ],
      answer: 0,
      explain: "A leaking spindle is fixed by repacking or replacing the washer.",
    },
    {
      icon: Waves,
      options: [
        "Hot water line",
        "Cold water line",
        "Drainage line",
        "Gas line",
      ],
      answer: 2,
      explain: "The drain line must slope downward for gravity flow.",
    },
    {
      icon: Pipette,
      options: ["PVC solvent cement", "Fevicol", "M-seal putty", "Screw and nail"],
      answer: 0,
      explain: "PVC joints are bonded with PVC solvent cement after cleaning.",
    },
    {
      icon: Gauge,
      options: [
        "Close all taps and watch the meter",
        "Open every tap fully",
        "Remove the meter",
        "Flush the tank once",
      ],
      answer: 0,
      explain: "With all taps closed, a moving meter indicates a hidden leak.",
    },
  ],
  carpenter: [
    {
      icon: Ruler,
      options: ["Measure once, cut twice", "Measure twice, cut once", "Eyeball it", "Ask the client"],
      answer: 1,
      explain: "Always measure twice before cutting — mistakes waste material.",
    },
    {
      icon: TreePine,
      options: ["Along the grain", "Against the grain", "Across randomly", "Diagonal always"],
      answer: 0,
      explain: "Planing along the grain leaves a smooth, tear-free surface.",
    },
    {
      icon: Pin,
      options: ["Brad nailer", "Staple gun", "Wood screws + glue", "Rope"],
      answer: 2,
      explain: "Load-bearing joints use screws and glue, not surface nails.",
    },
    {
      icon: Drill,
      options: ["Countersink bit", "Spade bit", "Hole saw", "Masonry bit"],
      answer: 0,
      explain: "A countersink lets screw heads sit flush below the surface.",
    },
    {
      icon: Layers,
      options: ["Sand across the grain", "Sand with progressively finer grit", "Use water", "Apply paint directly"],
      answer: 1,
      explain: "Progressive grits (coarse to fine) give a factory-smooth finish.",
    },
  ],
  mason: [
    {
      icon: BrickWall,
      options: ["Stretcher bond", "Herringbone", "Stack bond no mortar", "Random rubble"],
      answer: 0,
      explain: "Stretcher bond with staggered joints gives walls their strength.",
    },
    {
      icon: Grid2x2,
      options: ["Too much water", "Correct 1:6 cement-sand mix", "Soil only", "Gypsum filler"],
      answer: 1,
      explain: "A 1:6 cement-sand mortar is standard for brick masonry walls.",
    },
    {
      icon: Ruler,
      options: ["Plumb bob", "Spirit level line", "Measuring tape", "String only"],
      answer: 0,
      explain: "A plumb bob verifies true verticality of corners and columns.",
    },
    {
      icon: Waves,
      options: ["Curing with water for 7 days", "Leaving it in the sun", "Painting immediately", "Heating it"],
      answer: 0,
      explain: "Concrete gains strength with moist curing for at least 7 days.",
    },
    {
      icon: ShieldCheck,
      options: ["Damp-proof course", "Wallpaper", "Glass sheet", "Cardboard layer"],
      answer: 0,
      explain: "A damp-proof course at plinth level stops rising dampness.",
    },
  ],
  painter: [
    {
      icon: PaintBucket,
      options: ["Primer first", "Topcoat first", "Two topcoats", "Thinner only"],
      answer: 0,
      explain: "Primer seals the surface and makes the topcoat last longer.",
    },
    {
      icon: Paintbrush,
      options: ["Wipe and dry it", "Leave it in the can", "Wash in thinner overnight", "Burn it"],
      answer: 0,
      explain: "Clean brushes after use and dry them to keep bristles soft.",
    },
    {
      icon: Layers,
      options: ["1 coat", "2 coats with drying between", "5 wet coats", "Spray while wet"],
      answer: 1,
      explain: "Two coats, each fully dried, give even coverage and depth.",
    },
    {
      icon: Wind,
      options: ["Open windows and ventilate", "Seal the room", "Use a candle", "Work faster"],
      answer: 0,
      explain: "Solvent fumes must be ventilated — always keep windows open.",
    },
    {
      icon: Ruler,
      options: ["Masking tape", "Newspaper glued", "Freehand only", "Cardboard held by hand"],
      answer: 0,
      explain: "Masking tape gives crisp edges along trims and switches.",
    },
  ],
  appliance: [
    {
      icon: Plug,
      options: ["Unplug before opening", "Keep it running", "Wet hands are fine", "Use a knife as screwdriver"],
      answer: 0,
      explain: "Always disconnect power before opening any appliance.",
    },
    {
      icon: Snowflake,
      options: ["Dirty condenser coils", "New paint", "The brand", "Room décor"],
      answer: 0,
      explain: "Dusty condenser coils are the top cause of poor cooling.",
    },
    {
      icon: Gauge,
      options: ["Multimeter", "Hammer", "Screwdriver", "Torch only"],
      answer: 0,
      explain: "A multimeter safely tests fuses, elements and continuity.",
    },
    {
      icon: CircuitBoard,
      options: ["Replace with exact rating", "Use thicker wire", "Bypass it permanently", "Use a nail"],
      answer: 0,
      explain: "Fuses must be replaced with the same rating — never bypassed.",
    },
    {
      icon: BatteryCharging,
      options: [" swollen battery", "New cables", "Low battery level", "Charging slowly"],
      answer: 0,
      explain: "A swollen battery is a fire hazard — isolate and replace safely.",
    },
  ],
};

export const QUIZ_PASS_MARK = 60;
