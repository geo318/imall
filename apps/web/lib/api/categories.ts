export type CategoryTreeNode = {
  id: string;
  slug: string;
  key: string;
  name: string;
  fallbackName: string;
  icon: string;
  children: CategoryTreeNode[];
};

type CategoryTreeResponse = {
  categories: CategoryTreeNode[];
};

export async function fetchCategoryTree(locale: string): Promise<CategoryTreeNode[]> {
  const response = await fetch(`/api/categories/tree?locale=${encodeURIComponent(locale)}`);
  if (!response.ok) {
    throw new Error("Failed to load categories");
  }
  const data = (await response.json()) as CategoryTreeResponse;
  return data.categories ?? [];
}

export function flattenCategoryNames(nodes: CategoryTreeNode[]): string[] {
  const names: string[] = [];
  const visited = new Set<string>();

  const visit = (node: CategoryTreeNode) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    names.push(node.name);
    node.children.forEach(visit);
  };

  nodes.forEach(visit);
  return names;
}

export type CategoryOption = {
  key: string;
  slug: string;
  label: string;
  fallbackName: string;
};

export function flattenCategoryOptions(nodes: CategoryTreeNode[]): CategoryOption[] {
  const options: CategoryOption[] = [];
  const visited = new Set<string>();

  const visit = (node: CategoryTreeNode) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    options.push({
      key: node.key,
      slug: node.slug,
      label: node.name,
      fallbackName: node.fallbackName,
    });
    node.children.forEach(visit);
  };

  nodes.forEach(visit);
  return options;
}
