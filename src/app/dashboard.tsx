'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { fetchProducts, Product } from '@/lib/productsService';

// Countries with geo codes - moved outside component since it's static
const countries = [
  { name: 'United States', code: 'US' },
  { name: 'Canada', code: 'CA' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Belize', code: 'BZ' },
  { name: 'Costa Rica', code: 'CR' },
  { name: 'El Salvador', code: 'SV' },
  { name: 'Panama', code: 'PA' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Bolivia', code: 'BO' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Chile', code: 'CL' }
];

const Dashboard = () => {
  // Add client-side only rendering to prevent hydration mismatch
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Countries with geo codes
  const [searchingFilters, setSearchingFilters] = useState('');
  const [location, setLocation] = useState('');
  const [activeSearch, setActiveSearch] = useState(true);
  const [searchingMode, setSearchingMode] = useState('MANUAL');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [kwpMonthlySearches, setKwpMonthlySearches] = useState('');
  const [variantLimitMax, setVariantLimitMax] = useState('');
  const [resultsCap, setResultsCap] = useState('');
  const [googleTrendScore, setGoogleTrendScore] = useState(0);
  const [productCategory, setProductCategory] = useState('All categories');
  const [trendPeriod, setTrendPeriod] = useState('');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [blacklistedWords, setBlacklistedWords] = useState('');
  const [amazonFilters, setAmazonFilters] = useState(true);
  const [alibabaFilters, setAlibabaFilters] = useState(true);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100);
  const [reviewsMin, setReviewsMin] = useState(0);
  const [reviewsMax, setReviewsMax] = useState(100);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [fcl, setFcl] = useState(0.0);
  const [costBelow, setCostBelow] = useState(0.0);
  const [moq, setMoq] = useState('');
  const [alibabaRating, setAlibabaRating] = useState(0);
  const [verifiedSupplier, setVerifiedSupplier] = useState(false);
  const [savePreset, setSavePreset] = useState('SAVE PRESET 1');

  // Products API state
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pipeline State
  const [pipelineStatus, setPipelineStatus] = useState<'IDLE' | 'STARTING' | 'POLLING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [executionArn, setExecutionArn] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pollingIntervalRef, setPollingIntervalRef] = useState<NodeJS.Timeout | null>(null);
  const [isPreliminary, setIsPreliminary] = useState(false);
  const [hasPerformedSearch, setHasPerformedSearch] = useState(false);
  const [categoryExecutions, setCategoryExecutions] = useState<{ keyword: string, run_id: string, execution_arn: string, status?: string }[]>([]);
  // Category test mode: keywords from Google Trends only (no pipeline trigger)
  const [categoryKeywordsPreview, setCategoryKeywordsPreview] = useState<string[] | null>(null);
  // Remember the core search context used for the last executed run.
  // This lets us re-apply / refine filters against the same consolidated dataset
  // without accidentally changing the root keyword/location until the user clicks SEARCH again.
  const [lastSearchContext, setLastSearchContext] = useState<{
    keyword?: string;
    category?: string;
    location?: string;
    search_mode: string;
  } | null>(null);

  // Per-product expansion for nested stage specifications within the main table
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // For CATEGORY BASED mode: currently selected category variant keyword filter
  const [selectedCategoryVariant, setSelectedCategoryVariant] = useState<string>('ALL');

  // When in CATEGORY BASED mode and user selects a specific keyword, use that execution's ARN for stage data (Keyword Planner, Trends, Amazon, Alibaba)
  const effectiveStageArn = useMemo(() => {
    if (searchingMode === 'CATEGORY BASED' && selectedCategoryVariant && selectedCategoryVariant !== 'ALL') {
      const selected = selectedCategoryVariant.trim();
      const exec = categoryExecutions.find((e) => (e.keyword ?? '').trim() === selected);
      return exec?.execution_arn ?? null;
    }
    return executionArn;
  }, [searchingMode, selectedCategoryVariant, categoryExecutions, executionArn]);

  // Keyword Planner stage data
  const [keywordPlannerResults, setKeywordPlannerResults] = useState<any[] | null>(null);
  const [keywordPlannerMeta, setKeywordPlannerMeta] = useState<{ message?: string; rows?: number } | null>(null);
  const [hasLoadedKeywordPlanner, setHasLoadedKeywordPlanner] = useState(false);

  // Google Trends stage data
  const [trendsResults, setTrendsResults] = useState<any[] | null>(null);
  const [trendsMeta, setTrendsMeta] = useState<{ message?: string; rows?: number } | null>(null);
  const [hasLoadedTrends, setHasLoadedTrends] = useState(false);

  // Marketplace stage data   
  const [amazonResults, setAmazonResults] = useState<any[] | null>(null);
  const [amazonMeta, setAmazonMeta] = useState<{ message?: string; rows?: number } | null>(null);
  const [hasLoadedAmazon, setHasLoadedAmazon] = useState(false);
  const [alibabaResults, setAlibabaResults] = useState<any[] | null>(null);
  const [alibabaMeta, setAlibabaMeta] = useState<{ message?: string; rows?: number } | null>(null);
  const [hasLoadedAlibaba, setHasLoadedAlibaba] = useState(false);

  // Check if fields should be disabled (after successful pipeline completion)
  // KEYWORD SEARCH and LOCATION should remain enabled
  const pipelineFieldsDisabled = pipelineStatus === 'COMPLETED'; // For VARIANT LIMIT MAX, RESULTS CAP MAX, TREND PERIOD
  const fieldsDisabled = false; // KEYWORD SEARCH and LOCATION are never disabled

  // Helper: get value from row by exact key or by matching key (normalize: lowercase, underscores/spaces collapsed).
  const getRowKeywordValue = (row: Record<string, unknown>, primaryKey: string): unknown => {
    if (row[primaryKey] !== undefined && row[primaryKey] !== null) return row[primaryKey];
    const normalizedPrimary = primaryKey.toLowerCase().replace(/[\s_]+/g, ' ');
    for (const key of Object.keys(row)) {
      const normalizedKey = key.toLowerCase().replace(/_/g, ' ');
      if (normalizedKey === normalizedPrimary) return row[key];
    }
    return undefined;
  };

  // Helper: in category mode with a variant selected, filter stage rows to only those whose primary keyword matches the selected variant (normalized).
  const filterStageRowsByVariant = useCallback(
    (rows: any[] | null, fields: string[], primaryKeywordField?: string): any[] | null => {
      if (!rows || rows.length === 0) return rows;
      const variant = searchingMode === 'CATEGORY BASED' && selectedCategoryVariant && selectedCategoryVariant !== 'ALL'
        ? selectedCategoryVariant.trim().toLowerCase().replace(/\s+/g, ' ')
        : null;
      if (!variant) return rows;

      const primary = primaryKeywordField ?? fields[0];
      const normalize = (v: unknown) =>
        (v != null ? String(v).trim().toLowerCase().replace(/\s+/g, ' ') : '');

      return rows.filter((row) => {
        const val = getRowKeywordValue(row as Record<string, unknown>, primary);
        return normalize(val) === variant;
      });
    },
    [searchingMode, selectedCategoryVariant]
  );

  // Export current pipeline execution's stage data (KWP, Trends, Amazon, Alibaba) as a single Excel file with one sheet per stage.
  const handleExportCsv = useCallback(async () => {
    if (pipelineStatus !== 'COMPLETED') return;

    // Determine which execution ARN to export:
    // - MANUAL / ATAI AUTO: use main executionArn
    // - CATEGORY BASED: use the selected variant's execution_arn, or first child execution (never parent executionArn — stage data is per child)
    let arnToUse: string | null = null;
    if (searchingMode === 'CATEGORY BASED') {
      const selectedExec =
        selectedCategoryVariant && selectedCategoryVariant !== 'ALL'
          ? categoryExecutions.find((e) => e.keyword === selectedCategoryVariant)
          : categoryExecutions[0];
      arnToUse = selectedExec?.execution_arn ?? null;
    } else {
      arnToUse = executionArn;
    }

    if (!arnToUse) {
      console.warn('No execution ARN available for export.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const [kwpRes, trendsRes, amzRes, aliRes] = await Promise.all([
        fetch(`/api/pipeline/keyword-planner?arn=${encodeURIComponent(arnToUse)}`),
        fetch(`/api/pipeline/google-trends?arn=${encodeURIComponent(arnToUse)}`),
        fetch(`/api/pipeline/amazon?arn=${encodeURIComponent(arnToUse)}`),
        fetch(`/api/pipeline/alibaba?arn=${encodeURIComponent(arnToUse)}`),
      ]);

      const parse = async (res: Response): Promise<any[] | null> => {
        if (!res.ok) return null;
        const data = await res.json() as { success?: boolean; available?: boolean; results?: any[] };
        if (data.success && data.available && Array.isArray(data.results) && data.results.length > 0) {
          return data.results;
        }
        return null;
      };

      const [kwpRows, trendsRows, amzRows, aliRows] = await Promise.all([
        parse(kwpRes),
        parse(trendsRes),
        parse(amzRes),
        parse(aliRes),
      ]);

      if (kwpRows?.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kwpRows), 'Keyword Planner');
      }
      if (trendsRows?.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendsRows), 'Google Trends');
      }
      if (amzRows?.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(amzRows), 'Amazon');
      }
      if (aliRows?.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aliRows), 'Alibaba');
      }

      const sheetCount = wb.SheetNames.length;
      if (sheetCount === 0) {
        console.warn('No stage data available to export for ARN', arnToUse);
        return;
      }

      const now = new Date();
      const datePart = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let baseKeyword: string;
      if (searchingMode === 'CATEGORY BASED') {
        if (selectedCategoryVariant && selectedCategoryVariant !== 'ALL') {
          baseKeyword = selectedCategoryVariant;
        } else if (categoryExecutions[0]?.keyword) {
          baseKeyword = categoryExecutions[0].keyword;
        } else {
          baseKeyword = 'category';
        }
      } else {
        baseKeyword = keywordSearch || 'search';
      }

      const safeKeyword =
        baseKeyword
          .trim()
          .replace(/[\\/:*?"<>|]+/g, '')
          .replace(/\s+/g, '_') || 'search';

      const fileName = `${safeKeyword}_${datePart}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Error exporting Excel:', err);
    }
  }, [pipelineStatus, searchingMode, selectedCategoryVariant, categoryExecutions, executionArn, keywordSearch]);

  // Info button component with tooltip
  const InfoButton = ({ message }: { message: string }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <div className="relative inline-block ml-2">
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="w-4 h-4 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-600 transition-colors"
        >
          i
        </button>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
            {message}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
          </div>
        )}
      </div>
    );
  };

  // Individual field validation errors
  const [keywordSearchError, setKeywordSearchError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [variantLimitMaxError, setVariantLimitMaxError] = useState('');
  const [resultsCapError, setResultsCapError] = useState('');
  const [trendPeriodError, setTrendPeriodError] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.trend-dropdown')) {
        setShowTrendDropdown(false);
      }
    };

    if (showTrendDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTrendDropdown]);

  // Clear results and filters when searching mode changes
  useEffect(() => {
    // Clear Results & Status
    setProducts([]);
    setError(null);
    setPipelineStatus('IDLE');
    setExecutionArn(null);
    setStatusMessage('');
    setIsPreliminary(false);
    setCategoryExecutions([]);
    setKeywordPlannerResults(null);
    setKeywordPlannerMeta(null);
    setHasLoadedKeywordPlanner(false);
    setTrendsResults(null);
    setTrendsMeta(null);
    setHasLoadedTrends(false);
    setAmazonResults(null);
    setAmazonMeta(null);
    setHasLoadedAmazon(false);
    setAlibabaResults(null);
    setAlibabaMeta(null);
    setHasLoadedAlibaba(false);

    // Clear Validation Errors
    setKeywordSearchError('');
    setLocationError('');
    setVariantLimitMaxError('');
    setResultsCapError('');
    setTrendPeriodError('');

    // Reset All Filters to Defaults
    setKeywordSearch('');
    setProductCategory('All categories');
    setKwpMonthlySearches('');
    setBlacklistedWords('');
    setGoogleTrendScore(0);
    setPriceMin(0);
    setPriceMax(100);
    setReviewsMin(0);
    setReviewsMax(100);
    setRatingFilter(0);
    setFcl(0.0);
    setCostBelow(0.0);
    setMoq('');
    setAlibabaRating(0);
    setVerifiedSupplier(false);

    // Reset Pipeline-specific configs
    setTrendPeriod('');
    setVariantLimitMax('');
    setResultsCap('');
    setLocation(''); // Resetting location too for complete isolation
  }, [searchingMode]);

  const toTitleCase = (str: string): string => {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getCountryCode = useCallback((countryName: string): string => {
    const country = countries.find(c => c.name === countryName);
    return country ? country.code : '';
  }, []);

  const handleReset = useCallback(() => {
    setSearchingFilters('');
    setLocation('');
    setActiveSearch(true);
    setSearchingMode('MANUAL');
    setKeywordSearch('');
    setKwpMonthlySearches('');
    setVariantLimitMax('');
    setResultsCap('');
    setGoogleTrendScore(0);
    setProductCategory('All categories');
    setTrendPeriod('');
    setBlacklistedWords('');
    setAmazonFilters(true);
    setAlibabaFilters(true);
    setPriceMin(0);
    setPriceMax(100);
    setReviewsMin(0);
    setReviewsMax(100);
    setRatingFilter(0);
    setFcl(0.00);
    setCostBelow(0.00);
    setMoq('');
    setAlibabaRating(0);
    setVerifiedSupplier(false);

    setProducts([]);
    setIsLoading(false);
    setError(null);
    setPipelineStatus('IDLE');
    setExecutionArn(null);
    setStatusMessage('');
    setIsPreliminary(false);
    setHasPerformedSearch(false);
    setCategoryExecutions([]);
    setKeywordPlannerResults(null);
    setKeywordPlannerMeta(null);
    setHasLoadedKeywordPlanner(false);
    setTrendsResults(null);
    setTrendsMeta(null);
    setHasLoadedTrends(false);
    setAmazonResults(null);
    setAmazonMeta(null);
    setHasLoadedAmazon(false);
    setAlibabaResults(null);
    setAlibabaMeta(null);
    setHasLoadedAlibaba(false);

    // Clear validation errors
    setKeywordSearchError('');
    setLocationError('');
    setVariantLimitMaxError('');
    setResultsCapError('');
    setTrendPeriodError('');
  }, []);


  // Pipeline workflow functions

  // Handle Active Search toggle
  const handleActiveSearchToggle = (checked: boolean) => {
    setActiveSearch(checked);

    // Reset all fields when toggling Active Search on or off
    setSearchingFilters('');
    setLocation('');
    setSearchingMode('MANUAL');
    setKeywordSearch('');
    setKwpMonthlySearches('');
    setVariantLimitMax('');
    setResultsCap('');
    setGoogleTrendScore(0);
    setProductCategory('All categories');
    setTrendPeriod('');
    setBlacklistedWords('');
    setAmazonFilters(true);
    setAlibabaFilters(true);
    setPriceMin(0);
    setPriceMax(100);
    setReviewsMin(0);
    setReviewsMax(100);
    setRatingFilter(0);
    setFcl(0.00);
    setCostBelow(0.00);
    setMoq('');
    setAlibabaRating(0);
    setVerifiedSupplier(false);

    setProducts([]);
    setIsLoading(false);
    setError(null);
    setPipelineStatus('IDLE');
    setExecutionArn(null);
    setStatusMessage('');
    setIsPreliminary(false);
    setCategoryExecutions([]);
    setHasPerformedSearch(false);
    setKeywordPlannerResults(null);
    setKeywordPlannerMeta(null);
    setHasLoadedKeywordPlanner(false);
    setTrendsResults(null);
    setTrendsMeta(null);
    setHasLoadedTrends(false);
    setAmazonResults(null);
    setAmazonMeta(null);
    setHasLoadedAmazon(false);
    setAlibabaResults(null);
    setAlibabaMeta(null);
    setHasLoadedAlibaba(false);

    // Clear validation errors
    setKeywordSearchError('');
    setLocationError('');
    setVariantLimitMaxError('');
    setResultsCapError('');
    setTrendPeriodError('');
  };

  // Handle stopping the current pipeline search
  const handleStopSearch = async () => {
    if (!executionArn) return;

    try {
      const response = await fetch(`/api/pipeline/stop?arn=${encodeURIComponent(executionArn)}`, {
        method: 'POST'
      });


      if (response.ok) {
        const data = await response.json();
        console.log('Pipeline stopped successfully:', data);

        // Clear the polling interval
        if (pollingIntervalRef) {
          clearInterval(pollingIntervalRef);
          setPollingIntervalRef(null);
        }

        // Update pipeline state
        setPipelineStatus('FAILED');
        setStatusMessage('ABORTED');
        setIsLoading(false);
        // Don't set error for manual stop

      } else {
        console.error('Failed to stop pipeline');
      }
    } catch (error) {
      console.error('Error stopping pipeline:', error);
    }
  };

  const getApiParams = useCallback(() => {
    // Decide which keyword filter to send to the backend.
    // - MANUAL / ATAI AUTO: use keywordSearch.
    // - CATEGORY BASED: use selectedCategoryVariant when a specific variant is chosen.
    let effectiveKeyword: string | undefined;
    if (searchingMode === 'CATEGORY BASED') {
      if (selectedCategoryVariant && selectedCategoryVariant !== 'ALL') {
        effectiveKeyword = selectedCategoryVariant;
      }
    } else if (searchingMode === 'MANUAL' || searchingMode === 'ATAI AUTO') {
      effectiveKeyword = keywordSearch || undefined;
    }

    // Category runs use manual_search Step Function executions, so ranked output lives under manual_search S3 path; fetch with manual_search so we read that data
    const productsSearchMode = searchingMode === 'CATEGORY BASED' ? 'manual_search' : (searchModeMap[searchingMode] || 'manual_search');

    return {
      // Basic filters
      keyword: effectiveKeyword,
      category: (searchingMode === 'CATEGORY BASED' && productCategory !== 'All categories') ? productCategory : undefined,
      search_volume_min: kwpMonthlySearches || undefined,
      blacklist: blacklistedWords || undefined,
      location: getCountryCode(location) || undefined,
      search_mode: productsSearchMode,
      // Google Trend Score filter (when greater than 0)
      ...(googleTrendScore > 0 && { google_trend_score: googleTrendScore }),

      // Source toggle indicators
      amazonFilters: amazonFilters,
      alibabaFilters: alibabaFilters,

      // Amazon filters (only when AMAZON FILTERS is ON and values are set)
      ...(amazonFilters && priceMin > 0 && { amz_price_min: priceMin }),
      ...(amazonFilters && priceMax < 100 && { amz_price_max: priceMax }),
      ...(amazonFilters && reviewsMin > 0 && { reviews_min: reviewsMin }),
      ...(amazonFilters && reviewsMax < 100 && { reviews_max: reviewsMax }),
      ...(amazonFilters && ratingFilter > 0 && { rating_min: ratingFilter }),
      ...(amazonFilters && fcl > 0 && { fcl_min: fcl }),

      // Alibaba filters (only when ALIBABA SUPPLIER FILTERS is ON and values are set)
      ...(alibabaFilters && costBelow > 0 && { margin_min: costBelow }),
      ...(alibabaFilters && moq && { moq_max: parseInt(moq) }),
      ...(alibabaFilters && alibabaRating > 0 && { supplier_rating_min: alibabaRating }),
      ...(alibabaFilters && verifiedSupplier && { verified_supplier: "true" }),
    };
  }, [
    keywordSearch,
    selectedCategoryVariant,
    kwpMonthlySearches,
    blacklistedWords,
    location,
    googleTrendScore,
    amazonFilters,
    alibabaFilters,
    priceMin,
    priceMax,
    reviewsMin,
    reviewsMax,
    ratingFilter,
    fcl,
    costBelow,
    moq,
    alibabaRating,
    verifiedSupplier,
    productCategory,
    getCountryCode,
    searchingMode
  ]);

  const searchModeMap: Record<string, string> = {
    'MANUAL': 'manual_search',
    'CATEGORY BASED': 'category_search',
    'ATAI AUTO': 'auto_search'
  };

  const handleSearch = useCallback(async () => {
    // Clear previous validation errors
    setKeywordSearchError('');
    setLocationError('');
    setVariantLimitMaxError('');
    setResultsCapError('');
    setTrendPeriodError('');

    // Validate required fields
    let hasErrors = false;

    // Validate required fields ONLY if activeSearch is ON and pipeline hasn't completed yet
    if (activeSearch && pipelineStatus !== 'COMPLETED') {
      if (searchingMode === 'MANUAL' && !keywordSearch.trim()) {
        setKeywordSearchError('Keyword Search is required');
        hasErrors = true;
      }
      if (searchingMode === 'CATEGORY BASED' && !productCategory) {
        // Maybe set an error for category if needed, but it has a default 'All categories' or similar? 
        // If "All categories" is valid, no error. If we need specific, we should check.
        // Assuming All categories is valid or user must pick one. 
        // Let's assume validation passes if productCategory is set (which it is by default).
      }

      if (!location.trim()) {
        setLocationError('Location is required');
        hasErrors = true;
      }
      if (!variantLimitMax.trim()) {
        setVariantLimitMaxError('Variant Limit Max is required');
        hasErrors = true;
      }
      if (!resultsCap.trim()) {
        setResultsCapError('Results Cap Max is required');
        hasErrors = true;
      }
      if (!trendPeriod.trim()) {
        setTrendPeriodError('Trend Period is required');
        hasErrors = true;
      }
    }

    if (hasErrors) {
      return;
    }

    setIsLoading(true);
    setProducts([]); // Clear old results immediately
    setError(null);
    setIsPreliminary(false);
    setPipelineStatus('IDLE');
    setExecutionArn(null);
    setStatusMessage('');
    setHasPerformedSearch(true);
    setSelectedCategoryVariant('ALL');
    setCategoryKeywordsPreview(null);
    setKeywordPlannerResults(null);
    setKeywordPlannerMeta(null);
    setHasLoadedKeywordPlanner(false);
    setTrendsResults(null);
    setTrendsMeta(null);
    setHasLoadedTrends(false);
    setAmazonResults(null);
    setAmazonMeta(null);
    setHasLoadedAmazon(false);
    setAlibabaResults(null);
    setAlibabaMeta(null);
    setHasLoadedAlibaba(false);

    try {
      // Capture the core search context used for this run.
      // This is the "base dataset" that subsequent filter tweaks will refine.
      const searchModeKey = searchModeMap[searchingMode] || 'manual_search';
      const searchKeyword =
        (searchingMode === 'MANUAL' || searchingMode === 'ATAI AUTO') ? (keywordSearch || undefined) : undefined;
      const searchCategory =
        (searchingMode === 'CATEGORY BASED' && productCategory !== 'All categories')
          ? productCategory
          : undefined;
      const searchLocation = getCountryCode(location) || undefined;

      const newSearchContext = {
        keyword: searchKeyword,
        category: searchCategory,
        location: searchLocation,
        search_mode: searchModeKey,
      };
      setLastSearchContext(newSearchContext);

      if (activeSearch) {
        // Active Search is ON: trigger pipeline (for MANUAL/ATAI AUTO one run; for CATEGORY BASED, backend generates keywords from Google Trends and starts one run per keyword)

        // Step 1: Trigger Pipeline
        setPipelineStatus('STARTING');
        setStatusMessage('STARTING');

        const payload = {
          keyword: searchKeyword || "",
          search_mode: searchModeKey,
          filters: {
            location: searchLocation,
            category: searchCategory || "",
            trendPeriod: trendPeriod ? parseInt(trendPeriod) : undefined,
            variantLimitMax: variantLimitMax ? parseInt(variantLimitMax) : undefined,
            size: resultsCap ? parseInt(resultsCap) : undefined,
            amazonFilters,
            alibabaFilters,
            blacklist: blacklistedWords || undefined,
            fcl_percentage: fcl,
            search_volume_min: kwpMonthlySearches ? parseInt(kwpMonthlySearches) : undefined,
            google_trend_score: googleTrendScore > 0 ? googleTrendScore : undefined,
            amz_price_min: amazonFilters && priceMin > 0 ? priceMin : undefined,
            amz_price_max: amazonFilters && priceMax < 100 ? priceMax : undefined,
            reviews_min: amazonFilters && reviewsMin > 0 ? reviewsMin : undefined,
            reviews_max: amazonFilters && reviewsMax < 100 ? reviewsMax : undefined,
            rating_min: amazonFilters && ratingFilter > 0 ? ratingFilter : undefined,
            fcl_min: amazonFilters && fcl > 0 ? fcl : undefined,
            margin_min: alibabaFilters && costBelow > 0 ? costBelow : undefined,
            moq_max: alibabaFilters && moq ? parseInt(moq) : undefined,
            supplier_rating_min: alibabaFilters && alibabaRating > 0 ? alibabaRating : undefined,
            verified_supplier: alibabaFilters ? verifiedSupplier : undefined,
          }
        };

        const triggerResponse = await fetch('/api/pipeline/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!triggerResponse.ok) {
          const errorData = await triggerResponse.json();
          throw new Error(errorData.error || 'Failed to trigger pipeline');
        }

        const triggerData = await triggerResponse.json();
        console.log("\n 0000000000000000", triggerData);

        if (!triggerData.success) {
          throw new Error(triggerData.message || 'No data found for this search');
        }

        if (triggerData.execution_details) {
          setCategoryExecutions(triggerData.execution_details.map((ex: any) => ({ ...ex, status: 'RUNNING' })));
          // Show which keywords were generated from Google Trends for this category run
          setCategoryKeywordsPreview(triggerData.execution_details.map((ex: { keyword?: string }) => ex.keyword).filter(Boolean));
        } else {
          setCategoryExecutions([]);
          setCategoryKeywordsPreview(searchingMode === 'CATEGORY BASED' ? [] : null);
        }

        setExecutionArn(triggerData.executionArn);
        setPipelineStatus('POLLING');
        setStatusMessage('RUNNING');

        // Note: status polling is now handled by the Polling Effect below
      } else {
        // Active Search is OFF - just refine / fetch products from the latest consolidated dataset
        // using the current filters, without re-running the pipeline.
        const params = getApiParams();
        const results = await fetchProducts(params);
        setProducts(results);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(errorMessage);
      setProducts([]);
      if (activeSearch && pipelineStatus !== 'COMPLETED') {
        setPipelineStatus('FAILED');
        setStatusMessage(`Error: ${errorMessage}`);
      }
    } finally {
      if (!activeSearch || pipelineStatus === 'COMPLETED') {
        setIsLoading(false);
      }
      // For activeSearch with new pipeline, loading will be set to false when pipeline completes
    }
  }, [
    activeSearch,
    pipelineStatus,
    keywordSearch,
    location,
    variantLimitMax,
    resultsCap,
    trendPeriod,
    getApiParams,
    getCountryCode,
    amazonFilters,
    alibabaFilters,
    searchingMode,
    productCategory,
    blacklistedWords,
    fcl,
    kwpMonthlySearches,
    googleTrendScore,
    priceMin,
    priceMax,
    reviewsMin,
    reviewsMax,
    ratingFilter,
    costBelow,
    moq,
    alibabaRating,
    verifiedSupplier,
    searchModeMap,
  ]);

  // Automatically refine the currently loaded consolidated dataset when
  // the user adjusts filter thresholds, WITHOUT re-running the pipeline.
  useEffect(() => {
    if (!lastSearchContext) return;
    if (!hasPerformedSearch) return;

    // If Active Search is ON and the pipeline is still running,
    // wait until it completes before auto-refining.
    if (activeSearch && pipelineStatus !== 'COMPLETED') return;

    const refine = async () => {
      try {
        // Category runs write to manual_search S3 path; fetch with manual_search so we read that data
        const productsSearchMode = lastSearchContext.search_mode === 'category_search' ? 'manual_search' : lastSearchContext.search_mode;
        const params: Record<string, any> = {
          keyword: lastSearchContext.keyword,
          category: lastSearchContext.category,
          location: lastSearchContext.location,
          search_mode: productsSearchMode,
          search_volume_min: kwpMonthlySearches || undefined,
          blacklist: blacklistedWords || undefined,
          ...(googleTrendScore > 0 && { google_trend_score: googleTrendScore }),
          amazonFilters,
          alibabaFilters,
          ...(amazonFilters && priceMin > 0 && { amz_price_min: priceMin }),
          ...(amazonFilters && priceMax < 100 && { amz_price_max: priceMax }),
          ...(amazonFilters && reviewsMin > 0 && { reviews_min: reviewsMin }),
          ...(amazonFilters && reviewsMax < 100 && { reviews_max: reviewsMax }),
          ...(amazonFilters && ratingFilter > 0 && { rating_min: ratingFilter }),
          ...(amazonFilters && fcl > 0 && { fcl_min: fcl }),
          ...(alibabaFilters && costBelow > 0 && { margin_min: costBelow }),
          ...(alibabaFilters && moq && { moq_max: parseInt(moq) }),
          ...(alibabaFilters && alibabaRating > 0 && { supplier_rating_min: alibabaRating }),
          ...(alibabaFilters && verifiedSupplier && { verified_supplier: "true" }),
        };

        const results = await fetchProducts(params);
        setProducts(results);
      } catch (err) {
        console.error('Error refining products with updated filters', err);
      }
    };

    refine();
  }, [
    lastSearchContext,
    hasPerformedSearch,
    activeSearch,
    pipelineStatus,
    kwpMonthlySearches,
    blacklistedWords,
    googleTrendScore,
    amazonFilters,
    alibabaFilters,
    priceMin,
    priceMax,
    reviewsMin,
    reviewsMax,
    ratingFilter,
    fcl,
    costBelow,
    moq,
    alibabaRating,
    verifiedSupplier,
  ]);



  // When user changes the category variant dropdown, clear stage data so we refetch for the selected keyword
  const handleCategoryVariantChange = useCallback((newValue: string) => {
    setSelectedCategoryVariant(newValue);
    setKeywordPlannerResults(null);
    setKeywordPlannerMeta(null);
    setTrendsResults(null);
    setTrendsMeta(null);
    setAmazonResults(null);
    setAmazonMeta(null);
    setAlibabaResults(null);
    setAlibabaMeta(null);
    setHasLoadedKeywordPlanner(false);
    setHasLoadedTrends(false);
    setHasLoadedAmazon(false);
    setHasLoadedAlibaba(false);
  }, []);

  // In category mode, when pipeline is completed and user selects a variant, fetch that keyword's stage data (same as manual mode)
  useEffect(() => {
    if (searchingMode !== 'CATEGORY BASED' || pipelineStatus !== 'COMPLETED') return;

    const selected = selectedCategoryVariant?.trim();
    if (!selected || selected === 'ALL') return;

    const exec = categoryExecutions.find((e) => (e.keyword ?? '').trim() === selected);
    const arnToFetch = exec?.execution_arn ?? null;
    if (!arnToFetch) return;

    let cancelled = false;
    const fetchStagesForVariant = async () => {
      try {
        const [kwpRes, trendsRes, amzRes, aliRes] = await Promise.all([
          fetch(`/api/pipeline/keyword-planner?arn=${encodeURIComponent(arnToFetch)}`),
          fetch(`/api/pipeline/google-trends?arn=${encodeURIComponent(arnToFetch)}`),
          amazonFilters ? fetch(`/api/pipeline/amazon?arn=${encodeURIComponent(arnToFetch)}`) : Promise.resolve(null),
          alibabaFilters ? fetch(`/api/pipeline/alibaba?arn=${encodeURIComponent(arnToFetch)}`) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (kwpRes?.ok) {
          const kwpData = await kwpRes.json();
          if (!cancelled && kwpData.success && kwpData.available && kwpData.results?.length > 0) {
            setKeywordPlannerResults(kwpData.results);
            setKeywordPlannerMeta(kwpData.meta || null);
            setHasLoadedKeywordPlanner(true);
          }
        }
        if (trendsRes?.ok) {
          const trendsData = await trendsRes.json();
          if (!cancelled && trendsData.success && trendsData.available && trendsData.results?.length > 0) {
            setTrendsResults(trendsData.results);
            setTrendsMeta(trendsData.meta || null);
            setHasLoadedTrends(true);
          }
        }
        if (amzRes?.ok) {
          const amzData = await amzRes.json();
          if (!cancelled && amzData.success && amzData.available && amzData.results?.length > 0) {
            setAmazonResults(amzData.results);
            setAmazonMeta(amzData.meta || null);
            setHasLoadedAmazon(true);
          }
        }
        if (aliRes?.ok) {
          const aliData = await aliRes.json();
          if (!cancelled && aliData.success && aliData.available && aliData.results?.length > 0) {
            setAlibabaResults(aliData.results);
            setAlibabaMeta(aliData.meta || null);
            setHasLoadedAlibaba(true);
          }
        }
      } catch (e) {
        if (!cancelled) console.error("Error fetching stage data for category variant:", e);
      }
    };
    fetchStagesForVariant();
    return () => { cancelled = true; };
  }, [searchingMode, pipelineStatus, selectedCategoryVariant, categoryExecutions, amazonFilters, alibabaFilters]);

  // Polling Effect for Pipeline
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout;
    let childStatusCounter = 0;

    if (pipelineStatus === 'POLLING' && executionArn) {
      let categoryFirstArnWhenFinished: string | null = null;

      pollingInterval = setInterval(async () => {
        try {
          // 1. Check Status of Main (or Virtual) Execution
          const statusRes = await fetch(`/api/pipeline/status?arn=${executionArn}`);
          const statusData = await statusRes.json();

          let currentStatus = statusData.status;

          // 2. Special handling for Category Based search: track individual keyword executions
          if (searchingMode === 'CATEGORY BASED' && categoryExecutions.length > 0) {
            childStatusCounter++;

            // Poll children every ~10s (every 3rd main poll roughly)
            if (childStatusCounter >= 3) {
              childStatusCounter = 0;
              const updatedExecutions = await Promise.all(categoryExecutions.map(async (exec) => {
                if (exec.status === 'SUCCEEDED' || exec.status === 'FAILED' || exec.status === 'ABORTED' || exec.status === 'TIMED_OUT') return exec;
                try {
                  const res = await fetch(`/api/pipeline/status?arn=${exec.execution_arn}`);
                  const data = await res.json();
                  return { ...exec, status: data.status };
                } catch (e) {
                  console.error(`Error fetching status for child ${exec.keyword}:`, e);
                  return exec;
                }
              }));

              setCategoryExecutions(updatedExecutions);

              // Check if all children are finished
              const allFinished = updatedExecutions.every(e =>
                e.status === 'SUCCEEDED' || e.status === 'FAILED' || e.status === 'ABORTED' || e.status === 'TIMED_OUT'
              );

              if (allFinished) {
                currentStatus = 'SUCCEEDED';
                const firstExec = updatedExecutions[0];
                categoryFirstArnWhenFinished = firstExec?.execution_arn ?? null;
                const firstKeyword = firstExec?.keyword;
                if (firstKeyword) setSelectedCategoryVariant(firstKeyword);
                console.log("All category keyword executions finished.");
              }
            }
          }

          const fetchMarketplaceStages = async (arnOverride?: string | null) => {
            // In category mode use explicit ARN when provided (e.g. first execution when we just finished), else effectiveStageArn
            const arnToUse = arnOverride !== undefined ? arnOverride : effectiveStageArn;
            if (!arnToUse) return;

            // Fetch Keyword Planner stage results once available
            if (!hasLoadedKeywordPlanner) {
              try {
                const kwpRes = await fetch(`/api/pipeline/keyword-planner?arn=${encodeURIComponent(arnToUse)}`);
                if (kwpRes.ok) {
                  const kwpData = await kwpRes.json();
                  if (kwpData.success && kwpData.available && kwpData.results && kwpData.results.length > 0) {
                    setKeywordPlannerResults(kwpData.results);
                    setKeywordPlannerMeta(kwpData.meta || null);
                    setHasLoadedKeywordPlanner(true);
                  }
                }
              } catch (e) {
                console.log("Error fetching Keyword Planner stage results", e);
              }
            }

            // Fetch Google Trends stage results once available
            if (!hasLoadedTrends) {
              try {
                const trendsRes = await fetch(`/api/pipeline/google-trends?arn=${encodeURIComponent(arnToUse)}`);
                if (trendsRes.ok) {
                  const trendsData = await trendsRes.json();
                  if (trendsData.success && trendsData.available && trendsData.results && trendsData.results.length > 0) {
                    setTrendsResults(trendsData.results);
                    setTrendsMeta(trendsData.meta || null);
                    setHasLoadedTrends(true);
                  }
                }
              } catch (e) {
                console.log("Error fetching Google Trends stage results", e);
              }
            }

            // Fetch Amazon marketplace stage results if enabled
            if (amazonFilters && !hasLoadedAmazon) {
              try {
                const amzRes = await fetch(`/api/pipeline/amazon?arn=${encodeURIComponent(arnToUse)}`);
                if (amzRes.ok) {
                  const amzData = await amzRes.json();
                  console.log("Amazon marketplace stage response:", amzData);
                  if (amzData.success && amzData.available && amzData.results && amzData.results.length > 0) {
                    setAmazonResults(amzData.results);
                    setAmazonMeta(amzData.meta || null);
                    setHasLoadedAmazon(true);
                  }
                }
              } catch (e) {
                console.log("Error fetching Amazon marketplace stage results", e);
              }
            }

            // Fetch Alibaba marketplace stage results if enabled
            if (alibabaFilters && !hasLoadedAlibaba) {
              try {
                const aliRes = await fetch(`/api/pipeline/alibaba?arn=${encodeURIComponent(arnToUse)}`);
                if (aliRes.ok) {
                  const aliData = await aliRes.json();
                  console.log("Alibaba marketplace stage response:", aliData);
                  if (aliData.success && aliData.available && aliData.results && aliData.results.length > 0) {
                    setAlibabaResults(aliData.results);
                    setAlibabaMeta(aliData.meta || null);
                    setHasLoadedAlibaba(true);
                  }
                }
              } catch (e) {
                console.log("Error fetching Alibaba marketplace stage results", e);
              }
            }
          };

          if (currentStatus === 'SUCCEEDED') {
            // On success, ensure we fetch the latest stage data once more. In category mode use first execution ARN so we load the correct variant (effectiveStageArn not yet updated).
            const arnForFetch = searchingMode === 'CATEGORY BASED' ? (categoryFirstArnWhenFinished ?? undefined) : undefined;
            await fetchMarketplaceStages(arnForFetch);

            setStatusMessage(searchingMode === 'CATEGORY BASED' ? 'Pipeline completed! View stage data below.' : 'Pipeline completed successfully! Fetching final results...');
            clearInterval(pollingInterval);
            setPollingIntervalRef(null);
            setPipelineStatus('COMPLETED');
            setIsPreliminary(false);

            // Category mode: do not fetch/show ranked data; show only Keyword Planner, Google Trends, Amazon, Alibaba stage data (same as manual mode)
            if (searchingMode !== 'CATEGORY BASED') {
              const finalParams = getApiParams();
              const finalProducts = await fetchProducts(finalParams);
              setProducts(finalProducts);
            }
            setIsLoading(false);
          } else if (currentStatus === 'ABORTED') {
            setStatusMessage('ABORTED');
            setPipelineStatus('FAILED');
            setIsLoading(false);
            clearInterval(pollingInterval);
            setPollingIntervalRef(null);
          } else if (currentStatus === 'FAILED' || currentStatus === 'TIMED_OUT') {
            setStatusMessage(`Pipeline failed: ${currentStatus}`);
            setError(`Pipeline execution failed: ${currentStatus}`);
            setPipelineStatus('FAILED');
            setIsLoading(false);
            clearInterval(pollingInterval);
            setPollingIntervalRef(null);
          } else {
            // Still running
            setStatusMessage(currentStatus);

            // While running, keep refreshing intermediate stage data
            await fetchMarketplaceStages();

            // Preliminary consolidated data fetching disabled for now while debugging marketplace stages
            // try {
            //   const queryParams = new URLSearchParams();
            //   const mode = searchModeMap[searchingMode] || 'manual_search';
            //   queryParams.append('search_mode', mode);
            //
            //   if (mode === 'category_search') {
            //     queryParams.append('category', productCategory);
            //   } else if (keywordSearch) {
            //     queryParams.append('keyword', keywordSearch);
            //   }
            //
            //   const prelimRes = await fetch(`/api/pipeline/preliminary?${queryParams.toString()}`);
            //   const prelimData = await prelimRes.json();
            //   if (prelimData.results && prelimData.results.length > 0) {
            //     setProducts(prelimData.results);
            //     setIsPreliminary(true);
            //   }
            // } catch (e) {
            //   console.log("Error fetching preliminary data", e);
            // }
          }

        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);

      setPollingIntervalRef(pollingInterval);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingIntervalRef(null);
      }
    }
  }, [pipelineStatus, executionArn, effectiveStageArn, keywordSearch, searchingMode, productCategory, categoryExecutions, getApiParams, hasLoadedKeywordPlanner, hasLoadedTrends, amazonFilters, hasLoadedAmazon, alibabaFilters, hasLoadedAlibaba]);


  // Prevent hydration mismatch by only rendering on client
  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#32402F] text-white p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-medium tracking-wider mb-4">TREND RADAR</h1>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#32402F] text-white p-4 md:p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-medium tracking-wider">TREND RADAR</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Top Row: Searching Filters, Location, Active Search */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left: Searching Filters */}
          <div>
            <div className="border border-white p-2">
              <input
                type="text"
                value={searchingFilters}
                onChange={(e) => setSearchingFilters(e.target.value)}
                placeholder="SEARCHING FILTERS:"
                className="w-full h-10 text-white text-lg bg-transparent border-none outline-none placeholder-gray-300 font-medium tracking-wide"
              />
            </div>
          </div>

          {/* Center: Location */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium flex items-center">
                LOCATION: <span className="text-red-400">*</span>
              </label>
              <select
                value={location}
                disabled={fieldsDisabled}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (locationError) {
                    setLocationError('');
                  }
                }}
                className={`px-3 py-2 text-white bg-[#32402F] border focus:outline-none focus:border-blue-500 ${locationError ? 'border-red-500' : 'border-white'
                  } ${fieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">Select a country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            {locationError && (
              <p className="text-red-400 text-xs">{locationError}</p>
            )}
          </div>

          {/* Right: Active Search */}
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm font-medium tracking-wide">ACTIVE SEARCH</span>
            <button
              onClick={() => handleActiveSearchToggle(!activeSearch)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none shadow-inner ${activeSearch ? 'bg-[#C0FE72]' : 'bg-gray-600'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${activeSearch ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Combined Row: Searching Mode + Search Fields (Left) and Blacklisted Words (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left: Searching Mode + Search Fields in 2x2 grid */}
          <div className="lg:col-span-2 space-y-4">
            {/* Searching Mode - All in one line */}
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium">SEARCHING MODE:</span>
              {['MANUAL', 'CATEGORY BASED', 'ATAI AUTO'].map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <span className="text-sm">{mode}</span>
                  <input
                    type="radio"
                    name="searchingMode"
                    value={mode}
                    checked={searchingMode === mode}
                    onChange={(e) => setSearchingMode(e.target.value)}
                    className="w-4 h-4 text-[#F3940B] bg-gray-700 border-gray-600 focus:ring-[#F3940B]"
                    style={{
                      accentColor: '#F3940B'
                    }}
                  />
                </label>
              ))}
            </div>

            {/* Search Fields in 2x2 grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchingMode === 'MANUAL' ? (
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center">
                    KEYWORD SEARCH <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={keywordSearch}
                    disabled={fieldsDisabled}
                    onChange={(e) => {
                      setKeywordSearch(e.target.value);
                      if (keywordSearchError) {
                        setKeywordSearchError('');
                      }
                    }}
                    className={`w-full px-3 py-2 text-black bg-[#FFFFFF] border focus:outline-none focus:border-blue-500 ${keywordSearchError ? 'border-red-500' : 'border-gray-600'
                      } ${fieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {keywordSearchError && (
                    <p className="text-red-400 text-xs mt-1">{keywordSearchError}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">PRODUCT CATEGORY <span className="text-red-400">*</span></label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full px-3 py-2 text-black bg-white border border-gray-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="All categories">All categories</option>
                    <option value="Arts & Entertainment">Arts & Entertainment</option>
                    <option value="Autos & Vehicles">Autos & Vehicles</option>
                    <option value="Beauty & Fitness">Beauty & Fitness</option>
                    <option value="Books & Literature">Books & Literature</option>
                    <option value="Business & Industrial">Business & Industrial</option>
                    <option value="Computers & Electronics">Computers & Electronics</option>
                    <option value="Finance">Finance</option>
                    <option value="Food & Drink">Food & Drink</option>
                    <option value="Games">Games</option>
                    <option value="Health">Health</option>
                    <option value="Hobbies & Leisure">Hobbies & Leisure</option>
                    <option value="Home & Garden">Home & Garden</option>
                    <option value="Internet & Telecom">Internet & Telecom</option>
                    <option value="Jobs & Education">Jobs & Education</option>
                    <option value="Law & Government">Law & Government</option>
                    <option value="News">News</option>
                    <option value="People & Society">People & Society</option>
                    <option value="Pets & Animals">Pets & Animals</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Science">Science</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Sports">Sports</option>
                    <option value="Travel">Travel</option>
                  </select>
                </div>
              )}
              {/* Trend Period - only show when Active Search is ON */}
              {activeSearch && (
                <div className="flex flex-col items-start gap-2 relative">
                  <div className="flex items-center gap-4 flex-col">
                    <span className="text-sm font-medium flex items-center">
                      TREND PERIOD <span className="text-red-400">*</span>
                      {pipelineFieldsDisabled && <InfoButton message="Please reset in order to apply filters for new search" />}
                    </span>
                    <div className="relative trend-dropdown">
                      <button
                        onClick={() => !pipelineFieldsDisabled && setShowTrendDropdown(!showTrendDropdown)}
                        disabled={pipelineFieldsDisabled}
                        className={`px-3 py-2 text-black bg-white border focus:outline-none focus:border-blue-500 min-w-[150px] flex items-center justify-between ${trendPeriodError ? 'border-red-500' : 'border-gray-300'
                          } ${pipelineFieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span>{trendPeriod || 'Select period'}</span>
                        <span className="ml-2">▼</span>
                      </button>
                      {showTrendDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 shadow-lg z-50 max-h-48 overflow-y-auto">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((period) => (
                            <button
                              key={period}
                              onClick={() => {
                                setTrendPeriod(period.toString());
                                setShowTrendDropdown(false);
                                if (trendPeriodError) {
                                  setTrendPeriodError('');
                                }
                              }}
                              className="w-full px-3 py-2 text-left text-black hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                            >
                              {period}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {trendPeriodError && (
                    <p className="text-red-400 text-xs ml-28">{trendPeriodError}</p>
                  )}
                </div>
              )}

              {/* VARIANT LIMIT MAX and RESULTS CAP MAX - only show when Active Search is ON */}
              {activeSearch && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center">
                      VARIANT LIMIT MAX <span className="text-red-400">*</span>
                      {pipelineFieldsDisabled && <InfoButton message="Please reset in order to apply filters for new search" />}
                    </label>
                    <input
                      type="text"
                      value={variantLimitMax}
                      disabled={pipelineFieldsDisabled}
                      onChange={(e) => {
                        setVariantLimitMax(e.target.value);
                        if (variantLimitMaxError) {
                          setVariantLimitMaxError('');
                        }
                      }}
                      className={`w-full px-3 py-2 text-black bg-[#FFFFFF] border focus:outline-none focus:border-blue-500 ${variantLimitMaxError ? 'border-red-500' : 'border-gray-600'
                        } ${pipelineFieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {variantLimitMaxError && (
                      <p className="text-red-400 text-xs mt-1">{variantLimitMaxError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center">
                      RESULTS CAP MAX <span className="text-red-400">*</span>
                      {pipelineFieldsDisabled && <InfoButton message="Please reset in order to apply filters for new search" />}
                    </label>
                    <input
                      type="text"
                      value={resultsCap}
                      disabled={pipelineFieldsDisabled}
                      onChange={(e) => {
                        setResultsCap(e.target.value);
                        if (resultsCapError) {
                          setResultsCapError('');
                        }
                      }}
                      className={`w-full px-3 py-2 text-black bg-[#FFFFFF] border focus:outline-none focus:border-blue-500 ${resultsCapError ? 'border-red-500' : 'border-gray-600'
                        } ${pipelineFieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {resultsCapError && (
                      <p className="text-red-400 text-xs mt-1">{resultsCapError}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Blacklisted Words */}
          <div>
            <label className="block text-sm font-medium mb-2">BLACKLISTED WORDS</label>
            <textarea
              value={blacklistedWords}
              onChange={(e) => setBlacklistedWords(e.target.value)}
              className="w-full h-32 px-3 py-2 text-black bg-[#FFFFFF] border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Fourth Row: Google Trend Score, Product Category, Trend Period */}
        <div className="flex flex-wrap items-center gap-8 lg:gap-12 mb-6">
          {/* Google Trend Score */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">GOOGLE TREND SCORE</span>
            <div className="h-5 flex items-center bg-white px-3 py-2 ">
              <svg width="20" height="12" viewBox="0 0 20 12" className="mr-2">
                {/* Google Trends icon */}
                <path d="M2 10 L6 6 L10 8 L18 2" stroke="#4285f4" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="10" r="2" fill="#34a853" />
                <circle cx="6" cy="6" r="2" fill="#fbbc04" />
                <circle cx="10" cy="8" r="2" fill="#ea4335" />
                <circle cx="18" cy="2" r="2" fill="#4285f4" />
              </svg>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-800">0</span>
                <div className="relative w-20">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={googleTrendScore}
                    onChange={(e) => setGoogleTrendScore(Number(e.target.value))}
                    className="w-full h-2 bg-gray-300 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${googleTrendScore}%, #d1d5db ${googleTrendScore}%, #d1d5db 100%)`,
                      WebkitAppearance: 'none',
                      outline: 'none'
                    }}
                  />
                  <style jsx>{`
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 14px;
                      height: 14px;
                      border-radius: 50%;
                      background: #2563eb;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    
                    input[type="range"]::-moz-range-thumb {
                      width: 14px;
                      height: 14px;
                      border-radius: 50%;
                      background: #2563eb;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                  `}</style>
                </div>
                <span className="text-xs font-medium text-gray-800 min-w-[2.5rem] text-right">
                  {googleTrendScore}
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">KWP MONTHLY SEARCHES</label>
            <input
              type="text"
              value={kwpMonthlySearches}
              onChange={(e) => setKwpMonthlySearches(e.target.value)}
              className="w-full px-3 py-2 text-black bg-[#FFFFFF] border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>


          {/* Trend Period */}

        </div>

        {/* Amazon Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-yellow-400 font-medium">AMAZON FILTERS</h3>
            <label className="flex items-center gap-2">
              <span className="text-sm">ON</span>
              <input
                type="radio"
                name="amazonFilters"
                value="on"
                checked={amazonFilters}
                onChange={(e) => setAmazonFilters(true)}
                className="w-4 h-4 text-[#F3940B] bg-gray-700 border-gray-600 "
                style={{
                  accentColor: '#F3940B'
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm">OFF</span>
              <input
                type="radio"
                name="amazonFilters"
                value="off"
                checked={!amazonFilters}
                onChange={(e) => setAmazonFilters(false)}
                className="w-4 h-4 text-[#F3940B] bg-gray-700 border-gray-600 "
                style={{
                  accentColor: '#F3940B'
                }}
              />
            </label>
          </div>

          <div className={`flex flex-wrap items-center gap-6 lg:gap-8 ${!amazonFilters ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${!amazonFilters ? 'text-gray-400' : ''}`}>PRICE FILTER</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${!amazonFilters ? 'text-gray-400' : ''}`}>MIN</span>
                <input
                  type="text"
                  value={priceMin}
                  onChange={(e) => setPriceMin(Number(e.target.value) || 0)}
                  disabled={!amazonFilters}
                  className={`w-12 h-6 px-2 py-1 text-center rounded border text-xs ${!amazonFilters
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black focus:outline-none focus:border-blue-500'
                    }`}
                />
                <span className={`text-sm ${!amazonFilters ? 'text-gray-400' : ''}`}>MAX</span>
                <input
                  type="text"
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value) || 0)}
                  disabled={!amazonFilters}
                  className={`w-12 h-6 px-2 py-1 text-center rounded border text-xs ${!amazonFilters
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black focus:outline-none focus:border-blue-500'
                    }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${!amazonFilters ? 'text-gray-400' : ''}`}>REVIEWS</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${!amazonFilters ? 'text-gray-400' : ''}`}>MIN</span>
                <input
                  type="text"
                  value={reviewsMin}
                  onChange={(e) => setReviewsMin(Number(e.target.value) || 0)}
                  disabled={!amazonFilters}
                  className={`w-12 h-6 px-2 py-1 text-center rounded border text-xs ${!amazonFilters
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black focus:outline-none focus:border-blue-500'
                    }`}
                />
                <span className={`text-sm ${!amazonFilters ? 'text-gray-400' : ''}`}>MAX</span>
                <input
                  type="text"
                  value={reviewsMax}
                  onChange={(e) => setReviewsMax(Number(e.target.value) || 0)}
                  disabled={!amazonFilters}
                  className={`w-12 h-6 px-2 py-1 text-center rounded border text-xs ${!amazonFilters
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black focus:outline-none focus:border-blue-500'
                    }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-sm ${!amazonFilters ? 'text-gray-400' : ''}`}>RATING FILTER ▼</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-lg ${!amazonFilters
                      ? 'cursor-not-allowed text-gray-400'
                      : `cursor-pointer ${star <= ratingFilter ? 'text-yellow-400' : 'text-gray-500'}`
                      }`}
                    onClick={amazonFilters ? () => setRatingFilter(star) : undefined}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-sm ${!amazonFilters ? 'text-gray-400' : ''}`}>FCL</span>
              <div className={`px-3 py-1 flex items-center gap-2 ${!amazonFilters ? 'bg-gray-300' : 'bg-white'}`}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fcl}
                  onChange={(e) => setFcl(Number(e.target.value))}
                  disabled={!amazonFilters}
                  className={`w-20 h-2 bg-gray-300 rounded-lg appearance-none ${!amazonFilters ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  style={amazonFilters ? {
                    background: `linear-gradient(to right, #1e40af 0%, #1e40af ${fcl * 100}%, #d1d5db ${fcl * 100}%, #d1d5db 100%)`,
                    WebkitAppearance: 'none',
                    outline: 'none'
                  } : {}}
                />
                <span className={`text-xs font-medium min-w-[2.5rem] ${!amazonFilters ? 'text-gray-500' : 'text-gray-800'
                  }`}>{fcl.toFixed(2)}</span>
                {amazonFilters && (
                  <style jsx>{`
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: #1e40af;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    
                    input[type="range"]::-moz-range-thumb {
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: #1e40af;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                  `}</style>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Alibaba Filters */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-yellow-400 font-medium">ALIBABA SUPPLIER FILTERS</h3>
            <label className="flex items-center gap-2">
              <span className="text-sm">ON</span>
              <input
                type="radio"
                name="alibabaFilters"
                value="on"
                checked={alibabaFilters}
                onChange={(e) => setAlibabaFilters(true)}
                className="w-4 h-4 text-[#F3940B] bg-gray-700 border-gray-600"
                style={{
                  accentColor: '#F3940B'
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm">OFF</span>
              <input
                type="radio"
                name="alibabaFilters"
                value="off"
                checked={!alibabaFilters}
                onChange={(e) => setAlibabaFilters(false)}
                className="w-4 h-4 text-[#F3940B] bg-gray-700 border-gray-600"
                style={{
                  accentColor: '#F3940B'
                }}
              />
            </label>
          </div>

          <div className={`flex flex-wrap items-center gap-6 lg:gap-8 ${!alibabaFilters ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-4">
              <span className={`text-sm ${!alibabaFilters ? 'text-gray-400' : ''}`}>COST BELOW %</span>
              <div className={`px-3 py-1 flex items-center gap-2 ${!alibabaFilters ? 'bg-gray-300' : 'bg-white'}`}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={costBelow}
                  onChange={(e) => setCostBelow(Number(e.target.value))}
                  disabled={!alibabaFilters}
                  className={`w-20 h-2 bg-gray-300 rounded-lg appearance-none ${!alibabaFilters ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  style={alibabaFilters ? {
                    background: `linear-gradient(to right, #1e40af 0%, #1e40af ${costBelow * 100}%, #d1d5db ${costBelow * 100}%, #d1d5db 100%)`,
                    WebkitAppearance: 'none',
                    outline: 'none'
                  } : {}}
                />
                <span className={`text-xs font-medium min-w-[2.5rem] ${!alibabaFilters ? 'text-gray-500' : 'text-gray-800'
                  }`}>{costBelow.toFixed(2)}</span>
                {alibabaFilters && (
                  <style jsx>{`
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: #1e40af;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    
                    input[type="range"]::-moz-range-thumb {
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: #1e40af;
                      cursor: pointer;
                      border: none;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                  `}</style>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-sm ${!alibabaFilters ? 'text-gray-400' : ''}`}>MOQ</span>
              <input
                type="text"
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                disabled={!alibabaFilters}
                className={`w-24 h-6 px-2 py-1 text-center border text-xs ${!alibabaFilters
                  ? 'text-gray-500 bg-gray-300 cursor-not-allowed'
                  : 'text-black bg-white focus:outline-none focus:border-blue-500'
                  }`}
              />
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-sm ${!alibabaFilters ? 'text-gray-400' : ''}`}>RATING FILTER ▼</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-lg ${!alibabaFilters
                      ? 'cursor-not-allowed text-gray-400'
                      : `cursor-pointer ${star <= alibabaRating ? 'text-yellow-400' : 'text-gray-500'}`
                      }`}
                    onClick={alibabaFilters ? () => setAlibabaRating(star) : undefined}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1 ${!alibabaFilters ? 'bg-gray-300' : 'bg-white'}`}>
              <span className={`text-sm font-medium ${!alibabaFilters ? 'text-gray-500' : 'text-gray-800'}`}>Verified Supplier:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={alibabaFilters ? () => setVerifiedSupplier(!verifiedSupplier) : undefined}
                  disabled={!alibabaFilters}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${!alibabaFilters
                    ? 'bg-gray-400 cursor-not-allowed'
                    : `${verifiedSupplier ? 'bg-green-500' : 'bg-gray-300'}`
                    }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${!alibabaFilters
                      ? 'translate-x-1'
                      : verifiedSupplier ? 'translate-x-5' : 'translate-x-1'
                      }`}
                  />
                </button>
                <span className={`text-xs font-bold ${!alibabaFilters ? 'text-gray-500' : 'text-gray-800'}`}>
                  {!alibabaFilters ? 'OFF' : (verifiedSupplier ? 'ON' : 'OFF')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <select
            value={savePreset}
            onChange={(e) => setSavePreset(e.target.value)}
            className="px-4 py-2 text-white bg-[#32402F] border border-white focus:outline-none focus:border-blue-500"
          >
            <option value="SAVE PRESET 1">SAVE PRESET 1</option>
            <option value="SAVE PRESET 2">SAVE PRESET 2</option>
            <option value="SAVE PRESET 3">SAVE PRESET 3</option>
          </select>

          <button
            onClick={handleReset}
            className="px-6 py-2 bg-[#32402F] text-white  hover:bg-gray-500 transition-colors border border-[#ffffff]"
          >
            RESET
          </button>

          <button
            onClick={handleExportCsv}
            disabled={pipelineStatus !== 'COMPLETED'}
            className={`px-8 py-2 rounded font-bold transition-colors ${
              pipelineStatus === 'COMPLETED'
                ? 'bg-blue-500 text-black hover:bg-blue-400'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
          >
            EXPORT CSV
          </button>

          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-8 py-2 bg-yellow-500 text-white font-bold rounded hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'SEARCHING...' : 'SEARCH'}
          </button>

          <button
            onClick={handleStopSearch}
            disabled={!executionArn || pipelineStatus !== 'POLLING'}
            className="px-6 py-2 bg-red-600 text-black font-bold rounded hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            STOP CURRENT SEARCH
          </button>
        </div>

        {/* Products Results Table */}
        {(products.length > 0 || error || isLoading || pipelineStatus !== 'IDLE' || hasPerformedSearch) && (
          <div className="mt-8">
            {/* Stage-level details (audit-only views) - always visible while pipeline is active */}
            {activeSearch && pipelineStatus !== 'IDLE' && (
              <div className="mb-10">
                    {/* Category: keywords from Google Trends - show first */}
                    {searchingMode === 'CATEGORY BASED' && categoryKeywordsPreview !== null && categoryKeywordsPreview.length > 0 && (
                      <div className="mb-8 p-6 bg-[#2a3627] rounded shadow-xl border border-[#C0FE72]/30">
                        <h3 className="text-2xl font-bold text-[#C0FE72] tracking-wider mb-2">KEYWORDS FROM GOOGLE TRENDS</h3>
                        <p className="text-sm text-gray-400 mb-4">Keywords generated for this category; one Step Function execution runs per keyword.</p>
                        <div className="flex flex-wrap gap-2">
                          {categoryKeywordsPreview.map((kw, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-[#32402F] text-gray-100 rounded border border-white/20 text-sm"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-4">Total: {categoryKeywordsPreview.length} keyword(s)</p>
                      </div>
                    )}

                    {/* Category Pipeline Tracker - show second (above stage results) */}
                    {searchingMode === 'CATEGORY BASED' && categoryExecutions.length > 0 && (
                      <div className="mb-8 p-6 bg-[#2a3627] rounded shadow-xl border border-white/10">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-[#C0FE72] tracking-wider">CATEGORY PIPELINE TRACKER</h3>
                            <div className="text-xs text-gray-400">Each variant keyword runs its own pipeline.</div>
                          </div>
                          <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <span className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Variant View</span>
                            <select
                              value={selectedCategoryVariant}
                              onChange={(e) => handleCategoryVariantChange(e.target.value)}
                              className="px-3 py-1 text-xs bg-[#32402F] text-white border border-white/40 rounded focus:outline-none focus:border-[#C0FE72]"
                            >
                              <option value="ALL">Select a variant</option>
                              {categoryExecutions.map((exec) => (
                                <option key={exec.keyword} value={exec.keyword}>
                                  {exec.keyword}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/30 text-gray-300">
                                <th className="pb-3 pr-4 font-semibold uppercase tracking-wider">Target Keyword</th>
                                <th className="pb-3 px-4 font-semibold uppercase tracking-wider">Execution Status</th>
                                <th className="pb-3 pl-4 font-semibold uppercase tracking-wider">Run ID / ARN</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryExecutions.map((exec, idx) => (
                                <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                  <td className="py-4 pr-4 font-medium text-white">{exec.keyword}</td>
                                  <td className="py-4 px-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-tight shadow-sm ${exec.status === 'SUCCEEDED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                      exec.status === 'FAILED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        exec.status === 'RUNNING' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse' :
                                          'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                      }`}>
                                      <span className={`w-2 h-2 rounded-full mr-2 ${exec.status === 'SUCCEEDED' ? 'bg-green-400' :
                                        exec.status === 'FAILED' ? 'bg-red-400' :
                                          exec.status === 'RUNNING' ? 'bg-blue-400' :
                                            'bg-gray-400'
                                        }`}></span>
                                      {exec.status || 'INITIALIZING'}
                                    </span>
                                  </td>
                                  <td className="py-4 pl-4 font-mono text-[10px] text-gray-500 break-all max-w-xs">{exec.run_id || exec.execution_arn}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Stage results - below Category Pipeline Tracker; per selected variant only (no merge) */}
                    {searchingMode === 'CATEGORY BASED' && categoryExecutions.length > 0 && selectedCategoryVariant !== 'ALL' && (
                      <div className="mb-6 p-3 bg-[#32402F] rounded border border-[#C0FE72]/20">
                        <p className="text-sm text-gray-300">
                          Showing data for variant: <strong className="text-[#C0FE72]">{selectedCategoryVariant}</strong>
                        </p>
                      </div>
                    )}
                    {/* Category mode: selected variant produced no surviving stage data (all variants filtered out) */}
                    {searchingMode === 'CATEGORY BASED' &&
                      categoryExecutions.length > 0 &&
                      selectedCategoryVariant !== 'ALL' &&
                      pipelineStatus === 'COMPLETED' &&
                      !keywordPlannerResults?.length &&
                      !trendsResults?.length && (
                        <div className="mb-6 p-4 bg-[#2a3627] rounded border border-red-400/40 text-center">
                          <p className="text-sm text-gray-100 font-semibold">
                            All candidate variants for this keyword were removed by the pipeline filters, so no stage files were written.
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
                            Try relaxing your filters (search volume, Google Trends score, marketplace filters) or choose another variant from the{' '}
                            <strong className="text-[#C0FE72]">Variant View</strong> dropdown above.
                          </p>
                        </div>
                      )}
                    {/* Category mode: prompt to select a keyword to view stage data */}
                    {searchingMode === 'CATEGORY BASED' && selectedCategoryVariant === 'ALL' && categoryExecutions.length > 0 && !keywordPlannerResults?.length && !trendsResults?.length && (
                      <div className="mb-6 p-4 bg-[#2a3627] rounded border border-white/20 text-center">
                        <p className="text-gray-300 text-sm">
                          Select a keyword from the <strong className="text-[#C0FE72]">Variant View</strong> dropdown above to view <strong>Keyword Planner</strong>, <strong>Google Trends</strong>, <strong>Amazon</strong>, and <strong>Alibaba</strong> stage data for that keyword only.
                        </p>
                      </div>
                    )}
                    {/* Keyword Planner Stage Summary */}
                    {(() => {
                      const displayRows = filterStageRowsByVariant(keywordPlannerResults, ['root_keyword', 'sub_keyword', 'keyword'], 'root_keyword');
                      const hasRawKwp = keywordPlannerResults && keywordPlannerResults.length > 0;
                      const noMatchKwp = searchingMode === 'CATEGORY BASED' && selectedCategoryVariant !== 'ALL' && hasRawKwp && (!displayRows || displayRows.length === 0);
                      if (noMatchKwp) {
                        return (
                          <div className="mb-8 p-4 bg-[#2a3627] rounded border border-amber-500/40">
                            <h3 className="text-xl font-bold text-[#C0FE72] tracking-wider mb-2">KEYWORD PLANNER STAGE</h3>
                            <p className="text-sm text-gray-300">No rows match the selected variant <strong className="text-amber-400">&quot;{selectedCategoryVariant}&quot;</strong>. The pipeline may have returned data for a related term (e.g. another variant in the list). Select that variant from the dropdown to see its rows.</p>
                          </div>
                        );
                      }
                      if (!displayRows || displayRows.length === 0) return null;
                      return (
                      <div className="mb-8 p-6 bg-[#2a3627] rounded shadow-xl border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-2xl font-bold text-[#C0FE72] tracking-wider">KEYWORD PLANNER STAGE</h3>
                          <div className="text-sm text-gray-300">
                            {keywordPlannerMeta?.message || 'Keyword Planner Parquet created'} · Rows: {keywordPlannerMeta?.rows ?? displayRows.length}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/30 text-gray-300">
                                {Object.keys(displayRows[0]).map((col) => (
                                  <th key={col} className="pb-3 pr-4 font-semibold uppercase tracking-wider whitespace-nowrap">
                                    {col.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {displayRows.map((row, idx) => (
                                <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                  {Object.keys(displayRows[0]).map((col) => (
                                    <td key={col} className="py-2 pr-4 text-gray-100 whitespace-nowrap">
                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                        ? String((row as any)[col])
                                        : '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      );
                    })()}

                    {/* Google Trends Stage Summary */}
                    {(() => {
                      const displayRows = filterStageRowsByVariant(trendsResults, ['keyword'], 'keyword');
                      const hasRawTrends = trendsResults && trendsResults.length > 0;
                      const noMatchTrends = searchingMode === 'CATEGORY BASED' && selectedCategoryVariant !== 'ALL' && hasRawTrends && (!displayRows || displayRows.length === 0);
                      if (noMatchTrends) {
                        return (
                          <div className="mb-8 p-4 bg-[#2a3627] rounded border border-amber-500/40">
                            <h3 className="text-xl font-bold text-[#C0FE72] tracking-wider mb-2">GOOGLE TRENDS STAGE</h3>
                            <p className="text-sm text-gray-300">No rows match the selected variant <strong className="text-amber-400">&quot;{selectedCategoryVariant}&quot;</strong>. Select another variant from the dropdown to see its data.</p>
                          </div>
                        );
                      }
                      if (!displayRows || displayRows.length === 0) return null;
                      return (
                      <div className="mb-8 p-6 bg-[#2a3627] rounded shadow-xl border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-2xl font-bold text-[#C0FE72] tracking-wider">GOOGLE TRENDS STAGE</h3>
                          <div className="text-sm text-gray-300">
                            {trendsMeta?.message || 'Google Trends Parquet created successfully'} · Rows: {trendsMeta?.rows ?? displayRows.length}
                          </div>
                        </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/30 text-gray-300">
                            {Object.keys(displayRows[0]).map((col) => (
                              <th key={col} className="pb-3 pr-4 font-semibold uppercase tracking-wider whitespace-nowrap">
                                {col === 'score_value' ? 'FCL' : col.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                              {Object.keys(displayRows[0]).map((col) => (
                                <td key={col} className="py-2 pr-4 text-gray-100 whitespace-nowrap">
                                  {(() => {
                                    const value = (row as any)[col];
                                    if (value === undefined || value === null) return '-';
                                    if (col === 'score_value') {
                                      const num = Number(value);
                                      return Number.isFinite(num) ? `${num.toFixed(2)}` : String(value);
                                    }
                                    return String(value);
                                  })()}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      </div>
                      );
                    })()}

                    {/* Amazon Marketplace Stage */}
                    {(() => {
                      const displayRows = filterStageRowsByVariant(amazonResults, ['keyword', 'search_category'], 'keyword');
                      const hasRawAmz = amazonResults && amazonResults.length > 0;
                      const noMatchAmz = searchingMode === 'CATEGORY BASED' && selectedCategoryVariant !== 'ALL' && hasRawAmz && (!displayRows || displayRows.length === 0);
                      if (noMatchAmz) {
                        return (
                          <div className="mb-8 p-4 bg-[#2a3627] rounded border border-amber-500/40">
                            <h3 className="text-xl font-bold text-[#C0FE72] tracking-wider mb-2">AMAZON MARKETPLACE STAGE</h3>
                            <p className="text-sm text-gray-300">No rows match the selected variant <strong className="text-amber-400">&quot;{selectedCategoryVariant}&quot;</strong>. Select another variant from the dropdown to see its data.</p>
                          </div>
                        );
                      }
                      if (!displayRows || displayRows.length === 0) return null;
                      return (
                      <div className="mb-8 p-6 bg-[#2a3627] rounded shadow-xl border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-2xl font-bold text-[#C0FE72] tracking-wider">AMAZON MARKETPLACE STAGE</h3>
                          <div className="text-sm text-gray-300">
                            {amazonMeta?.message || 'Amazon raw cleaned + converted to parquet'} · Rows: {amazonMeta?.rows ?? displayRows.length}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/30 text-gray-300">
                                {Object.keys(displayRows[0]).map((col) => (
                                  <th key={col} className="pb-3 pr-4 font-semibold uppercase tracking-wider whitespace-nowrap">
                                    {col.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {displayRows.map((row, idx) => (
                                <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                  {Object.keys(displayRows[0]).map((col) => (
                                    <td key={col} className="py-2 pr-4 text-gray-100 whitespace-nowrap">
                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                        ? String((row as any)[col])
                                        : '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      );
                    })()}

                    {/* Alibaba Marketplace Stage */}
                    {(() => {
                      const displayRows = filterStageRowsByVariant(alibabaResults, ['keyword', 'search_category'], 'keyword');
                      const hasRawAli = alibabaResults && alibabaResults.length > 0;
                      const noMatchAli = searchingMode === 'CATEGORY BASED' && selectedCategoryVariant !== 'ALL' && hasRawAli && (!displayRows || displayRows.length === 0);
                      if (noMatchAli) {
                        return (
                          <div className="mb-8 p-4 bg-[#2a3627] rounded border border-amber-500/40">
                            <h3 className="text-xl font-bold text-[#C0FE72] tracking-wider mb-2">ALIBABA MARKETPLACE STAGE</h3>
                            <p className="text-sm text-gray-300">No rows match the selected variant <strong className="text-amber-400">&quot;{selectedCategoryVariant}&quot;</strong>. Select another variant from the dropdown to see its data.</p>
                          </div>
                        );
                      }
                      if (!displayRows || displayRows.length === 0) return null;
                      return (
                      <div className="mb-8 p-6 bg-[#2a3627] rounded shadow-xl border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-2xl font-bold text-[#C0FE72] tracking-wider">ALIBABA MARKETPLACE STAGE</h3>
                          <div className="text-sm text-gray-300">
                            {alibabaMeta?.message || 'Alibaba raw cleaned + converted'} · Rows: {alibabaMeta?.rows ?? displayRows.length}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/30 text-gray-300">
                                {Object.keys(displayRows[0]).map((col) => (
                                  <th key={col} className="pb-3 pr-4 font-semibold uppercase tracking-wider whitespace-nowrap">
                                    {col.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {displayRows.map((row, idx) => (
                                <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                  {Object.keys(displayRows[0]).map((col) => (
                                    <td key={col} className="py-2 pr-4 text-gray-100 whitespace-nowrap">
                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                        ? String((row as any)[col])
                                        : '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      );
                    })()}
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <p className="text-red-600 text-3xl font-bold mb-4">Error</p>
                  <p className="text-red-500 text-lg">{error}</p>
                </div>
              </div>
            )}

            {(isLoading || (pipelineStatus !== 'IDLE' && pipelineStatus !== 'COMPLETED')) && (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="text-center">
                  {pipelineStatus === 'STARTING' && (
                    <>
                      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
                      <p className="text-blue-600 text-4xl font-bold mb-4">Starting Pipeline</p>
                      <p className="text-gray-600 text-xl">Initializing your search...</p>
                    </>
                  )}
                  {pipelineStatus === 'POLLING' && (
                    <>
                      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-600 mx-auto mb-6"></div>
                      <p className="text-white-600 text-4xl font-bold">{statusMessage || 'RUNNING'}</p>
                    </>
                  )}
                  {pipelineStatus === 'FAILED' && (
                    <>
                      <p className="text-red-600 text-4xl font-bold">{statusMessage}</p>
                    </>
                  )}
                  {isLoading && pipelineStatus === 'IDLE' && (
                    <>
                      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
                      <p className="text-blue-600 text-4xl font-bold mb-4">Searching</p>
                      <p className="text-gray-600 text-xl">Loading products...</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {searchingMode !== 'CATEGORY BASED' && products.length > 0 && pipelineStatus === 'COMPLETED' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-xl font-bold text-white">
                    Total Products: <span className="text-[#C0FE72]">{products.length}</span>
                  </div>
                  <div className="text-center">
                    <p className={`${isPreliminary ? 'text-yellow-500' : 'text-green-600'} text-4xl font-bold mb-2`}>
                      {isPreliminary ? 'PRELIMINARY / PROCESSING' : 'SUCCEEDED'}
                    </p>
                  </div>
                  <div className="w-48"></div> {/* Spacer for symmetry */}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 border border-white bg-[#32402F] text-sm">
                    <thead>
                      <tr className="bg-yellow-500 text-black">
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky left-0 z-10 bg-yellow-500"
                          style={{ minWidth: '120px', borderRight: '2px solid white' }}
                        >
                          Global ID
                        </th>
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky z-10 bg-yellow-500"
                          style={{ left: '120px', minWidth: '150px', borderRight: '2px solid white' }}
                        >
                          Keyword
                        </th>
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky z-10 bg-yellow-500"
                          style={{ left: '270px', minWidth: '200px', borderRight: '2px solid white', boxShadow: '2px 0 0 0 white' }}
                        >
                          Title
                        </th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Base Price (USD)</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Category</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Search Category</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">FCL Price (USD)</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Keyword Interest Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Avg Monthly Searches</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Margin %</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Trend Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Supplier Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Price Comp Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Final Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Rank</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Specs</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Specs</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Specs</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Specs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, index) => {
                        const rowId = String(product.global_id || product.product_id || `${product.keyword || 'kw'}-${index}`);
                        const isExpanded = expandedProductId === rowId;
                        const kw = (product.keyword || '').toString().toLowerCase();

                        const filterByKeyword = (rows: any[] | null | undefined, fields: string[]): any[] => {
                          if (!rows || !kw) return [];
                          return rows.filter((row) => {
                            const text = fields
                              .map((f) => ((row as any)[f] ?? '').toString().toLowerCase())
                              .join(' ');
                            return text.includes(kw);
                          });
                        };

                        const kwpRows = filterByKeyword(keywordPlannerResults, ['keyword', 'sub_keyword', 'root_keyword']);
                        const trendsRows = filterByKeyword(trendsResults, ['keyword']);
                        const amzRows = filterByKeyword(amazonResults, ['keyword', 'search_category']);
                        const aliRows = filterByKeyword(alibabaResults, ['keyword', 'search_category']);

                        return (
                          <React.Fragment key={rowId}>
                            <tr
                              className="group hover:bg-[#3d4d3a] transition-colors"
                            >
                          <td
                            className="border border-white px-3 py-2 sticky left-0 z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ minWidth: '120px', borderRight: '2px solid white' }}
                          >
                            {product.global_id || '-'}
                          </td>
                          <td
                            className="border border-white px-3 py-2 sticky z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ left: '120px', minWidth: '150px', borderRight: '2px solid white' }}
                          >
                            {product.keyword ? toTitleCase(product.keyword) : '-'}
                          </td>
                          <td
                            className="border border-white px-3 py-2 sticky z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ left: '270px', minWidth: '200px', borderRight: '2px solid white', boxShadow: '2px 0 0 0 white' }}
                          >
                            {product.title || '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.base_price_usd !== undefined && product.base_price_usd !== null) ? `$${Number(product.base_price_usd).toFixed(2)}` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.category_leaf || product.category) ? toTitleCase(product.category_leaf || product.category || '') : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.search_category) ? toTitleCase(product.search_category || '') : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.fcl_price_usd !== undefined && product.fcl_price_usd !== null) ? `$${Number(product.fcl_price_usd).toFixed(2)}` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.keyword_interest_score !== undefined && product.keyword_interest_score !== null) ? product.keyword_interest_score : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.avg_monthly_searches !== undefined && product.avg_monthly_searches !== null) ? Number(product.avg_monthly_searches).toLocaleString() : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.margin_pct !== undefined && product.margin_pct !== null) ? `${Number(product.margin_pct).toFixed(2)}%` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.trend_score !== undefined && product.trend_score !== null) ? Math.round(Number(product.trend_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.supplier_score !== undefined && product.supplier_score !== null) ? Math.round(Number(product.supplier_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.price_comp_score !== undefined && product.price_comp_score !== null) ? Math.round(Number(product.price_comp_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.final_score !== undefined && product.final_score !== null) ? Math.round(Number(product.final_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.rank !== undefined && product.rank !== null) ? product.rank : '-'}
                          </td>
                              <td className="border border-white px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedProductId((current) => (current === rowId ? null : rowId));
                                  }}
                                  className="px-3 py-1 text-xs font-semibold rounded bg-white text-black hover:bg-gray-200 transition-colors"
                                >
                                  {isExpanded ? 'Hide specs' : 'Specs'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-[#25301f]">
                                <td colSpan={16} className="border-t border-white/20 px-3 py-3">
                                  <div className="space-y-4">
                                    {/* Keyword Planner specs */}
                                    {kwpRows.length > 0 && (
                                      <div className="p-3 bg-[#2a3627] rounded border border-white/10">
                                        <div className="flex justify-between items-center mb-2">
                                          <h4 className="text-sm font-semibold text-[#C0FE72]">Keyword Planner details</h4>
                                          <div className="text-[10px] text-gray-300">
                                            Rows: {kwpRows.length}
                                          </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-[11px] text-left border-collapse">
                                            <thead>
                                              <tr className="border-b border-white/30 text-gray-300">
                                                {Object.keys(kwpRows[0]).map((col) => (
                                                  <th key={col} className="pb-1.5 pr-2 font-semibold uppercase tracking-wider whitespace-nowrap">
                                                    {col.replace(/_/g, ' ')}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {kwpRows.map((row, idx2) => (
                                                <tr key={idx2} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                                  {Object.keys(kwpRows[0]).map((col) => (
                                                    <td key={col} className="py-1 pr-2 text-gray-100 whitespace-nowrap">
                                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                                        ? String((row as any)[col])
                                                        : '-'}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* Google Trends specs */}
                                    {trendsRows.length > 0 && (
                                      <div className="p-3 bg-[#2a3627] rounded border border-white/10">
                                        <div className="flex justify-between items-center mb-2">
                                          <h4 className="text-sm font-semibold text-[#C0FE72]">Google Trends details</h4>
                                          <div className="text-[10px] text-gray-300">
                                            Rows: {trendsRows.length}
                                          </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-[11px] text-left border-collapse">
                                            <thead>
                                              <tr className="border-b border-white/30 text-gray-300">
                                                {Object.keys(trendsRows[0]).map((col) => (
                                                  <th key={col} className="pb-1.5 pr-2 font-semibold uppercase tracking-wider whitespace-nowrap">
                                                    {col.replace(/_/g, ' ')}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {trendsRows.map((row, idx2) => (
                                                <tr key={idx2} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                                  {Object.keys(trendsRows[0]).map((col) => (
                                                    <td key={col} className="py-1 pr-2 text-gray-100 whitespace-nowrap">
                                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                                        ? String((row as any)[col])
                                                        : '-'}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* Amazon specs */}
                                    {amzRows.length > 0 && (
                                      <div className="p-3 bg-[#2a3627] rounded border border-white/10">
                                        <div className="flex justify-between items-center mb-2">
                                          <h4 className="text-sm font-semibold text-[#C0FE72]">Amazon marketplace details</h4>
                                          <div className="text-[10px] text-gray-300">
                                            Rows: {amzRows.length}
                                          </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-[11px] text-left border-collapse">
                                            <thead>
                                              <tr className="border-b border-white/30 text-gray-300">
                                                {Object.keys(amzRows[0]).map((col) => (
                                                  <th key={col} className="pb-1.5 pr-2 font-semibold uppercase tracking-wider whitespace-nowrap">
                                                    {col.replace(/_/g, ' ')}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {amzRows.map((row, idx2) => (
                                                <tr key={idx2} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                                  {Object.keys(amzRows[0]).map((col) => (
                                                    <td key={col} className="py-1 pr-2 text-gray-100 whitespace-nowrap">
                                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                                        ? String((row as any)[col])
                                                        : '-'}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {/* Alibaba specs */}
                                    {aliRows.length > 0 && (
                                      <div className="p-3 bg-[#2a3627] rounded border border-white/10">
                                        <div className="flex justify-between items-center mb-2">
                                          <h4 className="text-sm font-semibold text-[#C0FE72]">Alibaba supplier details</h4>
                                          <div className="text-[10px] text-gray-300">
                                            Rows: {aliRows.length}
                                          </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-[11px] text-left border-collapse">
                                            <thead>
                                              <tr className="border-b border-white/30 text-gray-300">
                                                {Object.keys(aliRows[0]).map((col) => (
                                                  <th key={col} className="pb-1.5 pr-2 font-semibold uppercase tracking-wider whitespace-nowrap">
                                                    {col.replace(/_/g, ' ')}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {aliRows.map((row, idx2) => (
                                                <tr key={idx2} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                                  {Object.keys(aliRows[0]).map((col) => (
                                                    <td key={col} className="py-1 pr-2 text-gray-100 whitespace-nowrap">
                                                      {(row as any)[col] !== undefined && (row as any)[col] !== null
                                                        ? String((row as any)[col])
                                                        : '-'}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    {kwpRows.length === 0 && trendsRows.length === 0 && amzRows.length === 0 && aliRows.length === 0 && (
                                      <p className="text-[11px] text-gray-300">
                                        No stage-level rows were found matching this product&apos;s keyword.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {searchingMode !== 'CATEGORY BASED' && products.length > 0 && pipelineStatus === 'POLLING' && isPreliminary && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-xl font-bold text-white">
                    Total Products: <span className="text-yellow-500">{products.length}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-yellow-500 text-4xl font-bold mb-2">PRELIMINARY / PROCESSING</p>
                  </div>
                  <div className="w-48"></div> {/* Spacer for symmetry */}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 border border-white bg-[#32402F] text-sm opacity-70">
                    <thead>
                      <tr className="bg-yellow-600 text-black">
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky left-0 z-10 bg-yellow-600"
                          style={{ minWidth: '120px', borderRight: '2px solid white' }}
                        >
                          Global ID
                        </th>
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky z-10 bg-yellow-600"
                          style={{ left: '120px', minWidth: '150px', borderRight: '2px solid white' }}
                        >
                          Keyword
                        </th>
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky z-10 bg-yellow-600"
                          style={{ left: '270px', minWidth: '200px', borderRight: '2px solid white', boxShadow: '2px 0 0 0 white' }}
                        >
                          Title
                        </th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Base Price (USD)</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Category</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Search Category</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">FCL Price (USD)</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Keyword Interest Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Avg Monthly Searches</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Margin %</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Trend Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Supplier Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Price Comp Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Final Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, index) => (
                        <tr
                          key={`${product.global_id || product.product_id || 'prod'}-${index}`}
                          className="group hover:bg-[#3d4d3a] transition-colors"
                        >
                          <td
                            className="border border-white px-3 py-2 sticky left-0 z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ minWidth: '120px', borderRight: '2px solid white' }}
                          >
                            {product.global_id || '-'}
                          </td>
                          <td
                            className="border border-white px-3 py-2 sticky z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ left: '120px', minWidth: '150px', borderRight: '2px solid white' }}
                          >
                            {product.keyword ? toTitleCase(product.keyword) : '-'}
                          </td>
                          <td
                            className="border border-white px-3 py-2 sticky z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ left: '270px', minWidth: '200px', borderRight: '2px solid white', boxShadow: '2px 0 0 0 white' }}
                          >
                            {product.title || '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.base_price_usd !== undefined && product.base_price_usd !== null) ? `$${Number(product.base_price_usd).toFixed(2)}` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.category_leaf || product.category) ? toTitleCase(product.category_leaf || product.category || '') : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.search_category) ? toTitleCase(product.search_category || '') : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.fcl_price_usd !== undefined && product.fcl_price_usd !== null) ? `$${Number(product.fcl_price_usd).toFixed(2)}` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.keyword_interest_score !== undefined && product.keyword_interest_score !== null) ? product.keyword_interest_score : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.avg_monthly_searches !== undefined && product.avg_monthly_searches !== null) ? Number(product.avg_monthly_searches).toLocaleString() : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.margin_pct !== undefined && product.margin_pct !== null) ? `${Number(product.margin_pct).toFixed(2)}%` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.trend_score !== undefined && product.trend_score !== null) ? Math.round(Number(product.trend_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.supplier_score !== undefined && product.supplier_score !== null) ? Math.round(Number(product.supplier_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.price_comp_score !== undefined && product.price_comp_score !== null) ? Math.round(Number(product.price_comp_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.final_score !== undefined && product.final_score !== null) ? Math.round(Number(product.final_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.rank !== undefined && product.rank !== null) ? product.rank : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {searchingMode !== 'CATEGORY BASED' && products.length > 0 && pipelineStatus === 'IDLE' && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-4">
                  <h2 className="text-2xl font-bold tracking-wider">PRODUCT RESULTS</h2>
                  <div className="text-xl font-bold text-white">
                    Total Products: <span className="text-[#C0FE72]">{products.length}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 border border-white bg-[#32402F] text-sm">
                    <thead>
                      <tr className="bg-yellow-500 text-black">
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky left-0 z-10 bg-yellow-500"
                          style={{ minWidth: '120px', borderRight: '2px solid white' }}
                        >
                          Global ID
                        </th>
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky z-10 bg-yellow-500"
                          style={{ left: '120px', minWidth: '150px', borderRight: '2px solid white' }}
                        >
                          Keyword
                        </th>
                        <th
                          className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap sticky z-10 bg-yellow-500"
                          style={{ left: '270px', minWidth: '200px', borderRight: '2px solid white', boxShadow: '2px 0 0 0 white' }}
                        >
                          Title
                        </th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Base Price (USD)</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Category</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Search Category</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">FCL Price (USD)</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Keyword Interest Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Avg Monthly Searches</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Margin %</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Trend Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Supplier Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Price Comp Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Final Score</th>
                        <th className="border border-white px-3 py-2 text-left font-bold whitespace-nowrap">Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, index) => (
                        <tr
                          key={`${product.global_id || product.product_id || 'prod'}-${index}`}
                          className="group hover:bg-[#3d4d3a] transition-colors"
                        >
                          <td
                            className="border border-white px-3 py-2 sticky left-0 z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ minWidth: '120px', borderRight: '2px solid white' }}
                          >
                            {product.global_id || '-'}
                          </td>
                          <td
                            className="border border-white px-3 py-2 sticky z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ left: '120px', minWidth: '150px', borderRight: '2px solid white' }}
                          >
                            {product.keyword ? toTitleCase(product.keyword) : '-'}
                          </td>
                          <td
                            className="border border-white px-3 py-2 sticky z-10 bg-[#32402F] group-hover:bg-[#3d4d3a]"
                            style={{ left: '270px', minWidth: '200px', borderRight: '2px solid white', boxShadow: '2px 0 0 0 white' }}
                          >
                            {product.title || '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.base_price_usd !== undefined && product.base_price_usd !== null) ? `$${Number(product.base_price_usd).toFixed(2)}` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.category_leaf || product.category) ? toTitleCase(product.category_leaf || product.category || '') : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.search_category) ? toTitleCase(product.search_category || '') : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.fcl_price_usd !== undefined && product.fcl_price_usd !== null) ? `$${Number(product.fcl_price_usd).toFixed(2)}` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.keyword_interest_score !== undefined && product.keyword_interest_score !== null) ? product.keyword_interest_score : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.avg_monthly_searches !== undefined && product.avg_monthly_searches !== null) ? Number(product.avg_monthly_searches).toLocaleString() : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.margin_pct !== undefined && product.margin_pct !== null) ? `${Number(product.margin_pct).toFixed(2)}%` : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.trend_score !== undefined && product.trend_score !== null) ? Math.round(Number(product.trend_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.supplier_score !== undefined && product.supplier_score !== null) ? Math.round(Number(product.supplier_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.price_comp_score !== undefined && product.price_comp_score !== null) ? Math.round(Number(product.price_comp_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.final_score !== undefined && product.final_score !== null) ? Math.round(Number(product.final_score)) : '-'}
                          </td>
                          <td className="border border-white px-3 py-2">
                            {(product.rank !== undefined && product.rank !== null) ? product.rank : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {searchingMode !== 'CATEGORY BASED' && products.length === 0 && !isLoading && !error && hasPerformedSearch && (
              <div className="flex flex-col items-center justify-center min-h-[300px] bg-[#32402F] rounded-lg border border-white/20">
                <div className="text-center">
                  <p className="text-[#C0FE72] text-4xl font-bold mb-4">NO RESULTS FOUND</p>
                  <p className="text-gray-300 text-lg">We couldn't find any products matching your criteria.</p>
                  <button
                    onClick={handleReset}
                    className="mt-6 px-6 py-2 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400 transition-colors"
                  >
                    CLEAR FILTERS
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;



