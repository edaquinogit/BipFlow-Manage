import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useProducts,
  resetProductsCatalogForTests,
} from "../useProducts";
import ProductService from "../../services/product.service";
import type { Product } from "../../schemas/product.schema";

describe("useProducts Composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProductsCatalogForTests();
  });

  it("should transform product data into a valid FormData for media upload", async () => {
    const { createProduct } = useProducts();
    const mockFile = new File(["image-content"], "test-product.png", {
      type: "image/png",
    });

    const productInput: Partial<Product> = {
      name: "Industrial Fabric NYC",
      price: 150,
      stock_quantity: 10,
      image: mockFile,
    };

    const created: Product = {
      id: 101,
      name: productInput.name!,
      price: 150,
      stock_quantity: 10,
      image: "http://localhost:8000/media/products/test-product.png",
      sku: "ABCD",
      category: undefined,
      is_available: true,
    };

    const serviceSpy = vi
      .spyOn(ProductService, "create")
      .mockResolvedValue(created);

    await createProduct(productInput);

    expect(serviceSpy).toHaveBeenCalled();

    const sentPayload = serviceSpy.mock.calls[0][0];

    expect(sentPayload).toBeInstanceOf(FormData);

    const imageInPayload = (sentPayload as FormData).get("image");
    expect(imageInPayload).toBeInstanceOf(File);
    expect((imageInPayload as File).name).toBe("test-product.png");
  });

  it("should format total revenue correctly even with string prices", () => {
    const { products, totalRevenue } = useProducts();

    const rowA = {
      id: 1,
      name: "A",
      price: "100.00",
      stock_quantity: 2,
      sku: "AAAA",
      is_available: true,
    } as unknown as Product;

    const rowB = {
      id: 2,
      name: "B",
      price: 50,
      stock_quantity: 5,
      sku: "BBBB",
      is_available: true,
    } as Product;

    products.value = [rowA, rowB];

    expect(totalRevenue.value).toBe("$450");
  });

  it("should populate error state when deployment fails", async () => {
    const { createProduct, error } = useProducts();

    vi.spyOn(ProductService, "create").mockRejectedValue(
      new Error("Network Failure"),
    );

    try {
      await createProduct({ name: "Fail Test" } as Partial<Product>);
    } catch {
      /* expected */
    }

    expect(error.value).toContain("Deployment failed");
  });
});
