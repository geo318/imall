import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & { title?: string };

const MarketHubLogo = ({ title = "MarketHub logo", ...props }: LogoProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden={title ? undefined : true}
    role="img"
    {...props}
  >
    <title>{title}</title>
    <rect x="5" y="5" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M9 9h6M9 12h6M9 15h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export default MarketHubLogo;
