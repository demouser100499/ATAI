/**
 * Curated product-oriented seed keywords per category.
 * Used by category keyword discovery (SerpAPI autocomplete + shopping) to generate
 * diverse, product-intent keywords for Amazon/Alibaba pipeline.
 * Keys must match or be mappable from dashboard PRODUCT CATEGORY dropdown.
 */
export const CATEGORY_SEEDS: Record<string, string[]> = {
  "Electronics & Tech": [
    "smartphone", "laptop", "tablet", "smart tv",
    "wireless earbuds", "bluetooth speaker", "power bank",
    "smart watch", "security camera", "router", "ssd", "graphics card",
  ],
  "Computers & Accessories": [
    "gaming laptop", "mechanical keyboard", "wireless mouse",
    "monitor", "usb hub", "external hard drive", "webcam",
    "cooling pad", "laptop stand",
  ],
  "Mobile Accessories": [
    "phone case", "fast charger", "wireless charger",
    "screen protector", "car phone holder", "power bank",
    "mobile stand", "charging cable",
  ],
  "Home & Living": [
    "home organizer", "storage box", "curtains", "bedsheet",
    "wardrobe organizer", "shoe rack", "clothes hanger",
  ],
  "Furniture": [
    "sofa", "office chair", "study table", "dining table",
    "bookshelf", "wardrobe", "tv unit", "bed frame",
  ],
  "Kitchen & Dining": [
    "air fryer", "mixer grinder", "induction cooktop",
    "non stick cookware", "kitchen organizer",
    "water bottle", "lunch box", "coffee maker",
  ],
  "Home Appliances": [
    "vacuum cleaner", "air purifier", "water purifier",
    "washing machine", "refrigerator", "microwave oven",
    "room heater", "iron",
  ],
  "Tools & Hardware": [
    "power drill", "angle grinder", "hand tools",
    "tool kit", "safety gloves", "measuring tape",
    "screwdriver set", "welding machine",
  ],
  "Electrical & Solar": [
    "solar panel", "inverter", "battery", "extension cord",
    "led bulb", "switch board", "voltage stabilizer",
  ],
  "Fashion & Apparel": [
    "mens t shirt", "womens dress", "jeans", "jacket",
    "sportswear", "ethnic wear", "kids clothing",
  ],
  "Footwear": [
    "sports shoes", "sneakers", "formal shoes",
    "sandals", "slippers", "boots",
  ],
  "Bags & Luggage": [
    "backpack", "laptop bag", "travel suitcase",
    "duffel bag", "handbag", "trolley bag",
  ],
  "Beauty & Personal Care": [
    "face serum", "sunscreen", "makeup kit", "hair dryer",
    "trimmer", "perfume", "skincare products",
  ],
  "Health & Medical": [
    "digital thermometer", "blood pressure monitor",
    "weighing scale", "nebulizer", "massager", "first aid kit",
  ],
  "Baby & Kids": [
    "baby stroller", "diapers", "baby carrier",
    "baby bottle", "kids toys", "baby bed",
  ],
  "Toys & Games": [
    "remote control car", "board games", "puzzle",
    "lego", "educational toys", "action figures",
  ],
  "Sports & Fitness": [
    "treadmill", "dumbbells", "yoga mat",
    "exercise cycle", "resistance bands", "cricket bat",
  ],
  "Automotive & Bike": [
    "car accessories", "bike helmet", "dash cam",
    "car vacuum cleaner", "seat cover", "engine oil",
  ],
  "Pet Supplies": [
    "dog food", "cat food", "pet toys",
    "pet grooming kit", "dog leash", "litter box",
  ],
  "Office & School": [
    "office chair", "printer", "whiteboard",
    "stationery", "school bag", "calculator",
  ],
  "Books & Education": [
    "self help books", "exam preparation books",
    "story books", "notebooks", "ebooks",
  ],
  "Gaming": [
    "gaming console", "gaming controller",
    "gaming mouse", "gaming keyboard", "gaming headset",
  ],
  "Hobbies & Craft": [
    "painting kit", "craft supplies",
    "musical instruments", "guitar", "camera tripod",
  ],
  "Garden & Outdoor": [
    "garden tools", "plant pots", "watering can",
    "outdoor furniture", "grass cutter",
  ],
  "Cleaning & Household": [
    "mop", "broom", "cleaning brush",
    "detergent", "trash bags", "pest control spray",
  ],
  "Packaging & Storage": [
    "plastic containers", "storage bins",
    "corrugated boxes", "bottles", "labels",
  ],
  "Industrial & B2B": [
    "packaging machine", "conveyor belt",
    "weighing machine", "label printer",
    "industrial motor",
  ],
  "Construction & Building": [
    "cement", "tiles", "pipes", "paint",
    "drill machine", "hardware fittings",
  ],
  "Food & Grocery": [
    "snacks", "dry fruits", "spices",
    "tea", "coffee", "health food",
  ],
  "Jewelry & Watches": [
    "necklace", "earrings", "rings",
    "wrist watch", "smart watch", "bracelet",
  ],
  "Travel & Accessories": [
    "travel pillow", "passport holder",
    "luggage cover", "travel organizer",
  ],
};

/** Categories that have seeds (for dropdown when using SerpAPI discovery). */
export const CATEGORY_SEED_KEYS = Object.keys(CATEGORY_SEEDS);

/**
 * Map dashboard PRODUCT CATEGORY dropdown values (Google Trends style) to CATEGORY_SEEDS keys.
 * When the user selects a category in the UI, we resolve to a key that has seeds; if none, we fall back to Google Trends relatedQueries.
 */
export const DASHBOARD_CATEGORY_TO_SEEDS_KEY: Record<string, string> = {
  "All categories": "",
  "Computers & Electronics": "Electronics & Tech",
  "Home & Garden": "Home & Living",
  "Food & Drink": "Food & Grocery",
  "Sports": "Sports & Fitness",
  "Beauty & Fitness": "Beauty & Personal Care",
  "Pets & Animals": "Pet Supplies",
  "Games": "Gaming",
  "Health": "Health & Medical",
  "Hobbies & Leisure": "Hobbies & Craft",
  "Books & Literature": "Books & Education",
  "Autos & Vehicles": "Automotive & Bike",
  "Business & Industrial": "Industrial & B2B",
  "Arts & Entertainment": "Hobbies & Craft",
  "Shopping": "Fashion & Apparel",
  "Travel": "Travel & Accessories",
  "Jobs & Education": "Office & School",
  "People & Society": "Fashion & Apparel",
  "Internet & Telecom": "Electronics & Tech",
  "Finance": "Office & School",
  "Law & Government": "",
  "News": "",
  "Real Estate": "Home & Living",
  "Science": "Health & Medical",
};
