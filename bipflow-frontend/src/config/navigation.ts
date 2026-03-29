import {
  Squares2X2Icon,
  TagIcon,
  ShoppingBagIcon,
  ChartBarIcon,
} from "@heroicons/vue/24/outline";

export const navigationItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: Squares2X2Icon,
  },
  {
    name: "Products",
    path: "/products",
    icon: ShoppingBagIcon,
  },
  {
    name: "Categories",
    path: "/categories",
    icon: TagIcon,
  },
  {
    name: "Analytics",
    path: "/analytics",
    icon: ChartBarIcon,
    disabled: true, // Exemplo de maturidade: item planejado
  },
];
