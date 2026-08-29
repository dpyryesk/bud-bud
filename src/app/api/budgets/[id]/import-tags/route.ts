import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCents } from '@/lib/money';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await prisma.$transaction(
    async (tx) => {
      const budget = await tx.budget.findUnique({ where: { id }, select: { id: true } });
      if (!budget) return null;
      const [tags, categories, lines] = await Promise.all([
        tx.tag.findMany({
          where: { isSource: false },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, parentId: true },
        }),
        tx.budgetCategory.findMany({ where: { budgetId: id }, orderBy: { order: 'asc' } }),
        tx.budgetLine.findMany({ where: { budgetId: id }, orderBy: { order: 'asc' } }),
      ]);
      const normalize = (name: string) => name.trim().toLocaleLowerCase();
      const existingNames = new Set([
        ...categories.map((item) => normalize(item.name)),
        ...lines.map((item) => normalize(item.name)),
      ]);
      const children = new Map<string, typeof tags>();
      for (const tag of tags) {
        if (tag.parentId) children.set(tag.parentId, [...(children.get(tag.parentId) ?? []), tag]);
      }
      const roots = tags.filter((tag) => !tag.parentId);
      const categoryByRoot = new Map<string, string>();
      let categoryOrder = categories.reduce((max, item) => Math.max(max, item.order), -1) + 1;
      let uncategorizedOrder =
        lines
          .filter((line) => !line.categoryId)
          .reduce((max, item) => Math.max(max, item.order), -1) + 1;
      let categoriesCreated = 0;
      let linesCreated = 0;

      for (const root of roots) {
        const directChildren = children.get(root.id) ?? [];
        if (!directChildren.length) continue;
        const existing = categories.find(
          (category) => normalize(category.name) === normalize(root.name),
        );
        if (existing) {
          categoryByRoot.set(root.id, existing.id);
        } else if (!existingNames.has(normalize(root.name))) {
          const created = await tx.budgetCategory.create({
            data: { budgetId: id, name: root.name, order: categoryOrder++ },
          });
          categoryByRoot.set(root.id, created.id);
          existingNames.add(normalize(root.name));
          categoriesCreated += 1;
        }
      }
      for (const root of roots) {
        const directChildren = children.get(root.id) ?? [];
        if (directChildren.length) {
          const categoryId = categoryByRoot.get(root.id);
          if (!categoryId) continue;
          let order =
            lines
              .filter((line) => line.categoryId === categoryId)
              .reduce((max, item) => Math.max(max, item.order), -1) + 1;
          for (const child of directChildren) {
            if (existingNames.has(normalize(child.name))) continue;
            await tx.budgetLine.create({
              data: {
                budgetId: id,
                categoryId,
                name: child.name,
                period: 'monthly',
                amount: toCents(100),
                order: order++,
                tags: { create: { tagId: child.id } },
              },
            });
            existingNames.add(normalize(child.name));
            linesCreated += 1;
          }
        } else if (!existingNames.has(normalize(root.name))) {
          await tx.budgetLine.create({
            data: {
              budgetId: id,
              name: root.name,
              period: 'monthly',
              amount: toCents(100),
              order: uncategorizedOrder++,
              tags: { create: { tagId: root.id } },
            },
          });
          existingNames.add(normalize(root.name));
          linesCreated += 1;
        }
      }
      return { categoriesCreated, linesCreated };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: 'Budget not found' }, { status: 404 });
}
