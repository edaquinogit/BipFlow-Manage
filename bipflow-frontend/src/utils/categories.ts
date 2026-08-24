export interface CategoryOption {
  id: number | string;
  name: string;
  parent?: number | string | null;
  parent_name?: string | null;
}

export type CategoryTreeNode<T extends CategoryOption> = T & {
  children: T[];
};

const categoryKey = (value: CategoryOption['id'] | CategoryOption['parent']): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
};

export const categoryHasParent = (category: CategoryOption): boolean =>
  categoryKey(category.parent) !== null;

export const compareCategoryNames = <T extends CategoryOption>(left: T, right: T): number =>
  left.name.localeCompare(right.name, 'pt-BR');

export const getCategoryDisplayName = (category: CategoryOption | null | undefined): string => {
  if (!category) {
    return 'Categoria desconhecida';
  }

  return category.parent_name ? `${category.parent_name} / ${category.name}` : category.name;
};

export function buildCategoryTree<T extends CategoryOption>(
  categories: readonly T[],
): CategoryTreeNode<T>[] {
  const byId = new Map<string, T>();
  const childrenByParent = new Map<string, T[]>();

  categories.forEach((category) => {
    const key = categoryKey(category.id);
    if (key) {
      byId.set(key, category);
    }
  });

  categories.forEach((category) => {
    const parentKey = categoryKey(category.parent);
    if (!parentKey || !byId.has(parentKey)) {
      return;
    }

    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(category);
    childrenByParent.set(parentKey, siblings);
  });

  return categories
    .filter((category) => {
      const parentKey = categoryKey(category.parent);
      return !parentKey || !byId.has(parentKey);
    })
    .sort(compareCategoryNames)
    .map((category) => {
      const key = categoryKey(category.id);
      const children = key ? [...(childrenByParent.get(key) ?? [])].sort(compareCategoryNames) : [];
      return { ...category, children };
    });
}

export function flattenCategoryTree<T extends CategoryOption>(categories: readonly T[]): T[] {
  return buildCategoryTree(categories).flatMap((category) => [
    category,
    ...category.children,
  ]);
}
