"use client";

import { Input } from "@repo/ui/input";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "@/i18n/navigation.client";
import { useEffect, useState } from "react";

type Props = {
  placeholder?: string;
  basePath?: string;
};

export function ProductSearchBar({
  placeholder = "Search products...",
  basePath = "/products",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const [searchQuery, setSearchQuery] = useState(urlSearch);

  // Sync search query with URL params
  useEffect(() => {
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams(searchParams.toString());
    if (searchQuery.trim()) {
      sp.set("search", searchQuery.trim());
    } else {
      sp.delete("search");
    }
    router.push(sp.toString() ? `${basePath}?${sp.toString()}` : basePath);
  };

  const handleClear = () => {
    setSearchQuery("");
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("search");
    router.push(sp.toString() ? `${basePath}?${sp.toString()}` : basePath);
  };

  return (
    <form className="relative flex-1" onSubmit={handleSubmit}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-12 h-12 rounded-full"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-4 top-1/2 -translate-y-1/2"
        >
          <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </form>
  );
}
