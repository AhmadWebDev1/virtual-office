import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="6" height="6" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
      <path d="M17 3v2m-1-1h2" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.5" r="2.5" />
      <path d="M4 19v-1.5c0-2.2 2.2-4 5-4s5 1.8 5 4V19" />
      <path d="M16 6.5a2 2 0 0 1 0 4M17.5 14c1.6.5 2.5 1.7 2.5 3.5V19" />
    </Icon>
  );
}

export function ZoomInIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5M10.5 8v5M8 10.5h5" />
    </Icon>
  );
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5M8 10.5h5" />
    </Icon>
  );
}

export function FitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      <rect x="9" y="9" width="6" height="6" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3 11 18-8-7 18-3-7-8-3Z" />
      <path d="m11 13 4-4" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 9h-13L4 8Z" />
      <path d="M6 20h12" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-5M12 16V7M16 16v-3M20 16V9" />
    </Icon>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3a9 9 0 0 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.2 2.4 2.4 0 0 1 1.7-4.1H19A2 2 0 0 0 21 10.7 9 9 0 0 0 12 3Z" />
      <path d="M7.5 9h.01M10 6.5h.01M14 6.5h.01M7 13h.01" strokeWidth={2.8} />
    </Icon>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
      <path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" />
    </Icon>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17.2v.2" />
    </Icon>
  );
}

export function ArrowUpLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 18 6 6M6 6v7M6 6h7" />
    </Icon>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s6.5-6.2 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.8 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </Icon>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </Icon>
  );
}

export function SparkleStarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2Z" />
    </Icon>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9a14 14 0 0 1 18 0M6.5 12.5a9 9 0 0 1 11 0M10 16a4 4 0 0 1 4 0" />
      <path d="M12 19.5h.01" strokeWidth={3} />
    </Icon>
  );
}

export function CommandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6.5A2.5 2.5 0 1 0 6.5 9H9V6.5ZM9 17.5A2.5 2.5 0 1 1 6.5 15H9v2.5ZM15 6.5A2.5 2.5 0 1 1 17.5 9H15V6.5ZM15 17.5a2.5 2.5 0 1 0 2.5-2.5H15v2.5Z" />
      <path d="M9 9h6v6H9z" />
    </Icon>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="6" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M8 6h4a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" />
    </Icon>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 21V5h10v16M14 10h6v11M2 21h20" />
      <path d="M7 8h4M7 12h4M7 16h4M17 14h1M17 17h1" />
    </Icon>
  );
}

export function PixelLogo(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect width="32" height="32" fill="#132a24" />
      <rect x="0" y="0" width="32" height="2" fill="#274c40" />
      <rect x="2" y="6" width="28" height="20" fill="#d8a54a" />
      <rect x="4" y="8" width="24" height="16" fill="#10201c" />
      <rect x="6" y="10" width="6" height="6" fill="#7ec7b3" />
      <rect x="14" y="10" width="6" height="6" fill="#f1d9a4" />
      <rect x="22" y="10" width="4" height="6" fill="#c47d54" />
      <rect x="6" y="18" width="20" height="2" fill="#3b6658" />
      <rect x="12" y="22" width="8" height="2" fill="#d8a54a" />
      <rect x="16" y="26" width="2" height="4" fill="#274c40" />
      <rect x="10" y="30" width="14" height="2" fill="#d8a54a" />
      <rect x="2" y="26" width="6" height="4" fill="#7ec7b3" />
      <rect x="24" y="26" width="6" height="4" fill="#c47d54" />
    </svg>
  );
}
