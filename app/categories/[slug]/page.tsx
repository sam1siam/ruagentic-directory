import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import DirectoryBrowser from '@/components/directory-browser';
import { BrowseSkeleton } from '@/components/skeletons';
import { catalog } from '@/lib/server/catalog';
import { activeSponsors } from '@/lib/server/sponsors';
import { pickSponsor } from '@/lib/advertising';
import { categories, categoryBySlug, type Category } from '@/lib/categories';
import { toBrowserListing } from '@/lib/browse';
export const dynamic = 'force-dynamic';
export const dynamicParams = false;
export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const category = categoryBySlug((await params).slug);
  return category
    ? { title: category.name, description: category.description }
    : { title: 'Category not found' };
}
type Query = { q?: string; kind?: string };
/** The slug is validated before any Suspense boundary is emitted, so an
 *  unknown category is a real 404 while a known one streams a skeleton first. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Query>;
}) {
  const category = categoryBySlug((await params).slug);
  if (!category) notFound();
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <CategoryListings category={category} searchParams={searchParams} />
    </Suspense>
  );
}
async function CategoryListings({
  category,
  searchParams,
}: {
  category: Category;
  searchParams: Promise<Query>;
}) {
  const [query, items, sponsors] = await Promise.all([
    searchParams,
    catalog(),
    activeSponsors(),
  ]);
  const listings = items
    .filter((i) => i.category === category.name)
    .map(toBrowserListing);
  return (
    <DirectoryBrowser
      key={JSON.stringify(query)}
      listings={listings}
      lock={{ category: category.name }}
      initial={query}
      sponsor={pickSponsor('listing', sponsors, undefined, category.slug)}
      heading={{
        title: category.name + '.',
        lead: category.description,
        count: listings.length,
      }}
    />
  );
}
