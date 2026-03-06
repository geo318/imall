"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@repo/ui/button";
import { GripVertical, Star, Upload, X } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import LazyImage from "@/components/shared/lazy-image";
import { type ImageItem, imageFileSchema } from "./product-form.schema";

type Props = {
  images: ImageItem[];
  onImagesChange: (images: ImageItem[]) => void;
};

export function ImageGalleryUpload({ images, onImagesChange }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newImages: ImageItem[] = [];

      for (const file of acceptedFiles) {
        // Validate file using Zod schema
        const validationResult = imageFileSchema.safeParse(file);
        if (!validationResult.success) {
          const errorMessage =
            validationResult.error.errors[0]?.message || `${file.name} is invalid`;
          toast.error(errorMessage);
          continue;
        }

        // Create preview URL for the file
        const previewUrl = URL.createObjectURL(file);

        // Generate a temporary ID for the new image
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        newImages.push({
          id: tempId,
          url: previewUrl,
          isPrimary: images.length === 0 && newImages.length === 0,
          file: validationResult.data, // Use validated file
        });
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages]);
        toast.success(`${newImages.length} image(s) added`);
      }
    },
    [images, onImagesChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    multiple: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);

      const newImages = arrayMove(images, oldIndex, newIndex);
      // First image after reordering becomes primary if no primary exists
      if (!newImages.some((img) => img.isPrimary) && newImages[0]) {
        newImages[0].isPrimary = true;
      }
      onImagesChange(newImages);
    }
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find((img: ImageItem) => img.id === id);
    // Clean up object URL if it's a preview (has file property)
    if (
      imageToRemove?.file &&
      typeof imageToRemove.url === "string" &&
      imageToRemove.url.startsWith("blob:")
    ) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    const updated = images.filter((img) => img.id !== id);
    // If we removed the primary image, make the first one primary
    if (updated[0] && imageToRemove?.isPrimary) {
      updated[0].isPrimary = true;
    }
    onImagesChange(updated);
  };

  const setPrimary = (id: string) => {
    const updated = images.map((img) => ({
      ...img,
      isPrimary: img.id === id,
    }));
    onImagesChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-slate-300 hover:border-slate-400"}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
        <p className="text-sm text-slate-600 mb-2">
          {isDragActive ? "Drop images here" : "Drag & drop images here, or click to select"}
        </p>
        <p className="text-xs text-slate-500">PNG, JPG, GIF, WEBP up to 10MB</p>
      </div>

      {/* Sortable Image Gallery */}
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={images.map((img: ImageItem) => img.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <SortableImageItem
                  key={image.id}
                  image={image}
                  index={index}
                  onSetPrimary={setPrimary}
                  onRemove={removeImage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableImageItem({
  image,
  index,
  onSetPrimary,
  onRemove,
}: {
  image: ImageItem;
  index: number;
  onSetPrimary: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100">
        <LazyImage
          src={image.url}
          alt={`Product image ${index + 1}`}
          width={200}
          height={200}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 rounded p-1.5 cursor-grab active:cursor-grabbing z-10"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-white" />
      </div>

      {/* Overlay Actions */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSetPrimary(image.id);
          }}
          className={image.isPrimary ? "bg-yellow-500 hover:bg-yellow-600" : ""}
          title={image.isPrimary ? "Primary image" : "Set as primary"}
        >
          <Star className={`h-4 w-4 ${image.isPrimary ? "fill-white" : ""}`} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(image.id);
          }}
          title="Remove image"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Primary Badge */}
      {image.isPrimary && (
        <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1 z-10">
          <Star className="h-3 w-3 fill-white" />
          Primary
        </div>
      )}

      {/* Position Badge */}
      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
        #{index + 1}
      </div>
    </div>
  );
}
