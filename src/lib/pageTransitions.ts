export type PageTransitionEffect =
  | "none"
  | "push"
  | "uncover"
  | "peelOff"
  | "curtains"
  | "drape"
  | "wind"
  | "prestige"
  | "fade"
  | "coverflow"
  | "flip"
  | "cards";

export const PAGE_TRANSITION_OPTIONS: Array<{
  value: PageTransitionEffect;
  label: string;
}> = [
  { value: "none", label: "Default" },
  { value: "uncover", label: "Uncover" },
  { value: "peelOff", label: "Peel Off" },
  { value: "curtains", label: "Curtains" },
  { value: "drape", label: "Drape" },
  { value: "wind", label: "Wind" },
  { value: "prestige", label: "Prestige" },
  { value: "fade", label: "Fade" },
  { value: "cards", label: "Cards" },
];

export function getPageTransitionDuration(effect: PageTransitionEffect) {
  switch (effect) {
    case "push":
      return 600;
    case "uncover":
      return 650;
    case "peelOff":
      return 900;
    case "curtains":
      return 850;
    case "drape":
      return 1000;
    case "wind":
      return 1000;
    case "prestige":
      return 1000;
    case "fade":
      return 650;
    case "coverflow":
      return 800;
    case "flip":
      return 750;
    case "cards":
      return 720;
    case "none":
    default:
      return 0;
  }
}
