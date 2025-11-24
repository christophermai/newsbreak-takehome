This is a very well-structured and detailed README file\! It clearly explains the project's purpose, architecture, and the engineering trade-offs you considered.

I've added some line breaks, separated blocks of text, used more appropriate heading levels, and applied standard markdown conventions (like code blocks and lists) to enhance its readability and visual appeal. I also corrected the numbering for the CSV format and added some stylistic emojis.

Here is the revised, more readable markdown:

-----

# 🔎 Product Landing Page Crawler with LLM Analysis

An intelligent Node.js web crawler designed to find and extract multiple product names and descriptive keywords from e-commerce and content landing pages, leveraging local Large Language Models (LLMs) like **Ollama** (`mistral`).

-----

## ✨ Features

  * **Multiple Product Extraction**: Capable of extracting up to 10 distinct products per page. (More is possible if you accept a larger CSV file size.)
  * **Intelligent Classification**: The LLM understands how to distinguish actual product names from common webpage elements like navigation links, buttons, and decorative labels.
  * **Contextual Keywords**: Generates 3-5 relevant, categorization keywords for each identified product.
  * **Free & Open Source**: The core LLM analysis relies on **Ollama** (a free, open-source LLM runtime), eliminating mandatory paid API usage for the primary functionality.

-----

## 🏗️ Architecture

The project's architecture is divided into two primary approaches for content acquisition:

### Approach 3 (Chosen: Firecrawl for Data, Ollama for Analysis)

```
URL → Fetch domain content (Firecrawl Crawl API) → Extract Product Names → Send names/description to LLM (Ollama, axios) to generate keywords
  → Parse JSON Response → CSV Output
```

### Approach 2 (Alternative: Direct Crawling/Scraping)

```
URL → Fetch HTML (axios) → Extract Content (cheerio) → Send raw content to LLM (Ollama)
  → Parse JSON Response → CSV Output
```

-----

## 🧠 Insights: Approach Selection Rationale

The project goals were centered around **deterministic results**, identifying product names/types, and generating categorization keywords. This led to testing three main approaches:

### 1\. DOM Parsing + Node.js NLP (`natural`)

| Pros ✅ | Cons ❌ |
| :--- | :--- |
| Free and completely open source. | DOM parsing heuristics have limitations (e.g., misidentifying headers/labels as product names). |
| Deterministic results (same input always gives same output). | High complexity required to reach acceptable performance. |
| | Only achieved about **50% success rate** in identifying actual product names and useful keywords. |

### 2\. Direct LLM API (Ollama)

| Pros ✅ | Cons ❌ |
| :--- | :--- |
| Highly accurate at distinguishing product names from headers/labels using natural language context. | **Non-deterministic results** (output varies based on model/user state). |
| Achieved much greater accuracy in identifying product names (only 3 URLs had issues). | Intensive use of the local GPU/CPU. |
| | Prone to **hallucinations** (e.g., outputting generic names like "Product 1" or regex-like strings for articles). |
| | Low success rate with identifying articles/blog post titles unless using a more powerful, paid model (like GPT-4/5). |

### 3\. Firecrawl API + Ollama (Chosen Approach)

This approach uses **Firecrawl** to handle the difficult, non-deterministic task of cleaning and structuring website content, and then feeds the high-quality content into **Ollama** for analysis.

  * **Firecrawl's Crawl Endpoint**: Used to recursively search and find URLs matching a pattern like `domain.com/products/.+`, and returns clean JSON content.
  * **The Trade-off**: Firecrawl ensures **deterministic results** (a key requirement) and provides the highest success rate of correct product names. This outweighs the financial cost (free credit limit) and the non-deterministic nature of the Ollama-generated keywords, which can afford some variation.

> **Decision Summary:** **Firecrawl API** was chosen for **deterministic product name extraction**, and **Ollama** was chosen for **keyword generation** because the variation in keywords is acceptable.

-----

## 📝 Setup Instructions

### Ollama (Local & Free LLM Runtime)

1.  **Download & Install Ollama**: [https://ollama.ai](https://ollama.ai)
2.  **Pull a model** (run in terminal):
    ```bash
    ollama pull mistral
    ```
    *(Other options: `neural-chat`, `llama2`, `orca-mini`)*
3.  **Start Ollama Server** (will run on `http://localhost:11434`):
    ```bash
    ollama serve
    ```

### Local Project Setup

1.  Install [Node.js](https://nodejs.org/).
2.  Navigate to your project folder containing `crawler.js` and `package.json`.
3.  **Install dependencies**:
    ```bash
    npm install
    ```
4.  **Set API Keys**:
      * **Secure Method (Recommended):** Use an environment variable by setting up a `.env` file (refer to the `.env.example` template).
      * **Direct Code Method (Less Secure):** If testing quickly, you may directly edit the API key in `crawler.js` (e.g., `const firecrawl = new Firecrawl({ apiKey: "fc-..."});`). **Note:** The included key may have exhausted its free credits.

-----

## ▶️ Usage

Ensure **Ollama is running** in a separate terminal (`ollama serve`), then execute the crawler from your project directory:

```bash
npm start
```

-----

## 📈 Output

The script creates a CSV file based on the approach used:

  * **Firecrawl Approach**: `product_crawler_results_firecrawl.csv`
  * **Ollama Approach**: `product_crawler_results_ollama.csv` (used when `crawler.js` is replaced with the backup version)

### CSV Format

| \# | Column | Description |
| :--- | :--- | :--- |
| 1 | `URL` | The landing page URL. |
| 2 | `Product Name` | The actual product/article name identified by the LLM. |
| 3 | `Keywords` | Up to 10 comma-separated categorization keywords. |

-----

## ⚙️ Customization

### Change Ollama Model

Edit the `OLLAMA_MODEL` constant in `crawler.js`:

```javascript
const OLLAMA_MODEL = 'mistral'; // Options: mistral, llama2, orca-mini
```

### Adjust Keywords Per Product

Modify the desired number of keywords directly within the LLM prompt string in `crawler.js`.

### Add/Remove URLs

Edit the `URLS` array defined in `crawler.js`.

-----

## ❓ Troubleshooting

### "Ollama error: connect ECONNREFUSED"

  * **Solution**: Make sure Ollama is running in another terminal (`ollama serve`) and is accessible at `http://localhost:11434`.

### "No JSON found in response"

  * **Cause**: The LLM model may be failing to follow the instruction to return ONLY a JSON array.
  * **Solution**: Try a different model (e.g., `ollama pull neural-chat`) or adjust the prompt engineering.

### Token Limit Exceeded

  * **Cause**: The input content is too large for the model's context window.
  * **Solution**: The script currently truncates content to 4000 characters. If this is still insufficient, you may need to reduce the content size further or use a model with a larger context window.

-----

## 🐛 Known Issues & Proposed Solutions

### **Issue:** `9wik.com`, `inpeaceful.com`, `etherealing.com` show "product1", "product2", etc.

The current Ollama model struggles to extract titles from these complex, article-heavy, or heavily JavaScript-rendered sites.

  * **Proposed Solution**: **Use GPT-4/5.1 via the ChatGPT API**. Testing showed GPT-5.1 was able to successfully identify and extract rich product names from these difficult URLs:
      * **9wik.com**: Identified article titles (e.g., "Unleashing Performance: Exploring the Toyota GT Sports Car").
      * **inpeaceful.com**: Identified specific jewelry items (e.g., "925 Silver SImple Cuff Bracelet").
      * **etherealing.com**: Identified diverse products (e.g., "2 carat moissanite 925 Sterling Silver Pendant Necklace").

-----

## 📦 Dependencies

  * **`axios`**: HTTP client for making API calls to Ollama and other services.
  * **`cheerio`**: HTML parsing library used in Approach 2.
  * **`firecrawl`**: Web crawling/scraping API for fetching clean, structured domain data (Approach 3).
  * **`Ollama`**: Local LLM runtime (external dependency).

-----

## ⚖️ License

MIT