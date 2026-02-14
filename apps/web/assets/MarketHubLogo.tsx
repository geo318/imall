import Image, { type ImageProps } from "next/image";

type LogoProps = Omit<ImageProps, "src" | "alt"> & { title?: string };

const MarketHubLogo = ({
  title = "iMall logo",
  className,
  width = 32,
  height = 32,
  ...props
}: LogoProps) => (
  <Image
    src="/imall-logo.png"
    alt={title}
    width={width}
    height={height}
    className={`rounded-full object-contain ${className ?? ""}`.trim()}
    {...props}
  />
);

export default MarketHubLogo;
