"use client";

import Image, { type ImageProps, type StaticImageData } from "next/image";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { getImage, isValidImageUrl } from "@/lib/utils/images";

export default function LazyImage({
  alt,
  src,
  width,
  height,
  wrapperContainerStyles,
  ...props
}: Omit<ImageProps, "src"> & {
  wrapperContainerStyles?: string;
  src: string | null | undefined | StaticImageData;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageUrl = getImage(src as string);

  // Don't render Image component if URL is invalid
  if (!isValidImageUrl(imageUrl) || hasError) {
    return (
      <div
        className={twMerge(
          "relative h-full w-full flex items-center justify-center bg-secondary text-muted-foreground",
          wrapperContainerStyles,
        )}
      >
        <span className="text-sm">No image</span>
      </div>
    );
  }

  // Check if image is from API (localhost) - use unoptimized for API images
  const isApiImage = imageUrl.includes("localhost") || imageUrl.includes("/api/image/");

  return (
    <div className={twMerge("relative h-full w-full", wrapperContainerStyles)}>
      {isApiImage ? (
        // Use Next.js Image with unoptimized flag for API-served images
        <>
          <Image
            src={imageUrl}
            alt={alt ?? ""}
            width={2}
            height={2}
            priority={true}
            unoptimized
            className={twMerge(
              "absolute inset-0 w-full h-full object-cover blur-lg transition-opacity duration-500",
              isLoaded ? "opacity-0" : "opacity-100",
            )}
            onError={() => setHasError(true)}
          />
          <Image
            src={imageUrl}
            alt={alt ?? ""}
            width={width ?? 1}
            height={height ?? 1}
            unoptimized
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={twMerge(
              "relative w-full h-full object-cover transition-opacity duration-500",
              isLoaded ? "opacity-100" : "opacity-0",
              props.className,
            )}
            style={{ width: "100%", height: "100%" }}
          />
        </>
      ) : (
        // Use Next.js Image for other images (non-API images)
        <>
          <Image
            src={imageUrl}
            alt={alt ?? ""}
            width={2}
            height={2}
            priority={true}
            className={twMerge(
              "absolute inset-0 w-full h-full object-cover blur-lg transition-opacity duration-500",
              isLoaded ? "opacity-0" : "opacity-100",
            )}
            onError={() => setHasError(true)}
          />
          <Image
            {...props}
            src={imageUrl}
            alt={alt ?? ""}
            width={width}
            height={height}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={twMerge(
              "relative w-full h-full object-cover transition-opacity duration-500",
              isLoaded ? "opacity-100" : "opacity-0",
              props.className,
            )}
          />
        </>
      )}
    </div>
  );
}
