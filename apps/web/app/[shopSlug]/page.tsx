"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Type for product summary returned from the API.
interface Product {
	id: string;
	slug: string;
	title: string;
	description: string | null;
}

/**
 * Tenant home page. Fetches all products for the given shop slug and
 * renders them in a simple grid. A hero section at the top mirrors
 * the minimalist copy of seeit.co: a catchy headline and subtext.
 */
export default function ShopPage({ params }: { params: { shopSlug: string } }) {
	const { shopSlug } = params;
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		async function loadProducts() {
			try {
				const domain = process.env.NEXT_PUBLIC_DOMAIN;
				const res = await fetch(`${domain}/api/shops/${shopSlug}/products`);
				if (res.ok) {
					const data = (await res.json()) as Product[];
					setProducts(data);
				}
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		}
		loadProducts();
	}, [shopSlug]);

	return (
		<div className="flex flex-col min-h-screen p-4">
			<header className="text-center py-12">
				<h1 className="text-4xl font-bold mb-2">They See It</h1>
				<h2 className="text-3xl text-green-600 font-semibold mb-4">
					You Earn It
				</h2>
				<p className="text-gray-600 max-w-md mx-auto">
					Sell anywhere with paid shareable links. Upload your product, set your
					price and share your link!
				</p>
			</header>
			<main className="flex-1">
				{loading ? (
					<p className="text-center">Loading products…</p>
				) : products.length === 0 ? (
					<p className="text-center">No products found for this shop.</p>
				) : (
					<ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
						{products.map((product) => (
							<li
								key={product.id}
								className="border rounded-lg p-4 hover:shadow-md transition-shadow"
							>
								<h3 className="text-lg font-medium mb-2">{product.title}</h3>
								{product.description && (
									<p className="text-gray-500 mb-2 truncate">
										{product.description}
									</p>
								)}
								<Link
									href={`/${shopSlug}/p/${product.slug}`}
									className="text-blue-600 hover:underline"
								>
									View product
								</Link>
							</li>
						))}
					</ul>
				)}
			</main>
		</div>
	);
}
