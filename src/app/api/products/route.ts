import { NextRequest, NextResponse } from "next/server";
import { fetchProductsFromS3 } from "@/lib/s3";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // 1. Basic Filters
        const keyword = searchParams.get("keyword")?.toLowerCase().trim();
        const category = searchParams.get("category")?.toLowerCase().trim();
        console.log("Searching for category", category);
        // const minScore = parseFloat(searchParams.get("minScore") || "0");
        // const minMargin = parseFloat(searchParams.ge/t("minMargin") || "0"); // Keeps legacy support

        // 2. Advanced Filters
        const searchVolumeMin = parseFloat(searchParams.get("search_volume_min") || "0");
        const blacklist = searchParams.get("blacklist")?.toLowerCase().split(",").map(w => w.trim()).filter(w => w) || [];

        // const trendWindow = searchParams.get("t

        // rend_window"); // e.g. "2025-12"
        const location = searchParams.get("location")?.toLowerCase(); // e.g. "us" or "sv"

        const gtScoreMin = parseFloat(searchParams.get("google_trend_score") || "0");

        // Amazon Filters
        const amzPriceMin = parseFloat(searchParams.get("amz_price_min") || "0");
        const amzPriceMax = parseFloat(searchParams.get("amz_price_max") || "999999");
        const reviewsMin = parseFloat(searchParams.get("reviews_min") || "0");
        const reviewsMax = parseFloat(searchParams.get("reviews_max") || "999999");
        const ratingMin = parseFloat(searchParams.get("rating_min") || "0");
        const fclMin = parseFloat(searchParams.get("fcl_min") || "0");
        const fclMax = parseFloat(searchParams.get("fcl_max") || "999999");


        // Alibaba Filters
        const marginMin = parseFloat(searchParams.get("margin_min") || "0"); // Cost Below %
        const moqMax = parseFloat(searchParams.get("moq_max") || "999999");
        const supplierRatingMin = parseFloat(searchParams.get("supplier_rating_min") || "0");
        const verifiedSupplier = searchParams.get("verified_supplier") === "true";

        // 5. Search Mode
        const searchMode = searchParams.get("search_mode") || "manual_search";

        // Determine if filters are ON or OFF
        const amazonFiltersOn = searchParams.get("amazonFilters") !== "false";
        const alibabaFiltersOn = searchParams.get("alibabaFilters") !== "false";

        const allProducts = await fetchProductsFromS3(searchMode, amazonFiltersOn, alibabaFiltersOn);
        console.log(`Successfully fetched products from S3 for mode ${searchMode} (Amz: ${amazonFiltersOn}, Ali: ${alibabaFiltersOn}):`, allProducts.length);

        // Backend Filtering
        const filteredProducts = allProducts.filter((p) => {
            // 1. Basic Filters
            const matchKeyword = !keyword || p.keyword?.toLowerCase().includes(keyword);
            const prodCategory = p.category_leaf || p.category;
            const searchCategoryVal = p.search_category;
            const matchCategory = !category ||
                (typeof searchCategoryVal === 'string' && searchCategoryVal.toLowerCase().includes(category))
            // console.log("Match Category:", matchCategory);
            // const matchScore = Number(p.final_score || 0) >= minScore;
            // Legacy margin param support
            // const matchLegacyMargin = Number(p.margin_pct || 0) >= minMargin;

            // 1.1 Date & Location (New)
            // const matchDate = !trendWindow || (p.data_collected_at || "").startsWith(trendWindow);

            // Location: Check trend_geo (demand) or source_geo (supply) or kp_geo
            const locVal = (p.trend_geo || p.kp_geo || p.source_geo || "").toLowerCase();
            const matchLocation = !location || locVal.includes(location);

            // 2. Blacklist (Title or Keyword)
            const textToScan = ((p.title || "") + " " + (p.keyword || "")).toLowerCase();
            const isBlacklisted = blacklist.some(term => textToScan.includes(term));
            // console.log("Blacklisted:", isBlacklisted);
            if (isBlacklisted) return false;

            // 3. Keyword Metrics
            const matchVol = (Number(p.avg_monthly_searches) || 0) >= searchVolumeMin;
            const gtVal = Number(p.trend_score || p.keyword_interest_score) || 0;
            const matchGT = gtVal >= gtScoreMin;

            // 4. Source Specific Filters
            const isAmazon = p.source === 'amazon';
            const isAlibaba = p.source === 'alibaba';

            let matchAmz = true;
            // Only apply Amazon sub-filters if the dashboard param is set (passed as 'on' or boolean)
            // dashboard.tsx passes amazonFilters: boolean
            // const amazonFiltersOn = searchParams.get("amazonFilters") !== "false"; // Already parsed above

            if (isAmazon && amazonFiltersOn) {
                const price = Number(p.base_price_usd) || 0;
                // For Amazon, popularity is reviews count
                const reviews = Number(p.popularity) || 0;
                const rating = Number(p.rating) || 0;
                const fcl = Number(p.fcl_price_usd) || 0;

                if (amzPriceMin > 0) matchAmz = matchAmz && (price >= amzPriceMin);
                if (amzPriceMax < 999999) matchAmz = matchAmz && (price <= amzPriceMax);
                if (reviewsMin > 0) matchAmz = matchAmz && (reviews >= reviewsMin);
                if (reviewsMax < 999999) matchAmz = matchAmz && (reviews <= reviewsMax);
                if (ratingMin > 0) matchAmz = matchAmz && (rating >= ratingMin);
                if (fclMin > 0) matchAmz = matchAmz && (fcl >= fclMin);
                if (fclMax < 999999) matchAmz = matchAmz && (fcl <= fclMax);
            }

            let matchAli = true;
            // const alibabaFiltersOn = searchParams.get("alibabaFilters") !== "false"; // Already parsed above

            if (isAlibaba && alibabaFiltersOn) {
                const margin = Number(p.margin_pct) || 0;
                const moq = Number(p.moq) || 0;
                const sRating = Number(p.supplier_rating || p.rating) || 0;
                const verified = p.verified === true || p.is_verified === true;

                if (marginMin > 0) matchAli = matchAli && (margin >= marginMin);
                if (moqMax < 999999) matchAli = matchAli && (moq <= moqMax);
                if (supplierRatingMin > 0) matchAli = matchAli && (sRating >= supplierRatingMin);
                if (verifiedSupplier && searchParams.get("verified_supplier") === "true") {
                    matchAli = matchAli && verified;
                }
            }

            // If a source is turned OFF in the dashboard, we might want to hide its results entirely?
            // Usually "Amazon Filters ON" means "Include Amazon results with these criteria".
            // If it's OFF, do we hide Amazon? Or just not filter?
            // Given the radio buttons in the UI, it likely means "Enabled/Disabled" for that source.
            if (!amazonFiltersOn && isAmazon) return false;
            if (!alibabaFiltersOn && isAlibaba) return false;

            return matchKeyword && matchCategory && matchVol && matchGT && matchAmz && matchAli && matchLocation && !isBlacklisted;
        });

        // Simple sorting by score descending if not already sorted
        filteredProducts.sort((a, b) => Number(b.final_score || 0) - Number(a.final_score || 0));

        // BigInt is not JSON serializable, convert to Number/String
        const serialized = JSON.parse(JSON.stringify(filteredProducts, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        ));

        return NextResponse.json(serialized);
    } catch (error: unknown) {
        console.error("Products API Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
