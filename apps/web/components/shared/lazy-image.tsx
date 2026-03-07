"use client";

import Image, { type ImageProps, type StaticImageData } from "next/image";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import { getImage, isValidImageUrl } from "@/lib/utils/images";

export default function LazyImage({
  alt,
  src,
  width,
  height,
  blurOnLoad = true,
  wrapperContainerStyles,
  ...props
}: Omit<ImageProps, "src"> & {
  blurOnLoad?: boolean;
  wrapperContainerStyles?: string;
  src: string | null | undefined | StaticImageData;
}) {
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
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

  const isValidSource =
    typeof imageSrc === "string" ? isValidImageUrl(imageSrc) : Boolean(imageSrc);
  const hasCurrentSourceError = imageSrcKey ? failedSources.has(imageSrcKey) : false;
  const isLoaded = loadedSourceKey === imageSrcKey;

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
  const isCloudinaryImage =
    typeof imageSrc === "string" &&
    imageSrc.includes("res.cloudinary.com/") &&
    imageSrc.includes("/image/upload/");
  const cloudinaryPreviewSrc = useMemo(() => {
    if (!isCloudinaryImage || typeof imageSrc !== "string") {
      return null;
    }
    return imageSrc.replace(
      "/image/upload/",
      "/image/upload/w_24,e_blur:1000,q_1,f_auto/",
    );
  }, [imageSrc, isCloudinaryImage]);

  return (
    <div className={twMerge("relative h-full w-full", wrapperContainerStyles)}>
      {!isLoaded && blurOnLoad && cloudinaryPreviewSrc ? (
        <img
          src={cloudinaryPreviewSrc}
          alt=""
          aria-hidden
          loading="eager"
          className="absolute inset-0 h-full w-full object-contain opacity-80 blur-xl"
        />
      ) : null}
      <Image
        key={imageSrcKey}
        {...props}
        src={imageSrc}
        alt={alt ?? ""}
        width={width ?? 1}
        height={height ?? 1}
        loading={props.loading ?? "lazy"}
        unoptimized={isApiImage || isCloudinaryImage ? true : props.unoptimized}
        onLoad={(event) => {
          setLoadedSourceKey(imageSrcKey);
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
          setLoadedSourceKey((previous) => (previous === imageSrcKey ? null : previous));
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
          "relative h-full w-full object-contain transition-[opacity,filter,transform] duration-500",
          isLoaded
            ? "opacity-100 blur-0 scale-100"
            : blurOnLoad
              ? "opacity-75 blur-md scale-[1.02]"
              : "opacity-0",
          props.className,
        )}
        style={{
          width: "100%",
          height: "100%",
          ...(props.style ?? {}),
        }}
      />

      {!isLoaded && (
        <div
          className={twMerge(
            "absolute inset-0 animate-pulse bg-slate-200 transition-opacity duration-500",
            blurOnLoad ? "opacity-45" : "opacity-100",
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
