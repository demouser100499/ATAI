'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

  // Check if fields should be disabled (after successful pipeline completion)
  // KEYWORD SEARCH and LOCATION should remain enabled
  const pipelineFieldsDisabled = pipelineStatus === 'COMPLETED'; // For VARIANT LIMIT MAX, RESULTS CAP MAX, TREND PERIOD
  const fieldsDisabled = false; // KEYWORD SEARCH and LOCATION are never disabled

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
    return {
      // Basic filters
      keyword: (searchingMode === 'MANUAL' || searchingMode === 'ATAI AUTO') ? (keywordSearch || undefined) : undefined,
      category: (searchingMode === 'CATEGORY BASED' && productCategory !== 'All categories') ? productCategory : undefined,
      search_volume_min: kwpMonthlySearches || undefined,
      blacklist: blacklistedWords || undefined,
      location: getCountryCode(location) || undefined,
      search_mode: searchModeMap[searchingMode] || 'manual_search',
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

    try {
      if (activeSearch && pipelineStatus !== 'COMPLETED') {
        // Active Search is ON and pipeline hasn't completed yet - Use pipeline workflow

        // Step 1: Trigger Pipeline
        setPipelineStatus('STARTING');
        setStatusMessage('STARTING');

        const searchModeMap: Record<string, string> = {
          'MANUAL': 'manual_search',
          'CATEGORY BASED': 'category_search',
          'ATAI AUTO': 'auto_search'
        };

        const payload = {
          keyword: (searchingMode === 'MANUAL' || searchingMode === 'ATAI AUTO') ? keywordSearch : "",
          search_mode: searchModeMap[searchingMode] || 'manual_search',
          filters: {
            location: getCountryCode(location),
            category: searchingMode === 'CATEGORY BASED' ? productCategory : "",
            trendPeriod: parseInt(trendPeriod),
            variantLimitMax: parseInt(variantLimitMax),
            size: parseInt(resultsCap),
            amazonFilters: amazonFilters,
            alibabaFilters: alibabaFilters,
            blacklist: blacklistedWords
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

        if (!triggerData.success) {
          throw new Error(triggerData.message || 'No data found for this search');
        }

        setExecutionArn(triggerData.executionArn);
        setPipelineStatus('POLLING');
        setStatusMessage('RUNNING');

        // Note: status polling is now handled by the Polling Effect below
      } else {
        // Either Active Search is OFF OR pipeline has completed - Call products API directly with filters
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
    alibabaFilters
  ]);



  // Polling Effect for Pipeline
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout;

    if (pipelineStatus === 'POLLING' && executionArn) {
      pollingInterval = setInterval(async () => {
        try {
          // 1. Check Status
          const statusRes = await fetch(`/api/pipeline/status?arn=${executionArn}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'SUCCEEDED') {
            setStatusMessage('Pipeline completed successfully! Fetching final results...');
            clearInterval(pollingInterval);
            setPollingIntervalRef(null);
            setPipelineStatus('COMPLETED');
            setIsPreliminary(false);

            // Fetch final results (without filters or with filters as needed, plan said "without any filters" but typically we want the ranked data for this keyword)
            // The user request said: "display the complete ranked_data without any filters"
            // checking product api, it allows fetching all or by keyword. 
            // We likely want to fetch by keyword to see the results of this run.
            const finalParams = getApiParams();
            const finalProducts = await fetchProducts(finalParams);
            setProducts(finalProducts);
            setIsLoading(false);
          } else if (statusData.status === 'ABORTED') {
            setStatusMessage('ABORTED');
            setPipelineStatus('FAILED');
            setIsLoading(false);
            clearInterval(pollingInterval);
            setPollingIntervalRef(null);
            // Don't set error for ABORTED status
          } else if (statusData.status === 'FAILED' || statusData.status === 'TIMED_OUT') {
            setStatusMessage(`Pipeline failed: ${statusData.status}`);
            setError(`Pipeline execution failed: ${statusData.status}`);
            setPipelineStatus('FAILED');
            setIsLoading(false);
            clearInterval(pollingInterval);
            setPollingIntervalRef(null);
          } else {
            // Still running
            setStatusMessage(statusData.status);

            // 2. Fetch Preliminary Data (Optional: Update products with preliminary data if desired)
            try {
              const queryParams = new URLSearchParams();
              const mode = searchModeMap[searchingMode] || 'manual_search';
              queryParams.append('search_mode', mode);

              if (mode === 'category_search') {
                queryParams.append('category', productCategory);
              } else if (keywordSearch) {
                queryParams.append('keyword', keywordSearch);
              }

              const prelimRes = await fetch(`/api/pipeline/preliminary`);
              const prelimData = await prelimRes.json();
              if (prelimData.results && prelimData.results.length > 0) {
                // Show partial results
                setProducts(prelimData.results);
                setIsPreliminary(true);
              }
            } catch (e) {
              console.log("Error fetching preliminary data", e);
            }
          }

        } catch (e) {
          console.error("Polling error", e);
          // Don't stop polling on transient network errors, but maybe limit retries in a real app
        }
      }, 3000); // Poll every 3 seconds

      // Store the interval reference
      setPollingIntervalRef(pollingInterval);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingIntervalRef(null);
      }
    }
  }, [pipelineStatus, executionArn, keywordSearch, searchingMode, productCategory, getApiParams]);


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
                    <option value="Electronics & Tech">Electronics & Tech</option>
                    <option value="Computers & Accessories">Computers & Accessories</option>
                    <option value="Mobile Accessories">Mobile Accessories</option>
                    <option value="Home & Living">Home & Living</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Kitchen & Dining">Kitchen & Dining</option>
                    <option value="Home Appliances">Home Appliances</option>
                    <option value="Electrical & Solar">Electrical & Solar</option>
                    <option value="Fashion & Apparel">Fashion & Apparel</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Bags & Luggage">Bags & Luggage</option>
                    <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                    <option value="Health & Medical">Health & Medical</option>
                    <option value="Baby & Kids">Baby & Kids</option>
                    <option value="Toys & Games">Toys & Games</option>
                    <option value="Sports & Fitness">Sports & Fitness</option>
                    <option value="Automotive & Bike">Automotive & Bike</option>
                    <option value="Pet Supplies">Pet Supplies</option>
                    <option value="Office & School">Office & School</option>
                    <option value="Books & Education">Books & Education</option>
                    <option value="Hobbies & Craft">Hobbies & Craft</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Garden & Outdoor">Garden & Outdoor</option>
                    <option value="Cleaning & Household">Cleaning & Household</option>
                    <option value="Packaging & Storage">Packaging & Storage</option>
                    <option value="Industrial & B2B">Industrial & B2B</option>
                    <option value="Construction & Building">Construction & Building</option>
                    <option value="Food & Grocery">Food & Grocery</option>
                    <option value="Jewelry & Watches">Jewelry & Watches</option>
                    <option value="Travel & Accessories">Travel & Accessories</option>
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
                <span className="text-xs text-gray-800">100</span>
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

            {products.length > 0 && pipelineStatus === 'COMPLETED' && (
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

            {products.length > 0 && pipelineStatus === 'POLLING' && isPreliminary && (
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

            {products.length > 0 && pipelineStatus === 'IDLE' && (
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
            {products.length === 0 && !isLoading && !error && hasPerformedSearch && (
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



