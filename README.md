# ATAI Hybrid Dashboard - Phase 1 Backend

This is a Next.js 15+ App Router project providing server-side APIs to interact with the ATAI Product Sourcing pipeline hosted on AWS.

## 🚀 Setup Instructions

1.  **Extract the Files**: Once you extract the zip, open the folder in your IDE (VS Code recommended).
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    Create a file named `.env.local` in this directory and add your AWS credentials and bucket names:
    ```env
    AWS_REGION=eu-north-1
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key

    S3_RANKED_BUCKET=atai-clean-layer
    S3_RANKED_KEY=ranked/ranked_results.parquet

    S3_CONFIG_BUCKET=atai-config
    S3_CRITERIA_KEY=discovery_criteria.json
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The server will be available at `http://localhost:3000`.

---

## 🛠️ API Documentation (Endpoints for Frontend)

### 1. Products API (Get Ranked Data)
- **Endpoint**: `GET /api/products`
- **Description**: Fetches the latest ranked product results from S3 with advanced filtering.
- **Query Params**:
  - `keyword`: (string) Filter by keyword.
  - `category`: (string) Filter by category.
  - `minScore`: (number) Minimum final score.
  - `blacklist`: (string) Comma-separated list of words to exclude from title/keyword.
  - `search_volume_min`: (number) Minimum monthly searches (Keyword Planner).
  - `gt_score_min` / `gt_score_max`: (number) Google Trends score range (0-100).
  - **Amazon Filters**:
    - `amz_price_min` / `amz_price_max`: (number) Price range for Amazon items.
    - `reviews_min` / `reviews_max`: (number) Review count range.
    - `rating_min`: (number) Minimum rating (0-5).
    - `fcl_min` / `fcl_max`: (number) FCL Price range.
  - **Alibaba Filters**:
    - `margin_min`: (number) Minimum margin percentage (Cost Below %).
    - `moq_max`: (number) Maximum MOQ.
    - `supplier_rating_min`: (number) Minimum supplier rating.
    - `verified_supplier`: (boolean) "true" to filter for verified suppliers.

- **Output Format**:
  ```json
  [
    {
      "product_id": "...",
      "title": "...",
      "final_score": 85.5,
      "margin_pct": 32.2,
      ...
    }
  ]
  ```

### 2. Criteria API (Manage Discovery)
- **GET** `/api/criteria`: Returns the current set of discovery criteria from S3.
- **POST** `/api/criteria`: Saves a new or updated criteria set to S3.
  - **Body**: 
    ```json
    {
      "criteria_id": "cs_001",
      "name": "Trending Electronics",
      "keywords": ["smart home", "iot"],
      "active": "true"
    }
    ```

---

## 📦 Key Technologies Used
- **Next.js 15**: App Router architecture.
- **hyparquet**: For high-performance Parquet reading in Node.js.
- **AWS SDK v3**: Optimized S3 interactions.
- **Tailwind CSS**: Pre-configured for UI development.

## 📂 Source Code Structure
- `src/lib/s3.ts`: Shared utility for S3 and Parquet logic.
- `src/app/api/`: All backend routes are located here.
