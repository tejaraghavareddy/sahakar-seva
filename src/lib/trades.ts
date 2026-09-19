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
  Fan,
  WashingMachine,
  Refrigerator,
  Microwave,
  Lamp,
  Timer,
  Container,
  DoorOpen,
  Sofa,
  Landmark,
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
  color: string; // tile accent (theme color name)
}

export const TRADES: Trade[] = [
  { id: "electrician", icon: Zap, baseRate: 850, color: "saffron" },
  { id: "plumber", icon: Droplets, baseRate: 800, color: "blue" },
  { id: "carpenter", icon: Hammer, baseRate: 900, color: "amber" },
  { id: "mason", icon: BrickWall, baseRate: 820, color: "forest" },
  { id: "painter", icon: PaintRoller, baseRate: 750, color: "plum" },
  { id: "appliance", icon: Wrench, baseRate: 880, color: "teal" },
];

export function getTrade(id: string): Trade | undefined {
  return TRADES.find((t) => t.id === id);
}

/* ---------------- Service catalog (customer portal) ---------------- */

export interface Service {
  id: string;
  trade: TradeId;
  name: string;
  desc: string;
  base: number; // visit/inspection charge, INR
  hourly: number; // per-hour labour after inspection, INR
  urgent: boolean; // supports emergency dispatch
  icon: LucideIcon;
  color: string; // theme color family for the tile
}

export const SERVICES: Service[] = [
  // Electrical
  { id: "el-fan", trade: "electrician", name: "Ceiling fan install or repair", desc: "Mounting, capacitor swap, speed issues, wobble fixing.", base: 149, hourly: 250, urgent: false, icon: Fan, color: "saffron" },
  { id: "el-wire", trade: "electrician", name: "Full house wiring check", desc: "Load testing, earthing audit, MCB and fuse inspection.", base: 299, hourly: 350, urgent: false, icon: Cable, color: "saffron" },
  { id: "el-short", trade: "electrician", name: "Short circuit / power failure", desc: "Emergency tripping, burnt smell, spark diagnosis.", base: 249, hourly: 400, urgent: true, icon: AlertTriangle, color: "saffron" },
  { id: "el-light", trade: "electrician", name: "Light & switch fittings", desc: "Chandeliers, panels, dimmers, new switch points.", base: 129, hourly: 250, urgent: false, icon: Lightbulb, color: "saffron" },
  // Plumbing
  { id: "pl-tap", trade: "plumber", name: "Tap & mixer repair", desc: "Dripping spouts, cartridge replacement, reseating.", base: 129, hourly: 250, urgent: false, icon: Droplet, color: "blue" },
  { id: "pl-block", trade: "plumber", name: "Blocked drain clearing", desc: "Sink, floor trap and toilet jetting and snaking.", base: 199, hourly: 300, urgent: true, icon: Waves, color: "blue" },
  { id: "pl-tank", trade: "plumber", name: "Tank & flush repair", desc: "Flush valves, overflow, float valve, tank fittings.", base: 199, hourly: 300, urgent: false, icon: Timer, color: "blue" },
  { id: "pl-pipe", trade: "plumber", name: "Hidden pipe leak trace", desc: "Pressure testing, wall leak localization, re-piping quote.", base: 299, hourly: 350, urgent: false, icon: Pipette, color: "blue" },
  // Carpentry
  { id: "ca-door", trade: "carpenter", name: "Door & lock alignment", desc: "Hinge fixes, latch replacement, monsoon swelling.", base: 199, hourly: 300, urgent: false, icon: DoorOpen, color: "amber" },
  { id: "ca-furn", trade: "carpenter", name: "Furniture repair", desc: "Bed, chair, wardrobe joints, drawer channels.", base: 249, hourly: 350, urgent: false, icon: Sofa, color: "amber" },
  { id: "ca-modular", trade: "carpenter", name: "Modular fittings", desc: "Cabinet handles, soft-close hinges, shelf brackets.", base: 179, hourly: 300, urgent: false, icon: Container, color: "amber" },
  { id: "ca-measure", trade: "carpenter", name: "Custom build consultation", desc: "On-site measurement and quote for new woodwork.", base: 299, hourly: 0, urgent: false, icon: Ruler, color: "amber" },
  // Masonry
  { id: "ma-crack", trade: "mason", name: "Wall crack sealing", desc: "Structural crack fill, mesh reinforcement, curing.", base: 299, hourly: 350, urgent: false, icon: BrickWall, color: "forest" },
  { id: "ma-water", trade: "mason", name: "Seepage & dampness fix", desc: "Terrace and bathroom waterproofing treatment.", base: 499, hourly: 400, urgent: false, icon: Waves, color: "forest" },
  { id: "ma-tile", trade: "mason", name: "Tile replacement", desc: "Chipped floor and wall tiles, grout re-lining.", base: 249, hourly: 350, urgent: false, icon: Grid2x2, color: "forest" },
  { id: "ma-plaster", trade: "mason", name: "Plaster patch work", desc: "Hole filling, corner beads, ceiling patch prep.", base: 249, hourly: 350, urgent: false, icon: Landmark, color: "forest" },
  // Painting
  { id: "pa-room", trade: "painter", name: "Single room repaint", desc: "Two-coat emulsion, putty prep, masking included.", base: 999, hourly: 0, urgent: false, icon: PaintBucket, color: "plum" },
  { id: "pa-wall", trade: "painter", name: "Patch & touch-up", desc: "Stain covering, damp patch sealing, color match.", base: 299, hourly: 300, urgent: false, icon: Paintbrush, color: "plum" },
  { id: "pa-texture", trade: "painter", name: "Texture & accent wall", desc: "Stencil, roller texture, geometric patterns.", base: 699, hourly: 0, urgent: false, icon: Layers, color: "plum" },
  { id: "pa-waterproof", trade: "painter", name: "Waterproof coating", desc: "Exterior emulsion, terrace coats, anti-fungal.", base: 899, hourly: 0, urgent: false, icon: PaintRoller, color: "plum" },
  // Appliance
  { id: "ap-ac", trade: "appliance", name: "AC service & gas top-up", desc: "Jet wash, filter clean, cooling gas check.", base: 449, hourly: 350, urgent: false, icon: Wind, color: "teal" },
  { id: "ap-fridge", trade: "appliance", name: "Refrigerator repair", desc: "Cooling fault, thermostat, compressor diagnostics.", base: 299, hourly: 350, urgent: true, icon: Refrigerator, color: "teal" },
  { id: "ap-wm", trade: "appliance", name: "Washing machine repair", desc: "Drum noise, drainage, spin cycle, PCB faults.", base: 299, hourly: 350, urgent: false, icon: WashingMachine, color: "teal" },
  { id: "ap-mw", trade: "appliance", name: "Microwave & oven fix", desc: "Magnetron, turntable, door switch issues.", base: 299, hourly: 350, urgent: false, icon: Microwave, color: "teal" },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export const COLOR_SOFT: Record<string, string> = {
  saffron: "bg-saffron-soft text-saffron",
  blue: "bg-blue-soft text-blue",
  amber: "bg-warn-soft text-warn",
  forest: "bg-forest-soft text-forest",
  plum: "bg-plum-soft text-plum",
  teal: "bg-teal-soft text-teal",
  rose: "bg-rose-soft text-rose",
  ok: "bg-ok-soft text-ok",
};

export const COLOR_TEXT: Record<string, string> = {
  saffron: "text-saffron",
  blue: "text-blue",
  amber: "text-warn",
  forest: "text-forest",
  plum: "text-plum",
  teal: "text-teal",
  rose: "text-rose",
  ok: "text-ok",
};

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
      options: ["Swollen battery", "New cables", "Low battery level", "Charging slowly"],
      answer: 0,
      explain: "A swollen battery is a fire hazard — isolate and replace safely.",
    },
  ],
};

export const QUIZ_PASS_MARK = 60;
