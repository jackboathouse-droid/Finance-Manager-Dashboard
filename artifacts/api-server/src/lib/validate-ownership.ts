import { db } from "@workspace/db";
import { categoriesTable, subcategoriesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Returns true if the given categoryId belongs to userId.
 * Null/undefined category IDs are always allowed (they mean "uncategorised").
 */
export async function categoryBelongsToUser(
  categoryId: number | null | undefined,
  userId: number
): Promise<boolean> {
  if (categoryId == null) return true;
  const [row] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.user_id, userId)));
  return !!row;
}

/**
 * Returns true if the given subcategoryId belongs to userId.
 * Null/undefined subcategory IDs are always allowed.
 */
export async function subcategoryBelongsToUser(
  subcategoryId: number | null | undefined,
  userId: number
): Promise<boolean> {
  if (subcategoryId == null) return true;
  const [row] = await db
    .select({ id: subcategoriesTable.id })
    .from(subcategoriesTable)
    .where(and(eq(subcategoriesTable.id, subcategoryId), eq(subcategoriesTable.user_id, userId)));
  return !!row;
}
