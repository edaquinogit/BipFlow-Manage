import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductService from "../product.service";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe("ProductService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a raw product array when the endpoint is not paginated", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Notebook",
          description: "Ultrabook",
          sku: "NOTE-001",
          price: "1000.00",
          stock_quantity: "5",
          category: 2,
          is_available: true,
          size: null,
          image: null,
          category_name: "Electronics",
          slug: "notebook",
          created_at: "2026-04-20T10:00:00Z",
          updated_at: "2026-04-20T10:00:00Z",
        },
      ],
    } as never);

    const products = await ProductService.getAll();

    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe("Notebook");
  });

  it("extracts results when the backend returns a paginated payload", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        page_size: 10,
        total_pages: 1,
        results: [
          {
            id: 7,
            name: "Camera",
            slug: "camera",
            description: "Mirrorless",
            sku: "CAM-007",
            price: "799.90",
            category: 3,
            category_name: "Photo",
            size: null,
            image: null,
            stock_quantity: 4,
            is_available: true,
            created_at: "2026-04-20T10:00:00Z",
            updated_at: "2026-04-20T10:00:00Z",
          },
        ],
      },
    } as never);

    const products = await ProductService.getAll();

    expect(products).toHaveLength(1);
    expect(products[0]?.id).toBe(7);
    expect(products[0]?.name).toBe("Camera");
    expect(products[0]?.category).toEqual({
      id: 3,
      name: "Photo",
      slug: null,
    });
  });

  it("normalizes public paginated product responses before validation", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        page_size: 12,
        total_pages: 1,
        results: [
          {
            id: 9,
            name: "Headphones",
            slug: "headphones",
            price: "199.90",
            category: 5,
            category_name: "Audio",
            image: "http://localhost:8000/media/products/2026/headphones.png",
            stock_quantity: 8,
            is_available: true,
            created_at: "2026-04-20T10:00:00Z",
          },
        ],
      },
    } as never);

    const response = await ProductService.list();

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.category).toEqual({
      id: 5,
      name: "Audio",
      slug: null,
    });
    expect(response.results[0]?.image).toContain("/media/products/");
  });
});
