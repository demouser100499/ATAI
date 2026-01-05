export interface Product {
  global_id?: string;
  product_id?: string;
  keyword?: string;
  title?: string;
  base_price_usd?: number;
  category?: string;
  category_leaf?: string;
  fcl_price_usd?: number;
  keyword_interest_score?: number;
  avg_monthly_searches?: number;
  margin_pct?: number;
  trend_score?: number;
  supplier_score?: number;
  price_comp_score?: number;
  final_score?: number;
  rank?: number;
  [key: string]: any; // Allow for other fields that might exist
}

export interface ProductsApiParams {
  keyword?: string;
  category?: string;
  minScore?: number;
  minMargin?: number;
}

/**
 * Fetches products from the /api/products endpoint
 * @param params - Query parameters for filtering products
 * @returns Promise<Product[]> - Array of products
 */
export async function fetchProducts(params: Record<string, any> = {}): Promise<Product[]> {
  try {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

