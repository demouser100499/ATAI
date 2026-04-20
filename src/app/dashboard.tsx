'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { fetchProducts, Product } from '@/lib/productsService';

// Countries with geo codes - moved outside component since it's static
const countries = [
  { name: 'United States', code: 'US' },
  { name: 'Canada', code: 'CA' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Guatemala', code: 'GT' },
  { name: 'El Salvador', code: 'SV' },
  { name: 'Honduras', code: 'HN' },
  { name: 'Nicaragua', code: 'NI' },
  { name: 'Costa Rica', code: 'CR' },
  { name: 'Panama', code: 'PA' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Argentina', code: 'AR' },
];

// Supported Amazon product categories for Category Based search mode
const GT_CATEGORIES = [
  'All categories',
  'Appliances',
  'Arts, Crafts & Sewing',
  'Automotive Parts & Accessories',
  'Baby',
  'Baby Clothing, Shoes & Jewelry',
  'Beauty & Personal Care',
  "Boy's Clothing, Shoes & Jewelry",
  'Cell Phones & Accessories',
  'Clothing, Shoes & Jewelry',
  'Collectibles & Fine Art',
  'Computers',
  'Electronics',
  'Garden & Outdoor',
  "Girl's Clothing, Shoes & Jewelry",
  'Grocery & Gourmet Food',
  'Handmade',
  'Health, Household & Baby Care',
  'Home & Kitchen',
  'Industrial & Scientific',
  'Luggage & Travel Gear',
  "Men's Clothing, Shoes & Jewelry",
  'Musical Instruments',
  'Office Products',
  'Pet Supplies',
  'Smart Home',
  'Sports & Outdoors',
  'Tools & Home Improvement',
  'Toys & Games',
  "Women's Clothing, Shoes & Jewelry",
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
  const [kwpMinSearches, setKwpMinSearches] = useState('');
  const [kwpMaxSearches, setKwpMaxSearches] = useState('');
  const [variantLimitMax, setVariantLimitMax] = useState('');
  const [resultsCap, setResultsCap] = useState('');
  const [googleTrendScore, setGoogleTrendScore] = useState(0);
  const [productCategory, setProductCategory] = useState('All categories');
  const [trendPeriod, setTrendPeriod] = useState('');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [blacklistedWords, setBlacklistedWords] = useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = useState('');
  const [amazonFilters, setAmazonFilters] = useState(true);
  const [alibabaFilters, setAlibabaFilters] = useState(true);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [reviewsMin, setReviewsMin] = useState(0);
  const [reviewsMax, setReviewsMax] = useState(0);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [fcl, setFcl] = useState(0.0);
  const [costBelow, setCostBelow] = useState(0.0);
  const [moq, setMoq] = useState('');
  const [alibabaRating, setAlibabaRating] = useState(0);
  const [verifiedSupplier, setVerifiedSupplier] = useState(false);

  // ── Preset system (dynamic — starts empty) ───────────────────────────────
  type PresetData = {
    searchingMode?: string;
    productCategory?: string;
    location: string;
    trendPeriod: string;
    variantLimitMax: string;
    resultsCap: string;
    kwpMinSearches: string;
    kwpMaxSearches: string;
    blacklistedWords: string[];
    googleTrendScore: number;
    amazonFilters: boolean;
    priceMin: number;
    priceMax: number;
    reviewsMin: number;
    reviewsMax: number;
    ratingFilter: number;
    fcl: number;
    alibabaFilters: boolean;
    costBelow: number;
    moq: string;
    alibabaRating: number;
    verifiedSupplier: boolean;
  };
  type PresetSlot = { id: number; name: string; data: PresetData };

  const [presets, setPresets] = useState<PresetSlot[]>([]);
  const [presetCounter, setPresetCounter] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [presetSaveFlash, setPresetSaveFlash] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [presetNameInput, setPresetNameInput] = useState('');

  // Load presets from server on mount (shared across all users)
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if we are actively editing a name or if the click is inside the dropdown
      if (editingPresetId !== null) return;
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPresetDropdownOpen(false);
        setIsCreatingNewPreset(false);
      }
    }
    if (presetDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [presetDropdownOpen, editingPresetId]);

  useEffect(() => {
    fetch('/api/presets')
      .then(r => r.json())
      .then((stored: { list: PresetSlot[]; counter: number }) => {
        setPresets(stored.list || []);
        setPresetCounter(stored.counter || 0);
        if (stored.list?.length > 0) setSelectedPresetId(stored.list[0].id);
      })
      .catch(e => console.error('Failed to load presets', e));
  }, []);

  const getFiltersSnapshot = useCallback((): PresetData => ({
    searchingMode,
    productCategory,
    location,
    trendPeriod,
    variantLimitMax,
    resultsCap,
    kwpMinSearches,
    kwpMaxSearches,
    blacklistedWords,
    googleTrendScore,
    amazonFilters,
    priceMin,
    priceMax,
    reviewsMin,
    reviewsMax,
    ratingFilter,
    fcl,
    alibabaFilters,
    costBelow,
    moq,
    alibabaRating,
    verifiedSupplier,
  }), [searchingMode, productCategory, location, trendPeriod, variantLimitMax, resultsCap, kwpMinSearches, kwpMaxSearches,
    blacklistedWords, googleTrendScore, amazonFilters, priceMin, priceMax, reviewsMin, reviewsMax,
    ratingFilter, fcl, alibabaFilters, costBelow, moq, alibabaRating, verifiedSupplier]);

  // Save current filters as a brand-new preset slot (server-side)
  const handleSaveNewPreset = useCallback(async (customName?: string) => {
    const data = getFiltersSnapshot();
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_new', name: customName, data }),
      });
      const result = await res.json();
      if (result.success) {
        setPresets(prev => [...prev, result.preset]);
        setPresetCounter(result.counter);
        setSelectedPresetId(result.preset.id);
        setPresetSaveFlash(true);
        setTimeout(() => setPresetSaveFlash(false), 1500);
      }
    } catch (e) {
      console.error('Failed to save preset', e);
    }
  }, [getFiltersSnapshot]);

  const handleLoadPreset = useCallback((idToLoad?: number) => {
    const targetId = idToLoad !== undefined ? idToLoad : selectedPresetId;
    const slot = presets.find(p => p.id === targetId);
    if (!slot) return;
    const d = slot.data;
    // Signal the searchingMode effect to skip its reset on this mode change
    isLoadingPresetRef.current = true;
    
    // Safety reset to ensure the ref doesn't stick if searchingMode is identical
    setTimeout(() => { isLoadingPresetRef.current = false; }, 100);

    if (d.searchingMode) setSearchingMode(d.searchingMode);
    if (d.productCategory) setProductCategory(d.productCategory);
    setLocation(d.location ?? '');
    setTrendPeriod(d.trendPeriod ?? '');
    setVariantLimitMax(d.variantLimitMax ?? '');
    setResultsCap(d.resultsCap ?? '');
    setKwpMinSearches(d.kwpMinSearches ?? '');
    setKwpMaxSearches(d.kwpMaxSearches ?? '');
    setBlacklistedWords(Array.isArray(d.blacklistedWords) ? d.blacklistedWords : []);
    setBlacklistInput('');
    setGoogleTrendScore(d.googleTrendScore ?? 0);
    setAmazonFilters(d.amazonFilters ?? true);
    setPriceMin(d.priceMin ?? 0);
    setPriceMax(d.priceMax ?? 0);
    setReviewsMin(d.reviewsMin ?? 0);
    setReviewsMax(d.reviewsMax ?? 0);
    setRatingFilter(d.ratingFilter ?? 0);
    setFcl(d.fcl ?? 0);
    setAlibabaFilters(d.alibabaFilters ?? true);
    setCostBelow(d.costBelow ?? 0);
    setMoq(d.moq ?? '');
    setAlibabaRating(d.alibabaRating ?? 0);
    setVerifiedSupplier(d.verifiedSupplier ?? false);
  }, [presets, selectedPresetId]);

  const handleDeletePreset = useCallback(async (id: number) => {
    try {
      await fetch('/api/presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
      if (selectedPresetId === id) {
        setSelectedPresetId(updated.length > 0 ? updated[updated.length - 1].id : null);
      }
    } catch (e) {
      console.error('Failed to delete preset', e);
    }
  }, [presets, selectedPresetId]);

  const handleRenamePreset = useCallback(async (id: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) { setEditingPresetId(null); return; }
    try {
      await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', id, name: trimmed }),
      });
      setPresets(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p));
      setEditingPresetId(null);
    } catch (e) {
      console.error('Failed to rename preset', e);
    }
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  // Products API state
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pipeline State
  const cancelTokenRef = useRef(false);
  // Flag to prevent the searchingMode cleanup effect from resetting filters during preset loads
  const isLoadingPresetRef = useRef(false);
  const [pipelineStatus, setPipelineStatus] = useState<'IDLE' | 'STARTING' | 'POLLING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [executionArn, setExecutionArn] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pollingIntervalRef, setPollingIntervalRef] = useState<NodeJS.Timeout | null>(null);
  const [isBatching, setIsBatching] = useState(false); // Tracking sequential category trigger phase
  const [isPreliminary, setIsPreliminary] = useState(false);
  const [hasPerformedSearch, setHasPerformedSearch] = useState(false);
  const [consolidatedResults, setConsolidatedResults] = useState<any[]>([]);
  const [categoryExecutions, setCategoryExecutions] = useState<{ keyword: string, run_id: string, execution_arn: string, status?: string }[]>([]);
  const categoryExecutionsRef = useRef(categoryExecutions);
  useEffect(() => {
    categoryExecutionsRef.current = categoryExecutions;
  }, [categoryExecutions]);
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

  // Consolidated table row selection for easy horizontal scrolling tracking
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const [isCreatingNewPreset, setIsCreatingNewPreset] = useState(false);
  const [newPresetNameInput, setNewPresetNameInput] = useState('');

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

  // ── Floating horizontal scrollbar logic ────────────────────────────────
  const mainTableScrollRef = useRef<HTMLDivElement>(null);
  const stickyScrollContainerRef = useRef<HTMLDivElement>(null);
  const stickyScrollContentRef = useRef<HTMLDivElement>(null);
  const [showStickyScroll, setShowStickyScroll] = useState(false);

  const handleMainTableScroll = () => {
    if (stickyScrollContainerRef.current && mainTableScrollRef.current) {
      stickyScrollContainerRef.current.scrollLeft = mainTableScrollRef.current.scrollLeft;
    }
  };
  const handleStickyScroll = () => {
    if (mainTableScrollRef.current && stickyScrollContainerRef.current) {
      mainTableScrollRef.current.scrollLeft = stickyScrollContainerRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    if (!isClient) return;

    const handleScrollAndResize = () => {
      if (!mainTableScrollRef.current || !stickyScrollContentRef.current || !stickyScrollContainerRef.current) return;
      const rect = mainTableScrollRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Sync the width of the fake content to the real table scroll width
      stickyScrollContentRef.current.style.width = `${mainTableScrollRef.current.scrollWidth}px`;

      // Show the sticky scrollbar if the top of the table is visible AND the bottom is offscreen
      const isTopVisible = rect.top < viewportHeight;
      const isBottomOffscreen = rect.bottom > viewportHeight;

      setShowStickyScroll(isTopVisible && isBottomOffscreen);
    };

    window.addEventListener('scroll', handleScrollAndResize, { passive: true });
    window.addEventListener('resize', handleScrollAndResize, { passive: true });

    const observer = new MutationObserver(handleScrollAndResize);
    if (mainTableScrollRef.current) {
      observer.observe(mainTableScrollRef.current, { childList: true, subtree: true });
    }

    handleScrollAndResize();

    return () => {
      window.removeEventListener('scroll', handleScrollAndResize);
      window.removeEventListener('resize', handleScrollAndResize);
      observer.disconnect();
    };
  }, [isClient, consolidatedResults, pipelineStatus]);
  // ────────────────────────────────────────────────────────────────────────

  // Check if fields should be disabled (after successful pipeline completion)
  // KEYWORD SEARCH and LOCATION should remain enabled
  const pipelineFieldsDisabled = pipelineStatus === 'COMPLETED'; // For VARIANT LIMIT MAX, RESULTS CAP MAX, TREND PERIOD
  const fieldsDisabled = false; // KEYWORD SEARCH and LOCATION are never disabled

  // Helper: currently a passthrough – stage data is already scoped per execution ARN.
  const filterStageRowsByVariant = useCallback(
    (rows: any[] | null, fields: string[], primaryKeywordField?: string): any[] | null => {
      return rows;
    },
    []
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

      // ── Sheet 1: Consolidated Results (always first if present)
      if (consolidatedResults.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consolidatedResults), 'Consolidated Results');
      }

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

  // Clear results and filters when searching mode changes.
  // Skipped when a preset is being loaded (isLoadingPresetRef) so the preset
  // values are not wiped out immediately after being applied.
  useEffect(() => {
    if (isLoadingPresetRef.current) {
      // A preset load just changed the mode — let the preset values stand.
      isLoadingPresetRef.current = false;
      return;
    }

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
    setKwpMinSearches('');
    setKwpMaxSearches('');
    setBlacklistedWords([]);
    setBlacklistInput('');
    setGoogleTrendScore(0);
    setPriceMin(0);
    setPriceMax(0);
    setReviewsMin(0);
    setReviewsMax(0);
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
    setKwpMinSearches('');
    setKwpMaxSearches('');
    setVariantLimitMax('');
    setResultsCap('');
    setGoogleTrendScore(0);
    setProductCategory('All categories');
    setTrendPeriod('');
    setBlacklistedWords([]);
    setBlacklistInput('');
    setAmazonFilters(true);
    setAlibabaFilters(true);
    setPriceMin(0);
    setPriceMax(0);
    setReviewsMin(0);
    setReviewsMax(0);
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
    setKwpMinSearches('');
    setKwpMaxSearches('');
    setVariantLimitMax('');
    setResultsCap('');
    setGoogleTrendScore(0);
    setProductCategory('All categories');
    setTrendPeriod('');
    setBlacklistedWords([]);
    setBlacklistInput('');
    setAmazonFilters(true);
    setAlibabaFilters(true);
    setPriceMin(0);
    setPriceMax(0);
    setReviewsMin(0);
    setReviewsMax(0);
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

  // ─── Consolidation + Scoring ─────────────────────────────────────────────
  // Merges the four in-memory stage arrays (KWP, Trends, Amazon, Alibaba) and
  // computes a final score + rank for each row. Called when the pipeline SUCCEEDS.
  const buildConsolidated = useCallback((
    optKwp?: any[],
    optTrends?: any[],
    optAmz?: any[],
    optAli?: any[]
  ) => {
    // We anchor on Amazon rows (products). If Amazon is disabled, fall back to KWP keywords.
    const amzRows: any[] = optAmz ?? (amazonResults && amazonResults.length > 0 ? amazonResults : []);
    const aliRows: any[] = optAli ?? (alibabaResults && alibabaResults.length > 0 ? alibabaResults : []);
    const kwpRows: any[] = optKwp ?? (keywordPlannerResults && keywordPlannerResults.length > 0 ? keywordPlannerResults : []);
    const trendRows: any[] = optTrends ?? (trendsResults && trendsResults.length > 0 ? trendsResults : []);

    // Determine seed rows: KWP keywords first (user-requested), fall back to Amazon if KWP is empty
    const seedRows: any[] = kwpRows.length > 0 ? kwpRows : amzRows;
    if (seedRows.length === 0) return;

    // ── Scoped grouping ─────────────────────────────────────────────────────
    // In category mode every child execution sets a shared `keyword` field on
    // every Amazon/Alibaba row (= the execution root keyword, e.g. "portable mp3 player").
    // KWP variant rows carry `root_keyword` pointing to the same root.
    // We group marketplace rows by that root keyword so each KWP variant is matched
    // ONLY against products from its own execution — preventing the old arr[0]
    // fallback from bleeding a random cross-execution product into every unmatched row.
    const groupByExecKw = (rows: any[]): Map<string, any[]> => {
      const m = new Map<string, any[]>();
      for (const r of rows) {
        const key = (r.keyword ?? r.search_category ?? '').toString().toLowerCase().trim();
        if (!key) continue;
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(r);
      }
      return m;
    };
    const amzByExecKw = groupByExecKw(amzRows);
    const aliByExecKw = groupByExecKw(aliRows);

    // ── Fuzzy join helper ─────────────────────────────────────────────────
    // Priority: 1) exact match  2) bidirectional substring  3) title-word overlap
    // scopedFirst: preferred subset (marketplace rows for the same execution).
    // Returns null — never falls back to arr[0] — so unmatched rows show "-"
    // instead of a misleading product from a completely different execution.
    const matchFuzzy = (
      arr: any[],
      kwpKw: string,
      kwFields: string[],
      titleField?: string,
      scopedFirst?: any[]
    ): any | null => {
      if (!arr.length) return null;
      const kw = kwpKw ? kwpKw.toLowerCase().trim() : '';
      const kwWords = kw.split(/\s+/).filter((w) => w.length > 2);

      const trySet = (rows: any[]): any | null => {
        if (!rows.length) return null;

        // 1. If we have a title to match against, prioritize the BEST title overlap!
        if (titleField && kwWords.length > 0) {
          let bestMatch = null;
          let bestScore = 0;
          for (const r of rows) {
            const title = (r[titleField] ?? '').toString().toLowerCase();
            const hits = kwWords.filter((w) => title.includes(w)).length;
            if (hits >= Math.ceil(kwWords.length * 0.4) && hits > bestScore) {
              bestScore = hits;
              bestMatch = r;
            }
          }
          if (bestMatch) return bestMatch;
        }

        // 2. Exact keyword match
        const exact = rows.find((r) =>
          kwFields.some((f) => (r[f] ?? '').toString().toLowerCase() === kw)
        );
        if (exact) return exact;

        // 3. Bidirectional inclusion (loose fallback for KWP/Trends without titles)
        if (!titleField) {
          const bidir = rows.find((r) =>
            kwFields.some((f) => {
              const val = (r[f] ?? '').toString().toLowerCase();
              return val && (kw.includes(val) || val.includes(kw));
            })
          );
          if (bidir) return bidir;
        }

        return null;
      };

      // Try scoped subset first; widen to full array only if scoped miss.
      // Still no arr[0] blind fallback — return null if nothing genuinely matches.
      if (scopedFirst && scopedFirst.length > 0) {
        const scopedMatch = trySet(scopedFirst);
        if (scopedMatch) return scopedMatch;
        return trySet(arr);
      }
      return trySet(arr);
    };

    // Collect all numeric values for normalisation
    const allSearchVol: number[] = [];
    const allTrendPeak: number[] = [];
    const allReviews: number[] = [];
    const allPrices: number[] = [];
    const allMoq: number[] = [];
    const allRating: number[] = [];

    seedRows.forEach((row) => {
      const kw = (row.keyword ?? row.sub_keyword ?? row.root_keyword ?? '').toString();
      // root_keyword = the execution's trigger keyword; use it to scope marketplace lookups
      const rootKw = (row.root_keyword ?? row.keyword ?? '').toString().toLowerCase().trim();
      const scopedAmz = amzByExecKw.get(rootKw) ?? [];
      const scopedAli = aliByExecKw.get(rootKw) ?? [];

      const kwpMatch = matchFuzzy(kwpRows, kw, ['keyword', 'sub_keyword', 'root_keyword']);
      const trendMatch = matchFuzzy(trendRows, kw, ['keyword']);
      const amzMatch = matchFuzzy(amzRows, kw, ['keyword', 'search_category'], 'title', scopedAmz);
      const aliMatch = matchFuzzy(aliRows, kw, ['keyword', 'search_category'], 'title', scopedAli);

      const sv = Number(kwpMatch?.avg_monthly_searches ?? row.avg_monthly_searches ?? 0);
      const tp = Number(trendMatch?.gt_interest_peak ?? trendMatch?.interest_peak ?? 0);
      const reviews = Number(amzMatch?.reviews_count ?? 0);
      const price = Number(amzMatch?.amazon_price_usd ?? amzMatch?.base_price_usd ?? 0);
      const moq = Number(aliMatch?.moq ?? 0);
      const rating = Number(amzMatch?.rating ?? aliMatch?.supplier_rating ?? 0);

      if (sv > 0) allSearchVol.push(sv);
      if (tp > 0) allTrendPeak.push(tp);
      if (reviews > 0) allReviews.push(reviews);
      if (price > 0) allPrices.push(price);
      if (moq > 0) allMoq.push(moq);
      if (rating > 0) allRating.push(rating);
    });

    const maxOrOne = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 1;
    const maxSV = maxOrOne(allSearchVol);
    const maxTP = maxOrOne(allTrendPeak);
    const maxReviews = maxOrOne(allReviews);
    const maxPrice = maxOrOne(allPrices);
    const maxMoq = maxOrOne(allMoq);
    const maxRating = maxOrOne(allRating);

    const scored = seedRows.map((row) => {
      const kw = (row.keyword ?? row.sub_keyword ?? row.root_keyword ?? '').toString();
      const rootKw = (row.root_keyword ?? row.keyword ?? '').toString().toLowerCase().trim();
      const scopedAmz = amzByExecKw.get(rootKw) ?? [];
      const scopedAli = aliByExecKw.get(rootKw) ?? [];

      const kwpMatch = matchFuzzy(kwpRows, kw, ['keyword', 'sub_keyword', 'root_keyword']);
      const trendMatch = matchFuzzy(trendRows, kw, ['keyword']);
      const amzMatch = matchFuzzy(amzRows, kw, ['keyword', 'search_category'], 'title', scopedAmz);
      const aliMatch = matchFuzzy(aliRows, kw, ['keyword', 'search_category'], 'title', scopedAli);

      // ── KWP fields (from KWP seed row itself or kwpMatch)
      const avgMonthlySearches = Number(kwpMatch?.avg_monthly_searches ?? row.avg_monthly_searches ?? 0);
      const cpcUsd = Number(kwpMatch?.cpc_usd ?? row.cpc_usd ?? 0);
      const competitionIndex = kwpMatch?.competition_index ?? row.competition_index ?? '-';
      const trendDirection = kwpMatch?.trend_direction ?? row.trend_direction ?? '-';

      // ── Google Trends fields
      const trendPeak = Number(trendMatch?.gt_interest_peak ?? 0);
      const trendAvg = Number(trendMatch?.gt_interest_avg ?? 0);
      const gtInterestTrend = trendMatch?.gt_interest_trend ?? '-';
      const gtInterestChangePct = trendMatch?.gt_interest_change_pct ?? null;

      // ── Amazon fields (from fuzzy-matched Amazon row)
      const amazonTitle = amzMatch?.title ?? '-';
      const asin = amzMatch?.a_sin ?? amzMatch?.asin ?? '-';
      const amazonPrice = Number(amzMatch?.amazon_price_usd ?? amzMatch?.base_price_usd ?? 0);
      const reviews = Number(amzMatch?.reviews_count ?? 0);
      const rating = Number(amzMatch?.rating ?? 0);
      const bestsellerRank = amzMatch?.bestseller_rank ?? '-';

      // ── Alibaba fields (from fuzzy-matched Alibaba row)
      const aliTitle = aliMatch?.title ?? '-';
      const moq = Number(aliMatch?.moq ?? 0);
      const supplierRating = Number(aliMatch?.supplier_rating ?? 0);
      const supplierCountry = aliMatch?.supplier_country ?? '-';
      const aliCategory = aliMatch?.category ?? '-';

      // ── Scores (0–100)
      const demandScore = maxSV > 0 ? Math.round((avgMonthlySearches / maxSV) * 100) : 0;
      const trendScore = maxTP > 0 ? Math.round((trendPeak / maxTP) * 100) : 0;
      // Lower Amazon reviews = less competition (easier market entry)
      const competitionScore = maxReviews > 0 ? Math.round((1 - Math.min(reviews / maxReviews, 1)) * 100) : 100;
      const priceScore = maxPrice > 0 && amazonPrice > 0 ? Math.round(Math.min((amazonPrice / maxPrice) * 100, 100)) : 0;
      const supplierScore = Math.round(
        (supplierRating > 0 && maxRating > 0 ? (supplierRating / maxRating) * 50 : 0) +
        (moq > 0 && maxMoq > 0 ? (1 - Math.min(moq / maxMoq, 1)) * 50 : 0)
      );

      // Weighted final: Demand 35% · Trend 30% · Competition 15% · Supplier 10% · Price 10%
      const finalScore = Math.round(
        demandScore * 0.35 +
        trendScore * 0.30 +
        competitionScore * 0.15 +
        supplierScore * 0.10 +
        priceScore * 0.10
      );

      return {
        // Identifiers
        keyword: kw,
        // KWP
        avg_monthly_searches: avgMonthlySearches || null,
        cpc_usd: cpcUsd || null,
        competition_index: competitionIndex,
        kwp_trend_direction: trendDirection,
        // Google Trends
        trend_peak: trendPeak || null,
        trend_avg: trendAvg ? Number(trendAvg.toFixed(1)) : null,
        gt_interest_trend: gtInterestTrend,
        gt_interest_change_pct: gtInterestChangePct,
        // Amazon
        amazon_title: amazonTitle,
        asin,
        amazon_price_usd: amazonPrice || null,
        reviews_count: reviews || null,
        rating: rating || null,
        bestseller_rank: bestsellerRank,
        // Alibaba
        alibaba_title: aliTitle,
        alibaba_price_min_usd: aliMatch?.alibaba_price_min_usd ? Number(aliMatch.alibaba_price_min_usd) : null,
        moq: moq || null,
        supplier_rating: supplierRating || null,
        supplier_country: supplierCountry,
        ali_category: aliCategory,
        verified_supplier: aliMatch?.verified_supplier === true || aliMatch?.verified_supplier === 'true',
        // Scores
        demand_score: demandScore,
        trend_score: trendScore,
        competition_score: competitionScore,
        supplier_score: supplierScore,
        price_score: priceScore,
        final_score: finalScore,
      };
    });

    // Rank by final_score descending
    const ranked = [...scored]
      .sort((a, b) => b.final_score - a.final_score)
      .map((row, i) => ({ rank: i + 1, ...row }));

    setConsolidatedResults(ranked);
  }, [amazonResults, alibabaResults, keywordPlannerResults, trendsResults]);

  // Apply UI filters to the consolidated list dynamically.
  // No longer applying in-browser filters, rendering consolidatedResults directly.

  // Trigger consolidation once the pipeline succeeds, or for intermediate results during POLLING
  useEffect(() => {
    if (pipelineStatus === 'IDLE' || pipelineStatus === 'STARTING') return;

    if (searchingMode === 'CATEGORY BASED' && categoryExecutions.length > 0) {
      // Always aggregate ALL succeeded variants' data into one consolidated table
      // (regardless of which variant is selected in the dropdown — the dropdown
      //  only filters the per-stage detail panels below the table)
      if (pipelineStatus !== 'COMPLETED') return;

      setStatusMessage('Aggregating stage data for all variants...');
      let isCancelled = false;
      const aggregateCategoryData = async () => {
        try {
          const fetchPromises = categoryExecutions.map(async (exec) => {
            const arn = exec.execution_arn;
            if (!arn || exec.status !== 'SUCCEEDED') {
              return { kwp: [], trends: [], amz: [], ali: [] };
            }

            const [kwpRes, trendsRes, amzRes, aliRes] = await Promise.all([
              fetch(`/api/pipeline/keyword-planner?arn=${encodeURIComponent(arn)}`).catch(() => null),
              fetch(`/api/pipeline/google-trends?arn=${encodeURIComponent(arn)}`).catch(() => null),
              amazonFilters ? fetch(`/api/pipeline/amazon?arn=${encodeURIComponent(arn)}`).catch(() => null) : Promise.resolve(null),
              alibabaFilters ? fetch(`/api/pipeline/alibaba?arn=${encodeURIComponent(arn)}`).catch(() => null) : Promise.resolve(null),
            ]);

            const kwpData = kwpRes?.ok ? await kwpRes.json().catch(() => null) : null;
            const trendsData = trendsRes?.ok ? await trendsRes.json().catch(() => null) : null;
            const amzData = amzRes?.ok ? await amzRes.json().catch(() => null) : null;
            const aliData = aliRes?.ok ? await aliRes.json().catch(() => null) : null;

            return {
              kwp: kwpData?.success && kwpData?.available ? (kwpData.results || []) : [],
              trends: trendsData?.success && trendsData?.available ? (trendsData.results || []) : [],
              amz: amzData?.success && amzData?.available ? (amzData.results || []) : [],
              ali: aliData?.success && aliData?.available ? (aliData.results || []) : [],
            };
          });

          const results = await Promise.all(fetchPromises);
          if (isCancelled) return;

          // Merge all child arrays into one mega dataset
          const megaKwp = results.flatMap(r => r.kwp);
          const megaTrends = results.flatMap(r => r.trends);
          const megaAmz = results.flatMap(r => r.amz);
          const megaAli = results.flatMap(r => r.ali);

          buildConsolidated(megaKwp, megaTrends, megaAmz, megaAli);
          setStatusMessage('Category Pipeline completed! View stage data below.');
        } catch (e) {
          console.error('Error aggregating category data', e);
        }
      };

      aggregateCategoryData();
      return () => { isCancelled = true; };
    } else if (searchingMode !== 'CATEGORY BASED') {
      // Manual / ATAI AUTO: use the single-run data that was loaded via stage polling
      buildConsolidated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineStatus, keywordPlannerResults, trendsResults, amazonResults, alibabaResults]);
  // ────────────────────────────────────────────────────────────────────────────

  // Handle stopping the current pipeline search
  const handleStopSearch = async () => {
    // 1. Signal any running frontend loop to stop
    cancelTokenRef.current = true;

    // 2. If it's the Category Based frontend loop, stop the loop and any running child executions
    if (executionArn && executionArn.startsWith('category_search:frontend_managed:')) {
      categoryExecutions.forEach(exec => {
        if (exec.status === 'RUNNING' && exec.execution_arn) {
          fetch(`/api/pipeline/stop?arn=${encodeURIComponent(exec.execution_arn)}`, { method: 'POST' }).catch(() => { });
        }
      });
      setPipelineStatus('FAILED');
      setStatusMessage('ABORTED');
      setIsLoading(false);
      return;
    }

    // 3. Normal / Auto single pipeline execution stop
    // If executionArn is not yet available (STARTING phase, trigger API not yet returned),
    // we still reset the UI state so the app doesn't get stuck.
    if (!executionArn) {
      setPipelineStatus('FAILED');
      setStatusMessage('ABORTED');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/pipeline/stop?arn=${encodeURIComponent(executionArn)}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Pipeline stopped successfully:', data);
      } else {
        // Log but do NOT bail out — still reset the UI below.
        console.error('Stop API returned an error status. UI will still be reset.');
      }
    } catch (error) {
      // Network errors etc. — still reset the UI so it never gets stuck.
      console.error('Error calling stop API:', error);
    }

    // Always reset UI state regardless of whether the API call succeeded.
    // The polling effect's cleanup will cancel the setInterval when pipelineStatus changes.
    if (pollingIntervalRef) {
      clearInterval(pollingIntervalRef);
      setPollingIntervalRef(null);
    }
    setPipelineStatus('FAILED');
    setStatusMessage('ABORTED');
    setIsLoading(false);
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

    const productsSearchMode = searchModeMap[searchingMode] || 'manual_search';

    return {
      // Basic filters
      keyword: effectiveKeyword,
      category: (searchingMode === 'CATEGORY BASED' && productCategory !== 'All categories') ? productCategory : undefined,
      search_volume_min: kwpMinSearches || undefined,
      search_volume_max: kwpMaxSearches || undefined,
      blacklist: blacklistedWords.length > 0 ? blacklistedWords : undefined,
      location: getCountryCode(location) || undefined,
      search_mode: productsSearchMode,
      // Google Trend Score filter (when greater than 0)
      ...(googleTrendScore > 0 && { google_trend_score: googleTrendScore }),

      // Source toggle indicators
      amazonFilters: amazonFilters,
      alibabaFilters: alibabaFilters,

      // Amazon filters (only when AMAZON FILTERS is ON and values are set)
      ...(amazonFilters && priceMin > 0 && { amz_price_min: priceMin }),
      ...(amazonFilters && priceMax > 0 && { amz_price_max: priceMax }),
      ...(amazonFilters && reviewsMin > 0 && { reviews_min: reviewsMin }),
      ...(amazonFilters && reviewsMax > 0 && { reviews_max: reviewsMax }),
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
    kwpMinSearches,
    kwpMaxSearches,
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
    cancelTokenRef.current = false;

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
      } else if (parseInt(variantLimitMax.trim(), 10) > 30) {
        setVariantLimitMaxError('Limit max to 30 to prevent Google Trends rate limiting');
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
    setConsolidatedResults([]); // Clear consolidated table from any previous run
    setError(null);
    setIsPreliminary(false);
    setPipelineStatus('IDLE');
    setExecutionArn(null);
    setStatusMessage('');
    setHasPerformedSearch(true);
    setSelectedCategoryVariant('ALL');
    setCategoryKeywordsPreview(null);
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
            blacklist: blacklistedWords.length > 0 ? blacklistedWords : undefined,
            fcl_percentage: fcl,
            search_volume_min: kwpMinSearches ? parseInt(kwpMinSearches) : undefined,
            search_volume_max: kwpMaxSearches ? parseInt(kwpMaxSearches) : undefined,
            google_trend_score: googleTrendScore > 0 ? googleTrendScore : undefined,
            amz_price_min: amazonFilters && priceMin > 0 ? priceMin : undefined,
            amz_price_max: amazonFilters && priceMax > 0 ? priceMax : undefined,
            reviews_min: amazonFilters && reviewsMin > 0 ? reviewsMin : undefined,
            reviews_max: amazonFilters && reviewsMax > 0 ? reviewsMax : undefined,
            rating_min: amazonFilters && ratingFilter > 0 ? ratingFilter : undefined,
            fcl_min: amazonFilters && fcl > 0 ? fcl : undefined,
            margin_min: alibabaFilters && costBelow > 0 ? costBelow : undefined,
            moq_max: alibabaFilters && moq ? parseInt(moq) : undefined,
            supplier_rating_min: alibabaFilters && alibabaRating > 0 ? alibabaRating : undefined,
            verified_supplier: alibabaFilters ? verifiedSupplier : undefined,
          }
        };

        if (searchingMode === 'CATEGORY BASED') {
          // Frontend-driven category search orchestration
          setStatusMessage('GENERATING KEYWORDS...');

          const kwResponse = await fetch('/api/pipeline/generate-keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: searchCategory,
              geo: searchLocation,
              limit: variantLimitMax ? parseInt(variantLimitMax) : 50,
              search_volume_min: kwpMinSearches ? parseInt(kwpMinSearches) : undefined,
              search_volume_max: kwpMaxSearches ? parseInt(kwpMaxSearches) : undefined
            })
          });

          if (!kwResponse.ok) {
            const errData = await kwResponse.json();
            throw new Error(errData.error || 'Failed to generate keywords');
          }

          const kwData = await kwResponse.json();
          const generatedKeywords: string[] = kwData.keywords || [];

          // Initialize UI with PENDING statuses
          const initialExecutions = generatedKeywords.map(kw => ({
            keyword: kw,
            run_id: '',
            execution_arn: '',
            status: 'PENDING'
          }));
          setCategoryExecutions(initialExecutions);
          setCategoryKeywordsPreview(generatedKeywords);
          setExecutionArn(`category_search:frontend_managed:${Date.now()}`); // Mock ARN to trigger polling loop later
          setPipelineStatus('POLLING'); // Start polling early so we can track statuses during batching
          setIsBatching(true);
          setStatusMessage('STARTING VARIANTS...');

          // Fire and forget the sequential triggering logic
          (async () => {
            const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
            let lastTriggerTime = 0;

            for (let i = 0; i < generatedKeywords.length; i++) {
              if (cancelTokenRef.current) break;

              const kw = generatedKeywords[i];

              // Batching Logic: Max 5 concurrent running variants
              // and at least 5s between triggers
              while (true) {
                if (cancelTokenRef.current) break;

                const activeCount = categoryExecutionsRef.current.filter(e =>
                  e.status === 'RUNNING' || e.status === 'STARTING'
                ).length;

                const now = Date.now();
                const timeSinceLast = now - lastTriggerTime;

                if (activeCount < 5 && timeSinceLast >= 5000) {
                  break;
                }

                if (activeCount >= 5) {
                  setStatusMessage(`BATCH FULL (5/5). Waiting for a variant to finish...`);
                } else if (timeSinceLast < 5000) {
                  const waitSec = Math.ceil((5000 - timeSinceLast) / 1000);
                  setStatusMessage(`WAITING ${waitSec}s BEFORE: ${kw}`);
                }
                await sleep(1000);
              }

              if (cancelTokenRef.current) break;

              if (cancelTokenRef.current) break;

              setCategoryExecutions(prev => {
                const next = [...prev];
                next[i] = { ...next[i], status: 'STARTING' };
                return next;
              });

              setStatusMessage(`TRIGGERING: ${kw}`);
              try {
                const triggerPayload = { ...payload, keyword: kw, search_mode: 'category_child' };
                const triggerRes = await fetch('/api/pipeline/trigger', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(triggerPayload)
                });

                const triggerData = await triggerRes.json();

                if (triggerRes.ok && triggerData.success) {
                  setCategoryExecutions(prev => {
                    const next = [...prev];
                    next[i] = {
                      ...next[i],
                      status: 'RUNNING',
                      execution_arn: triggerData.executionArn,
                      run_id: triggerData.executionArn.split(':').pop() || '',
                    };
                    return next;
                  });
                } else {
                  setCategoryExecutions(prev => {
                    const next = [...prev];
                    next[i] = { ...next[i], status: 'FAILED' };
                    return next;
                  });
                }
              } catch (e) {
                console.error(`Failed to trigger category child for ${kw}:`, e);
                setCategoryExecutions(prev => {
                  const next = [...prev];
                  next[i] = { ...next[i], status: 'FAILED' };
                  return next;
                });
              }
              lastTriggerTime = Date.now();
            }
            // Only transition to final state if the user has not cancelled in the meantime.
            if (!cancelTokenRef.current) {
              setIsBatching(false);
              setStatusMessage('RUNNING');
            }
          })();

        } else {
          // Normal manual/auto search
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

          if (!triggerData.success) {
            throw new Error(triggerData.message || 'No data found for this search');
          }

          setCategoryExecutions([]);
          setCategoryKeywordsPreview(null);
          setExecutionArn(triggerData.executionArn);
          setPipelineStatus('POLLING');
          setStatusMessage('RUNNING');

        } // end generic else
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
    kwpMinSearches,
    kwpMaxSearches,
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
        if (searchingMode === 'CATEGORY BASED' && (!selectedCategoryVariant || selectedCategoryVariant === 'ALL')) {
          setProducts([]);
          return;
        }

        let effectiveKeyword = lastSearchContext.keyword;
        if (searchingMode === 'CATEGORY BASED') {
          effectiveKeyword = selectedCategoryVariant;
        }

        const productsSearchMode = lastSearchContext.search_mode;
        const params: Record<string, any> = {
          keyword: effectiveKeyword,
          category: lastSearchContext.category,
          location: lastSearchContext.location,
          search_mode: productsSearchMode,
          search_volume_min: kwpMinSearches || undefined,
          search_volume_max: kwpMaxSearches || undefined,
          blacklist: blacklistedWords.length > 0 ? blacklistedWords : undefined,
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
    kwpMinSearches,
    kwpMaxSearches,
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
    searchingMode,
    selectedCategoryVariant,
  ]);



  // When user changes the category variant dropdown, clear stage data so we refetch for the selected keyword
  const handleCategoryVariantChange = useCallback((newValue: string) => {
    setSelectedCategoryVariant(newValue);
    setProducts([]);
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

  // In category mode, when pipeline is completed (or polling), fetch that keyword's stage data
  useEffect(() => {
    if (searchingMode !== 'CATEGORY BASED' || (pipelineStatus !== 'COMPLETED' && pipelineStatus !== 'POLLING')) return;

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
          if (!cancelled) {
            if (kwpData.success && kwpData.available && kwpData.results?.length > 0) {
              setKeywordPlannerResults(kwpData.results);
            }
            if (kwpData.meta !== undefined) {
              setKeywordPlannerMeta(kwpData.meta || null);
            }
            setHasLoadedKeywordPlanner(true);
          }
        }
        if (trendsRes?.ok) {
          const trendsData = await trendsRes.json();
          if (!cancelled) {
            if (trendsData.success && trendsData.available && trendsData.results?.length > 0) {
              setTrendsResults(trendsData.results);
            }
            if (trendsData.meta !== undefined) {
              setTrendsMeta(trendsData.meta || null);
            }
            setHasLoadedTrends(true);
          }
        }
        if (amzRes?.ok) {
          const amzData = await amzRes.json();
          if (!cancelled) {
            if (amzData.success && amzData.available && amzData.results?.length > 0) {
              setAmazonResults(amzData.results);
            }
            if (amzData.meta !== undefined) {
              setAmazonMeta(amzData.meta || null);
            }
            setHasLoadedAmazon(true);
          }
        }
        if (aliRes?.ok) {
          const aliData = await aliRes.json();
          if (!cancelled) {
            if (aliData.success && aliData.available && aliData.results?.length > 0) {
              setAlibabaResults(aliData.results);
            }
            if (aliData.meta !== undefined) {
              setAlibabaMeta(aliData.meta || null);
            }
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
                // Ignore ones that haven't been assigned an ARN yet or are already finished
                if (exec.status === 'PENDING' || exec.status === 'STARTING' || !exec.execution_arn) return exec;
                if (exec.status === 'SUCCEEDED' || exec.status === 'FAILED' || exec.status === 'ABORTED' || exec.status === 'TIMED_OUT') return exec;

                try {
                  const res = await fetch(`/api/pipeline/status?arn=${exec.execution_arn}`);
                  const data = await res.json();
                  return { ...exec, status: data.status || exec.status };
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

            // Fetch Keyword Planner stage results — keep retrying each poll until the KWPClean Lambda writes its parquet to S3
            if (!hasLoadedKeywordPlanner) {
              try {
                const kwpRes = await fetch(`/api/pipeline/keyword-planner?arn=${encodeURIComponent(arnToUse)}`);
                if (kwpRes.ok) {
                  const kwpData = await kwpRes.json();
                  if (kwpData.success && kwpData.available && kwpData.results && kwpData.results.length > 0) {
                    setKeywordPlannerResults(kwpData.results);
                    if (kwpData.meta !== undefined) setKeywordPlannerMeta(kwpData.meta || null);
                    setHasLoadedKeywordPlanner(true); // only lock once we actually have rows
                  }
                }
              } catch (e) {
                console.log("Error fetching Keyword Planner stage results", e);
              }
            }

            // Fetch Google Trends stage results — keep retrying until GoogleTrendsClean writes its parquet
            if (!hasLoadedTrends) {
              try {
                const trendsRes = await fetch(`/api/pipeline/google-trends?arn=${encodeURIComponent(arnToUse)}`);
                if (trendsRes.ok) {
                  const trendsData = await trendsRes.json();
                  if (trendsData.success && trendsData.available && trendsData.results && trendsData.results.length > 0) {
                    setTrendsResults(trendsData.results);
                    if (trendsData.meta !== undefined) setTrendsMeta(trendsData.meta || null);
                    setHasLoadedTrends(true); // only lock once we actually have rows
                  }
                }
              } catch (e) {
                console.log("Error fetching Google Trends stage results", e);
              }
            }

            // Fetch Amazon stage results — keep retrying until AmazonClean writes its parquet
            if (amazonFilters && !hasLoadedAmazon) {
              try {
                const amzRes = await fetch(`/api/pipeline/amazon?arn=${encodeURIComponent(arnToUse)}`);
                if (amzRes.ok) {
                  const amzData = await amzRes.json();
                  if (amzData.success && amzData.available && amzData.results && amzData.results.length > 0) {
                    setAmazonResults(amzData.results);
                    if (amzData.meta !== undefined) setAmazonMeta(amzData.meta || null);
                    setHasLoadedAmazon(true); // only lock once we actually have rows
                  }
                }
              } catch (e) {
                console.log("Error fetching Amazon marketplace stage results", e);
              }
            }

            // Fetch Alibaba stage results — keep retrying until AlibabaClean writes its parquet
            if (alibabaFilters && !hasLoadedAlibaba) {
              try {
                const aliRes = await fetch(`/api/pipeline/alibaba?arn=${encodeURIComponent(arnToUse)}`);
                if (aliRes.ok) {
                  const aliData = await aliRes.json();
                  if (aliData.success && aliData.available && aliData.results && aliData.results.length > 0) {
                    setAlibabaResults(aliData.results);
                    if (aliData.meta !== undefined) setAlibabaMeta(aliData.meta || null);
                    setHasLoadedAlibaba(true); // only lock once we actually have rows
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

            // Preliminary consolidated fetch disabled — stage tables (KWP, Trends, Amazon, Alibaba)
            // appear progressively as each Lambda clean step completes (see fetchMarketplaceStages above).
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
    <div className="min-h-screen bg-[#1a2318] text-white p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-[0.25em] text-white drop-shadow-lg">TREND RADAR</h1>
        <div className="mt-2 h-0.5 w-24 bg-[#F3940B] mx-auto rounded-full opacity-80"></div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Top Row: Searching Filters, Location, Active Search */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-center">
          {/* Left: Searching Filters */}
          <div>
            <div className="border border-white/40 bg-white/5 px-4 py-3 rounded-lg backdrop-blur-sm">
              <input
                type="text"
                value={searchingFilters}
                onChange={(e) => setSearchingFilters(e.target.value)}
                placeholder="SEARCHING FILTERS:"
                className="w-full h-10 text-white text-base bg-transparent border-none outline-none placeholder-gray-400 font-semibold tracking-widest"
              />
            </div>
          </div>

          {/* Center: Location */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-4">
              <label className="text-xs font-bold tracking-widest text-gray-300 uppercase flex items-center">
                LOCATION: <span className="text-[#F3940B] ml-0.5">*</span>
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
                className={`px-4 py-2 text-white bg-[#2a3828] border rounded-lg focus:outline-none focus:border-[#F3940B] transition-colors ${locationError ? 'border-red-500' : 'border-white/40'
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
        <div className="bg-[#243022] border border-white/10 rounded-xl p-6 mb-6 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Searching Mode + Search Fields in 2x2 grid */}
            <div className="lg:col-span-2 space-y-5">
              {/* Searching Mode - All in one line */}
              <div className="flex items-center gap-5 flex-wrap">
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">SEARCHING MODE:</span>
                {['MANUAL', 'CATEGORY BASED', 'ATAI AUTO'].map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="searchingMode"
                      value={mode}
                      checked={searchingMode === mode}
                      onChange={(e) => setSearchingMode(e.target.value)}
                      className="sr-only"
                      style={{ accentColor: '#F3940B' }}
                    />
                    <span className={`px-3 py-1 text-xs font-bold tracking-wider rounded-full border transition-all ${searchingMode === mode
                        ? 'bg-[#F3940B] border-[#F3940B] text-black shadow-lg shadow-orange-900/40'
                        : 'border-white/30 text-gray-300 hover:border-white/60 hover:text-white'
                      }`}>{mode}</span>
                  </label>
                ))}
              </div>

              {/* Search Fields in 2x2 grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {searchingMode === 'MANUAL' ? (
                  <div>
                    <label className="block text-xs font-bold tracking-widest text-gray-400 uppercase mb-2 flex items-center">
                      KEYWORD SEARCH <span className="text-[#F3940B] ml-0.5">*</span>
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
                      className={`w-full px-4 py-2.5 text-black bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F3940B]/40 ${keywordSearchError ? 'border-red-500' : 'border-gray-300'
                        } ${fieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {keywordSearchError && (
                      <p className="text-red-400 text-xs mt-1">{keywordSearchError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">PRODUCT CATEGORY <span className="text-[#F3940B]">*</span></label>
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="w-full px-4 py-2.5 text-black bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F3940B]/40"
                    >
                      {GT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Trend Period - only show when Active Search is ON */}
                {activeSearch && (
                  <div className="flex flex-col items-start gap-2 relative">
                    <div className="flex items-center gap-4 flex-col">
                      <span className="text-xs font-bold tracking-widest text-gray-400 uppercase flex items-center">
                        TREND PERIOD <span className="text-[#F3940B] ml-0.5">*</span>
                        {pipelineFieldsDisabled && <InfoButton message="Please reset in order to apply filters for new search" />}
                      </span>
                      <div className="relative trend-dropdown">
                        <button
                          onClick={() => !pipelineFieldsDisabled && setShowTrendDropdown(!showTrendDropdown)}
                          disabled={pipelineFieldsDisabled}
                          className={`px-4 py-2.5 text-black bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F3940B]/40 min-w-[150px] flex items-center justify-between ${trendPeriodError ? 'border-red-500' : 'border-gray-300'
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
                      <label className="block text-xs font-bold tracking-widest text-gray-400 uppercase mb-2 flex items-center">
                        VARIANT LIMIT MAX <span className="text-[#F3940B] ml-0.5">*</span>
                        {pipelineFieldsDisabled && <InfoButton message="Please reset in order to apply filters for new search" />}
                      </label>
                      <input
                        type="text"
                        value={variantLimitMax}
                        disabled={pipelineFieldsDisabled}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariantLimitMax(val);
                          const parsed = parseInt(val.trim(), 10);
                          if (parsed > 30) {
                            setVariantLimitMaxError('Limit max to 30 to prevent Google Trends rate limiting');
                          } else if (variantLimitMaxError) {
                            setVariantLimitMaxError('');
                          }
                        }}
                        className={`w-full px-4 py-2.5 text-black bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F3940B]/40 ${variantLimitMaxError ? 'border-red-500' : 'border-gray-300'
                          } ${pipelineFieldsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      {variantLimitMaxError && (
                        <p className="text-red-400 text-xs mt-1">{variantLimitMaxError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold tracking-widest text-gray-400 uppercase mb-2 flex items-center">
                        RESULTS CAP MAX <span className="text-[#F3940B] ml-0.5">*</span>
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
                        className={`w-full px-4 py-2.5 text-black bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F3940B]/40 ${resultsCapError ? 'border-red-500' : 'border-gray-300'
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
              <label className="block text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">BLACKLISTED WORDS</label>
              <div
                className="flex flex-col w-full h-32 bg-[#FFFFFF] border border-gray-600 focus-within:border-blue-500 overflow-hidden cursor-text"
                onClick={() => document.getElementById('blacklist-input')?.focus()}
              >
                <div className="flex flex-wrap gap-2 p-2 overflow-y-auto w-full h-full content-start">
                  {blacklistedWords.map((word, index) => (
                    <div key={index} className="flex items-center gap-1 bg-gray-200 text-black px-2 py-1 rounded-md text-sm border border-gray-300 shadow-sm leading-none shrink-0">
                      <span className="max-w-[150px] truncate" title={word}>{word}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBlacklistedWords(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="text-gray-500 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center font-bold text-lg leading-none shrink-0 pb-1"
                        title="Remove word"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <input
                    id="blacklist-input"
                    type="text"
                    value={blacklistInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',')) {
                        const newWords = val.split(',').map(w => w.trim()).filter(w => w.length > 0);
                        if (newWords.length > 0) {
                          setBlacklistedWords(prev => Array.from(new Set([...prev, ...newWords])));
                        }
                        setBlacklistInput('');
                      } else {
                        setBlacklistInput(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = blacklistInput.trim();
                        if (val) {
                          setBlacklistedWords(prev => prev.includes(val) ? prev : [...prev, val]);
                          setBlacklistInput('');
                        }
                      } else if (e.key === 'Backspace' && blacklistInput === '' && blacklistedWords.length > 0) {
                        // Remove the last chip if backspace is pressed on empty input
                        setBlacklistedWords(prev => prev.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      // Automatically convert any leftover text into a chip when clicking away
                      const val = blacklistInput.trim();
                      if (val) {
                        setBlacklistedWords(prev => prev.includes(val) ? prev : [...prev, val]);
                        setBlacklistInput('');
                      }
                    }}
                    placeholder={blacklistedWords.length === 0 ? "Type and press Enter or comma..." : ""}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-black text-sm h-7"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fourth Row: Google Trend Score, KWP Monthly Searches */}
        <div className="bg-[#243022] border border-white/10 rounded-xl px-6 py-5 mb-6 shadow-lg">
          <div className="flex flex-wrap items-center gap-8 lg:gap-14">
            {/* Google Trend Score */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">GOOGLE TREND SCORE</span>
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
              <label className="block text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">KWP MONTHLY SEARCHES</label>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-start gap-1 flex-1">
                  <span className="text-xs text-gray-300">MIN</span>
                  <input
                    type="number"
                    min="0"
                    value={kwpMinSearches}
                    onChange={(e) => setKwpMinSearches(e.target.value)}
                    placeholder="e.g. 1000"

                    className="w-full px-3 py-2 text-black bg-[#FFFFFF] border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-gray-300 mt-5">–</span>
                <div className="flex flex-col items-start gap-1 flex-1">
                  <span className="text-xs text-gray-300">MAX</span>
                  <input
                    type="number"
                    min="0"
                    value={kwpMaxSearches}
                    onChange={(e) => setKwpMaxSearches(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 text-black bg-[#FFFFFF] border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>


            {/* Trend Period */}

          </div>
        </div>

        {/* Amazon Filters */}
        <div className="mb-5 bg-[#243022] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <div className="flex items-center gap-5 px-6 py-4 border-l-4 border-[#F3940B]">
            <h3 className="text-[#F3940B] font-bold tracking-wider text-sm">AMAZON FILTERS</h3>
            {/* Toggle switch */}
            <button
              onClick={() => setAmazonFilters(!amazonFilters)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none shadow-inner ${amazonFilters ? 'bg-[#F3940B]' : 'bg-gray-600'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${amazonFilters ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
            <span className="text-xs font-bold tracking-widest text-gray-400">{amazonFilters ? 'ON' : 'OFF'}</span>
          </div>

          <div className={`px-6 pt-2 pb-5 flex flex-wrap items-center gap-6 lg:gap-10 ${!amazonFilters ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!amazonFilters ? 'text-gray-500' : 'text-gray-300'}`}>PRICE FILTER</span>
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

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!amazonFilters ? 'text-gray-500' : 'text-gray-300'}`}>REVIEWS</span>
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

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!amazonFilters ? 'text-gray-500' : 'text-gray-300'}`}>RATING FILTER ▼</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    title={star === ratingFilter ? 'Click to clear' : `${star}★ and above`}
                    className={`text-lg ${!amazonFilters
                      ? 'cursor-not-allowed text-gray-400'
                      : `cursor-pointer ${star <= ratingFilter ? 'text-yellow-400' : 'text-gray-500'}`
                      }`}
                    onClick={amazonFilters ? () => setRatingFilter(star === ratingFilter ? 0 : star) : undefined}
                  >
                    ★
                  </span>
                ))}
              </div>
              {amazonFilters && ratingFilter > 0 && (
                <button
                  onClick={() => setRatingFilter(0)}
                  className="text-xs text-gray-300 hover:text-white underline ml-1"
                  title="Clear rating filter"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!amazonFilters ? 'text-gray-500' : 'text-gray-300'}`}>FCL</span>
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
        <div className="mb-8 bg-[#243022] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <div className="flex items-center gap-5 px-6 py-4 border-l-4 border-blue-500">
            <h3 className="text-blue-400 font-bold tracking-wider text-sm">ALIBABA SUPPLIER FILTERS</h3>
            {/* Toggle switch */}
            <button
              onClick={() => setAlibabaFilters(!alibabaFilters)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none shadow-inner ${alibabaFilters ? 'bg-blue-500' : 'bg-gray-600'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${alibabaFilters ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
            <span className="text-xs font-bold tracking-widest text-gray-400">{alibabaFilters ? 'ON' : 'OFF'}</span>
          </div>
          <div className={`px-6 pt-2 pb-5 flex flex-wrap items-center gap-6 lg:gap-10 ${!alibabaFilters ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!alibabaFilters ? 'text-gray-500' : 'text-gray-300'}`}>COST BELOW %</span>
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

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!alibabaFilters ? 'text-gray-500' : 'text-gray-300'}`}>MOQ</span>
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

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold tracking-widest uppercase ${!alibabaFilters ? 'text-gray-500' : 'text-gray-300'}`}>RATING FILTER ▼</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    title={star === alibabaRating ? 'Click to clear' : `${star}★ and above`}
                    className={`text-lg ${!alibabaFilters
                      ? 'cursor-not-allowed text-gray-400'
                      : `cursor-pointer ${star <= alibabaRating ? 'text-yellow-400' : 'text-gray-500'}`
                      }`}
                    onClick={alibabaFilters ? () => setAlibabaRating(star === alibabaRating ? 0 : star) : undefined}
                  >
                    ★
                  </span>
                ))}
              </div>
              {alibabaFilters && alibabaRating > 0 && (
                <button
                  onClick={() => setAlibabaRating(0)}
                  className="text-xs text-gray-300 hover:text-white underline ml-1"
                  title="Clear rating filter"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg ${!alibabaFilters ? 'bg-gray-700/30' : 'bg-white/10'}`}>
              <span className={`text-xs font-bold tracking-widest uppercase ${!alibabaFilters ? 'text-gray-500' : 'text-gray-300'}`}>Verified Supplier:</span>
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

        {/* ── Preset System + Bottom Action Bar ─────────────────────────── */}
        {(() => {
          const isActiveRun = isLoading || pipelineStatus === 'STARTING' || pipelineStatus === 'POLLING' || isBatching;
          return (
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-4">

              {/* Preset dropdown button */}
              <div className="relative" ref={dropdownRef}>
                <button
                  disabled={isActiveRun}
                  onClick={() => setPresetDropdownOpen(o => !o)}
                  className={`flex items-center gap-2 px-4 py-2.5 bg-[#243022] border border-white/20 text-white text-sm font-semibold rounded-lg transition-colors ${isActiveRun ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/50'}`}
                >
                  {presetSaveFlash
                    ? <span className="text-green-400">✓ SAVED</span>
                    : selectedPresetId !== null && presets.find(p => p.id === selectedPresetId)
                      ? presets.find(p => p.id === selectedPresetId)!.name
                      : 'PRESETS'}
                  <svg className={`w-3 h-3 transition-transform ${presetDropdownOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {presetDropdownOpen && !isActiveRun && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-[#1a2318] border border-white/20 rounded-xl shadow-2xl min-w-[260px] overflow-hidden">
                    {/* Preset list */}
                    {presets.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400 text-center">No presets saved yet.</div>
                    ) : (
                      <div className="flex flex-col">
                        {presets.map((p) => (
                          <div key={p.id} className={`flex items-center gap-1 px-3 py-2 border-b border-white/5 hover:bg-white/5 ${selectedPresetId === p.id ? 'bg-white/10' : ''}`}>
                            {/* Name / rename input */}
                            {editingPresetId === p.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={presetNameInput}
                                onChange={(e) => setPresetNameInput(e.target.value)}
                                onBlur={() => handleRenamePreset(p.id, presetNameInput)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenamePreset(p.id, presetNameInput);
                                  if (e.key === 'Escape') setEditingPresetId(null);
                                }}
                                className="flex-1 px-2 py-0.5 text-black bg-white text-sm rounded focus:outline-none"
                              />
                            ) : (
                              <button
                                onClick={() => setSelectedPresetId(p.id)}
                                className="flex-1 text-left text-sm text-white truncate"
                              >
                                {p.name}
                              </button>
                            )}
                            {/* Icon buttons */}
                            <button
                              title="Load"
                              onClick={() => { setSelectedPresetId(p.id); handleLoadPreset(p.id); setPresetDropdownOpen(false); }}
                              className="shrink-0 px-2 py-0.5 text-xs text-[#C0FE72] border border-[#C0FE72]/40 rounded hover:bg-[#C0FE72]/10 transition-colors"
                            >⬆ LOAD</button>
                            <button
                              title="Rename"
                              onClick={() => { setPresetNameInput(p.name); setEditingPresetId(p.id); }}
                              className="shrink-0 px-2 py-0.5 text-xs text-gray-300 border border-white/20 rounded hover:bg-white/10 transition-colors"
                            >✎</button>
                            <button
                              title="Delete"
                              onClick={() => handleDeletePreset(p.id)}
                              className="shrink-0 px-2 py-0.5 text-xs text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
                            >🗑</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Save new preset */}
                    <div className="px-3 py-2 border-t border-white/10 mt-1 pt-3">
                      {isCreatingNewPreset ? (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs text-gray-400 font-bold ml-1">New Preset Name</label>
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              className="flex-1 px-3 py-1.5 text-black bg-white/90 font-semibold text-sm rounded focus:outline-none focus:ring-2 focus:ring-[#C0FE72]"
                              value={newPresetNameInput}
                              onChange={(e) => setNewPresetNameInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveNewPreset(newPresetNameInput);
                                  setIsCreatingNewPreset(false);
                                  setPresetDropdownOpen(false);
                                }
                                if (e.key === 'Escape') setIsCreatingNewPreset(false);
                              }}
                            />
                            <button
                              onClick={() => {
                                handleSaveNewPreset(newPresetNameInput);
                                setIsCreatingNewPreset(false);
                                setPresetDropdownOpen(false);
                              }}
                              className="shrink-0 px-3 py-1.5 text-xs font-bold bg-[#C0FE72] text-[#1a2318] rounded hover:bg-[#d4ff8a]"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setIsCreatingNewPreset(false)}
                              className="shrink-0 px-2 py-1.5 text-xs font-bold bg-white/10 text-white rounded hover:bg-white/20"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            let nextNum = 1;
                            const existing = new Set(presets.map(p => p.name));
                            while (existing.has(`Preset ${nextNum}`)) nextNum++;
                            setNewPresetNameInput(`Preset ${nextNum}`);
                            setIsCreatingNewPreset(true);
                          }}
                          className="w-full py-2 text-xs font-bold tracking-widest text-[#1a2318] bg-[#C0FE72] rounded-lg hover:bg-[#d4ff8a] transition-colors"
                        >
                          💾 SAVE NEW PRESET
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleReset}
                disabled={isActiveRun}
                className={`px-6 py-2.5 bg-transparent font-semibold tracking-wider border border-white/50 rounded-lg transition-colors text-sm ${isActiveRun ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-white hover:bg-white/10'}`}
              >
                ↺ RESET
              </button>

              <button
                onClick={handleExportCsv}
                disabled={isActiveRun || pipelineStatus !== 'COMPLETED'}
                className={`px-7 py-2.5 rounded-lg font-bold tracking-wide transition-all text-sm ${!isActiveRun && pipelineStatus === 'COMPLETED'
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40'
                    : 'bg-gray-700/60 text-gray-400 cursor-not-allowed border border-white/10'
                  }`}
              >
                ⬇ EXPORT CSV
              </button>

              <button
                onClick={handleSearch}
                disabled={isActiveRun || !!variantLimitMaxError}
                className={`px-10 py-2.5 font-bold tracking-wider rounded-lg transition-all text-sm ${isActiveRun || variantLimitMaxError
                    ? 'bg-gray-700/60 text-gray-400 cursor-not-allowed border border-white/10'
                    : 'bg-[#F3940B] text-black hover:bg-[#e8860a] shadow-lg shadow-orange-900/40'
                  }`}
              >
                {isActiveRun ? '⟳ SEARCHING...' : '⬛ SEARCH'}
              </button>

              <button
                onClick={handleStopSearch}
                disabled={!isActiveRun}
                className={`px-7 py-2.5 font-bold tracking-wide rounded-lg transition-all text-sm ${isActiveRun
                    ? 'bg-red-700 text-white hover:bg-red-600 shadow-lg shadow-red-900/40'
                    : 'bg-gray-700/60 text-gray-400 opacity-50 cursor-not-allowed border border-white/10'
                  }`}
              >
                ✕ STOP CURRENT SEARCH
              </button>
            </div>
          );
        })()}

        {/* Products Results Table */}
        {(products.length > 0 || error || isLoading || pipelineStatus !== 'IDLE' || hasPerformedSearch) && (
          <div className="mt-8">
            {/* Preliminary results banner - shown while pipeline is still running and we have partial data */}
            {isPreliminary && pipelineStatus === 'POLLING' && products.length > 0 && (
              <div className="mb-4 px-4 py-3 bg-yellow-500/20 border border-yellow-400/50 rounded flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
                <p className="text-yellow-300 text-sm font-semibold tracking-wide">
                  PRELIMINARY / PROCESSING — Pipeline still running. These are partial results from the previous consolidated dataset and will update automatically once the pipeline completes.
                </p>
              </div>
            )}

            {/* ── CONSOLIDATED RESULTS TABLE – shown as soon as pipeline starts delivering data ── */}
            {(pipelineStatus === 'COMPLETED' || pipelineStatus === 'POLLING') && consolidatedResults.length > 0 && (
              <div className="mt-6 mb-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-[#C0FE72]/30 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#C0FE72] tracking-wider">CONSOLIDATED RESULTS</h2>
                    <p className="text-xs text-gray-400 mt-1">Merged from all pipeline stages · Scored &amp; ranked in-browser</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-400/40 rounded text-green-300 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      SUCCEEDED
                    </span>
                    <span className="text-sm text-gray-300">
                      {consolidatedResults.length} rows
                    </span>
                  </div>
                </div>

                {/* Score legend */}
                <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-400">
                  <span><strong className="text-[#C0FE72]">Demand</strong> 35% · Avg monthly searches (KWP)</span>
                  <span><strong className="text-[#C0FE72]">Trend</strong> 30% · Google Trends peak interest</span>
                  <span><strong className="text-[#C0FE72]">Competition</strong> 15% · Inverse of Amazon review count</span>
                  <span><strong className="text-[#C0FE72]">Supplier</strong> 10% · Alibaba rating + low MOQ</span>
                  <span><strong className="text-[#C0FE72]">Price</strong> 10% · Amazon price relative to others</span>
                </div>



                {/* Scrollable container referencing the mainTableScrollRef */}
                <div
                  className="overflow-x-auto overflow-y-auto max-h-[80vh] border border-white/20 rounded custom-scrollbar relative"
                  ref={mainTableScrollRef}
                  onScroll={handleMainTableScroll}
                >
                  <table className="w-full border-separate border-spacing-0 bg-[#2a3627] text-sm">
                    <thead className="sticky top-0 z-20 drop-shadow-2xl">
                      {/* Source group headers */}
                      <tr className="bg-[#1a2418] text-[#C0FE72] text-[10px] uppercase tracking-widest relative">
                        <th className="px-3 py-1 text-center border-r border-white/10">#</th>
                        <th colSpan={4} className="px-3 py-1 text-center border-r border-white/10">📋 Keyword Planner</th>
                        <th colSpan={4} className="px-3 py-1 text-center border-r border-white/10">📈 Google Trends</th>
                        <th colSpan={5} className="px-3 py-1 text-center border-r border-white/10">🛒 Amazon</th>
                        <th colSpan={4} className="px-3 py-1 text-center border-r border-white/10">🏭 Alibaba</th>
                        <th colSpan={6} className="px-3 py-1 text-center">🏆 Scores</th>
                      </tr>
                      {/* Column names */}
                      <tr className="bg-[#C0FE72] text-black">
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase border-r border-black/20">Rank</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Keyword</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Avg Monthly Searches</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">CPC (USD)</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase border-r border-black/20">KWP Trend</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">GT Peak</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">GT Avg</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">GT Direction</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase border-r border-black/20">GT Change %</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Product Title</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Price (USD)</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Reviews</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Rating</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase border-r border-black/20">BSR</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Supplier Product</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">MOQ</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Sup. Rating</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase border-r border-black/20">Country</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Demand</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Trend</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Compet.</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Supplier</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Price</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap text-xs uppercase">Final Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidatedResults.map((row, idx) => {
                        const scoreColor = (s: number) =>
                          s >= 70 ? 'text-green-400' : s >= 40 ? 'text-yellow-300' : 'text-red-400';
                        const fmtNum = (v: any, prefix = '', suffix = '', decimals = 0) =>
                          v !== null && v !== undefined && v !== '-' && Number(v) !== 0
                            ? `${prefix}${Number(v).toFixed(decimals)}${suffix}` : '-';
                        const str = (v: any) => (v && v !== '-' ? String(v) : '-');
                        const isSelected = selectedRowIndex === idx;
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedRowIndex(isSelected ? null : idx)}
                            className={`transition-colors cursor-pointer relative ${isSelected
                                ? 'bg-[#C0FE72]/20 outline outline-2 outline-[#C0FE72] z-10'
                                : `border-b border-white/5 hover:bg-white/5 ${idx % 2 !== 0 ? 'bg-black/10' : ''}`
                              }`}
                          >
                            {/* Rank */}
                            <td className="px-3 py-2 font-bold text-[#C0FE72] whitespace-nowrap border-r border-white/10">{row.rank}</td>
                            {/* KWP */}
                            <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{toTitleCase(row.keyword)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{row.avg_monthly_searches ? Number(row.avg_monthly_searches).toLocaleString() : '-'}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{fmtNum(row.cpc_usd, '$', '', 2)}</td>
                            <td className="px-3 py-2 text-gray-300 whitespace-nowrap capitalize border-r border-white/10">{str(row.kwp_trend_direction)}</td>
                            {/* Google Trends */}
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{fmtNum(row.trend_peak)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{fmtNum(row.trend_avg, '', '', 1)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap capitalize">{str(row.gt_interest_trend)}</td>
                            <td className="px-3 py-2 whitespace-nowrap border-r border-white/10">
                              {row.gt_interest_change_pct !== null && row.gt_interest_change_pct !== undefined
                                ? <span className={Number(row.gt_interest_change_pct) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {Number(row.gt_interest_change_pct) >= 0 ? '+' : ''}{Number(row.gt_interest_change_pct).toFixed(1)}%
                                </span>
                                : '-'}
                            </td>
                            {/* Amazon */}
                            <td className="px-3 py-2 text-gray-200 max-w-[220px] truncate" title={row.amazon_title}>
                              {row.asin && row.asin !== '-' ? (
                                <a
                                  href={`https://www.amazon.com/dp/${row.asin}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-blue-400 hover:underline transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {str(row.amazon_title)}
                                </a>
                              ) : (
                                str(row.amazon_title)
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{fmtNum(row.amazon_price_usd, '$', '', 2)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{row.reviews_count ? Number(row.reviews_count).toLocaleString() : '-'}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{fmtNum(row.rating, '', '★', 1)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap border-r border-white/10">{str(row.bestseller_rank)}</td>
                            {/* Alibaba */}
                            <td className="px-3 py-2 text-gray-200 max-w-[180px] truncate" title={row.alibaba_title}>{str(row.alibaba_title)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{row.moq ? Number(row.moq).toLocaleString() : '-'}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap">{fmtNum(row.supplier_rating, '', '★', 1)}</td>
                            <td className="px-3 py-2 text-gray-100 whitespace-nowrap border-r border-white/10">{str(row.supplier_country)}</td>
                            {/* Scores */}
                            <td className={`px-3 py-2 font-bold text-center whitespace-nowrap ${scoreColor(row.demand_score)}`}>{row.demand_score}</td>
                            <td className={`px-3 py-2 font-bold text-center whitespace-nowrap ${scoreColor(row.trend_score)}`}>{row.trend_score}</td>
                            <td className={`px-3 py-2 font-bold text-center whitespace-nowrap ${scoreColor(row.competition_score)}`}>{row.competition_score}</td>
                            <td className={`px-3 py-2 font-bold text-center whitespace-nowrap ${scoreColor(row.supplier_score)}`}>{row.supplier_score}</td>
                            <td className={`px-3 py-2 font-bold text-center whitespace-nowrap ${scoreColor(row.price_score)}`}>{row.price_score}</td>
                            {/* Final score with progress bar */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${row.final_score >= 70 ? 'bg-green-400' : row.final_score >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                    style={{ width: `${row.final_score}%` }}
                                  />
                                </div>
                                <span className={`font-bold text-sm ${scoreColor(row.final_score)}`}>{row.final_score}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sticky Horizontal Scrollbar overlay */}
                <div
                  ref={stickyScrollContainerRef}
                  onScroll={handleStickyScroll}
                  className="sticky bottom-0 z-50 overflow-x-auto w-full transition-opacity duration-200 custom-scrollbar mt-1 bg-[#1a2418]/90 backdrop-blur border-t border-[#C0FE72]/30"
                  style={{
                    opacity: showStickyScroll ? 1 : 0,
                    pointerEvents: showStickyScroll ? 'auto' : 'none',
                    paddingBottom: '2px', // space for grabbing
                    paddingTop: '3px'
                  }}
                >
                  <div ref={stickyScrollContentRef} style={{ height: '1px' }} />
                </div>

              </div>
            )}

            {/* ── NO DATA PASSED FILTERS – empty state after pipeline completes ── */}
            {pipelineStatus === 'COMPLETED' && consolidatedResults.length === 0 && hasLoadedKeywordPlanner && (
              <div className="mt-6 mb-10 p-6 bg-[#2a3627] rounded border border-orange-400/40 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-lg font-bold text-orange-300 mb-2">No data passed the current filters</p>
                <p className="text-sm text-gray-400 max-w-lg mx-auto">
                  The pipeline completed but no keywords survived the Keyword Planner stage — likely because your search volume minimum, Google Trends score, or other filters are too strict.
                </p>
                <p className="text-sm text-gray-400 mt-3">
                  Try <strong className="text-white">relaxing your filters</strong> (lower the search volume min, reduce Google Trend score threshold, or disable Amazon / Alibaba filters) and run the search again.
                </p>
              </div>
            )}

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
                {/* Category mode: selected variant produced no surviving stage data (all variants filtered out).
                        Only show after Keyword Planner + Trends stages have both completed and returned no rows. */}
                {searchingMode === 'CATEGORY BASED' &&
                  categoryExecutions.length > 0 &&
                  selectedCategoryVariant !== 'ALL' &&
                  pipelineStatus === 'COMPLETED' &&
                  hasLoadedKeywordPlanner &&
                  hasLoadedTrends &&
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



            {/* Legacy S3-ranked table (disabled) kept only as reference */}

            {/* Legacy S3-ranked table kept for IDLE mode (Active Search OFF results) */}
            {
              searchingMode !== 'CATEGORY BASED' && products.length > 0 && pipelineStatus === 'COMPLETED' && false && (
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
              )
            }

            {
              searchingMode !== 'CATEGORY BASED' && products.length > 0 && pipelineStatus === 'POLLING' && isPreliminary && (
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
              )
            }

            {
              searchingMode !== 'CATEGORY BASED' && products.length > 0 && pipelineStatus === 'IDLE' && (
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
              )
            }
            {
              searchingMode !== 'CATEGORY BASED' && products.length === 0 && !isLoading && !error && hasPerformedSearch && (
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
              )
            }
          </div >
        )
        }
      </div >
    </div >
  );
};

export default Dashboard;




