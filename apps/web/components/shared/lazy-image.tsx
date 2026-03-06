"use client";

import Image, { type ImageProps, type StaticImageData } from "next/image";
import { useEffect, useMemo, useState } from "react";
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
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  const imageSrc = useMemo(() => {
    if (!src) return "";
    if (typeof src === "string") {
      return getImage(src);
    }
    return src;
  }, [src]);
  const imageSrcKey = useMemo(
    () => (typeof imageSrc === "string" ? imageSrc : imageSrc.src),
    [imageSrc],
  );

  useEffect(() => {
    // Reset loading state when source changes.
    setIsLoaded(false);
  }, [imageSrcKey]);

  const isValidSource =
    typeof imageSrc === "string" ? isValidImageUrl(imageSrc) : Boolean(imageSrc);
  const hasCurrentSourceError = imageSrcKey ? failedSources.has(imageSrcKey) : false;

  // Don't render Image component if URL is invalid
  if (!isValidSource || hasCurrentSourceError) {
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
  const isApiImage =
    typeof imageSrc === "string" &&
    (imageSrc.includes("localhost") || imageSrc.includes("/api/image/"));

  return (
    <div className={twMerge("relative h-full w-full", wrapperContainerStyles)}>
      <Image
        key={imageSrcKey}
        {...props}
        src={imageSrc}
        alt={alt ?? ""}
        width={width ?? 1}
        height={height ?? 1}
        loading={props.loading ?? "lazy"}
        unoptimized={isApiImage ? true : props.unoptimized}
        onLoad={(event) => {
          setIsLoaded(true);
          setFailedSources((previous) => {
            if (!previous.has(imageSrcKey)) {
              return previous;
            }
            const next = new Set(previous);
            next.delete(imageSrcKey);
            return next;
          });
          props.onLoad?.(event);
        }}
        onError={(event) => {
          setFailedSources((previous) => {
            if (previous.has(imageSrcKey)) {
              return previous;
            }
            const next = new Set(previous);
            next.add(imageSrcKey);
            return next;
          });
          props.onError?.(event);
        }}
        className={twMerge(
          "relative w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          props.className,
        )}
        style={{
          width: "100%",
          height: "100%",
          ...(props.style ?? {}),
        }}
      />

      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden />
      )}
    </div>
  );
}
