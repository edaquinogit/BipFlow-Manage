import type { AxiosError } from "axios";
import api from "./api";
import {
  CategorySchema,
  type Category,
  
} from "../schemas/category.schema";

const ENDPOINT = "v1/categories/" as const;

export class CategoryServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "CategoryServiceError";
  }
}

export class CategoryNotFoundError extends CategoryServiceError {
  constructor(id: number) {
    super(`Category with id ${id} not found`, undefined, 404);
    this.name = "CategoryNotFoundError";
  }
}

function parseOrThrow(data: unknown, context: string): Category {
  const result = CategorySchema.safeParse(data);
  if (!result.success) {
    throw new CategoryServiceError(
      `[CategoryService] Schema validation failed on "${context}"`,
      result.error,
    );
  }
  return result.data;
}

function resolveAxiosError(error: unknown, fallback: string): never {
  const axiosError = error as AxiosError;
  throw new CategoryServiceError(fallback, error, axiosError?.response?.status);
}

class CategoryService {
  async getAll(): Promise<Category[]> {
    try {
      const { data } = await api.get<unknown[]>(ENDPOINT);
      return data.map((item, index) => parseOrThrow(item, `getAll[${index}]`));
    } catch (error) {
      if (error instanceof CategoryServiceError) throw error;
      resolveAxiosError(error, "[CategoryService] Failed to fetch categories");
    }
  }

  async create(payload: Partial<Category>): Promise<Category> {
    try {
      const { data } = await api.post<unknown>(ENDPOINT, payload);
      return parseOrThrow(data, "create");
    } catch (error) {
      if (error instanceof CategoryServiceError) throw error;
      resolveAxiosError(error, "[CategoryService] Failed to create category");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`${ENDPOINT}${id}/`);
    } catch (error) {
      if (error instanceof CategoryServiceError) throw error;
      const status = (error as AxiosError)?.response?.status;
      if (status === 404) throw new CategoryNotFoundError(id);
      resolveAxiosError(error, `[CategoryService] Failed to delete category ${id}`);
    }
  }
}

export const categoryService = new CategoryService();
