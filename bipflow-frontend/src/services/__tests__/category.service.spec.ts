import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api";
import { categoryService } from "../category.service";

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

describe("CategoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns categories from a raw array payload", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Electronics",
          slug: "electronics",
          description: "Devices",
        },
      ],
    } as never);

    const categories = await categoryService.getAll();

    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Electronics");
  });

  it("returns categories from a paginated payload", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        page_size: 20,
        total_pages: 1,
        results: [
          {
            id: 2,
            name: "Books",
            slug: "books",
            description: "Reading",
          },
        ],
      },
    } as never);

    const categories = await categoryService.getAll();

    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      id: 2,
      name: "Books",
    });
  });
});
