# Product Landing Page Crawler with LLM Analysis

An intelligent Node.js web crawler that uses LLMs (Ollama mistral) to identify and extract multiple products from landing pages.

## Features

- **Multiple Product Extraction**: Up to 10 products per page. More is possible if you don't mind a larger csv file.
- **Intelligent Classification**: LLM understands how to extract and distinguish product names vs navigation/buttons/labels
- **Contextual Keywords**: 3-5 relevant keywords per product
- **Free & Open Source**: No mandatory paid APIs

## TODO (optionals)
- **Data Quality Metrics**: # of products found per approach
- **Confidence Scoring**: When NLP and LLM agree, report high confidence.
- **Automatic Failure Detection for LLM**: When LLM lists regex(`product\d+`) as a product name, report this URL as unable to extract good data.

## Architecture

```
URL → Fetch domain data (firecrawl) → Extract Product Names → Send product names, description to LLM (ollama, axios) to generate keywords
  → Parse JSON Response → CSV Output
```

```
URL → Fetch HTML (axios) → Extract Content (cheerio) → Send to LLM (ollama)
  → Parse JSON Response → CSV Output
```

## Insights: Which approaches did I consider, which did I choose, and why?

There were a few requirements that stuck out to me for this project.
- Deterministic results: Ensure you can run it and reproduce the same results as my submitted file.
- Produces an identified product name or type
- Produces keywords for categorization

Clarifications I received:
- It is expected that a domain sells multiple products. We want to know what each of them is about.
- For 9wik.com, you can think of those articles are the "products" they are selling and we also want to know what they are about.

So I set out to build a web crawler that would produce as many product names as it could find with deterministic results.

I tried 3 approaches:
1. DOM Parsing for product names + Natural Language Processing via node.js NLP library `natural` for keywords
	✅ **Pros:**
		- Free and open source
		- Same inputs will always generate same output
	❌ **Cons:**
		- Using DOM parsing heuristics has limitations handling 100% of all the possible ways DOMs could be carrying their product information. I was running into an issue where the parser thinking some headers and button labels were product names.
		- Greater complexity required to reach desired performance.
		- only about 50% success rate in identifying actual product names and useful keywords.
2. LLM API. Choosing Ollama here because it's the best free model.
	✅ **Pros:**
		- Able to use natural human language as context to distinguish product names from descriptors, headers, labels, and buttons.
		- Was able to achieve much greater accuracy with identifying product names. Only 3 URLs had issues.
		- Able to use natural human language as context to generate useful keywords for categorization.
	❌ **Cons:**
		- Not always able to distinguish product names from non-product-name labels.
		- Not always able to generate useful keywords for categorization.
		- Intensive use of the GPU
		- Hallucinations possible. E.g. for 9wik.com it was outputting either "Product 1", "Laptop XYZ", "product/articlename1" as one of the product names. Although I was able to reduce the frequency of this happening with prompt engineering.
		- Same input does not always generate same output depending on the user.
		- With Ollama, I have had low success rate with it identifying articles and extracting article names. GPT-5.1 didn't have any issue though.
			- costs money (~$0.20 per URL) to use a model that is smart enough to extract the information I want from webpages that don't reveal product information on its homepage. If budget allowed, I would use GPT-5.1
3. Firecrawl API for product names, Ollama for keywords. I can recursively search through a URL and its subdomains to gather content. Firecrawl does this and outputs content as clean json.
	- With its Crawl endpoint, I can get a list of products by giving domain.com and it will find us all regex(domain.com/products/.+) endpoints.
	- I then json access this data for product names. I can also generate keywords with ollama by passing it the json.
		- Cons:
			- I ran into the free credit limit after processing 12 urls. I hope to mitigate this by reducing polling rate.
	- I considered using the Map endpoint to get a much smaller json of URLs under products which contains url, title, description and executes much faster. Then I would extract the product names using regex, and generate keywords with ollama by passing it the json.
		- However, some URLs weren't returning any description, which would make keyword generation by LLM not as robust.
	- For blog sites like 9wik.com, I am getting no results. It seems to be a website that aggregates all its content with javascript, and has very limited subdomains of its own. I can perhaps use scrape API to scrape the homepage, get the markdown, pass that to NLP and extract article titles from there, but I'm not sure how I can generalize this approach to handle all blogsites as edge cases.
	❌ **Cons:**
		- Only x amount of free credits per day.
			
I chose Firecrawl API because I get the highest success rate of correct product names. It has some financial cost, but it outputs deterministic results which is one of the requirements of this assignment, which is why I prefer it over the Ollama which doesn't produce deterministic results.
For the keyword generation, I chose to use an LLM because although the results may not be deterministic, I felt that with multiple keywords per product, we can afford to have some variation in the list of keywords, because multiple executions would most likely return some common keywords.

If I could, I would use GPT-5.1 for both product name extraction and keyword generation since it is able to achieve the best accuracy although with no way to use it for free.

## Setup Instructions

### Ollama (Local, Free)

1. **Download & Install Ollama**: https://ollama.ai
2. **Pull a model** (run in terminal):
   ```bash
   ollama pull mistral
   ```
   Other options: `neural-chat`, `llama2`, `orca-mini`
3. **Start Ollama** (will run on `http://localhost:11434`)
   ```bash
   ollama serve
   ```

### Local Setup

1. Install [Node.js](https://nodejs.org/)
2. Navigate to project folder with `crawler.js` and `package.json`
3. the `crawler.js` in the root folder uses Approach 3 (firecrawl). To use the Ollama version, copy paste the `crawler.js` from backup versions/ollama/crawler into the root folder.
4. To be able to call firecrawler API, you need a valid API key. The current key is linked to my account, which may or may not have free credits available at the time you are running. If you need a guaranteed unused API key, you can sign into https://www.firecrawl.dev/ with a spoof email to get assigned a fresh API key. Then copy that into crawler.js `const firecrawl = new Firecrawl({ apiKey: "fc-195000cba7b24263bb25a10a8328c68d"});`
	- I am aware this is a security red flag, but I decided to leave it like this so you have the option of using my API key.
	- otherwise you must generate your own API key to input in .env file which I'm not sure if you would be opposed to doing.
5. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### With Ollama Running Locally

Make sure Ollama is running in another terminal (`ollama serve`), then:

```bash
npm start
```

## Output

Creates a CSV file:

the default root file or the file found at backup versions/firecrawl/crawler.js produces:
- **`product_crawler_results_firecrawl.csv`** - Results from Firecrawl analysis

the file found at backup versions/ollama/crawler.js produces:
- **`product_crawler_results_ollama.csv`** - Results from Ollama analysis

### CSV Format

| Column | Description |
|--------|-------------|
| URL | Landing page URL |
| Product Name | Actual product/article name identified by LLM |
| Keywords | up tp 10 comma-separated categorization keywords |

## Customization

### Change Ollama Model

Edit `crawler.js`:
```javascript
const OLLAMA_MODEL = 'mistral'; // Options: mistral, llama2, orca-mini
```

### Adjust Keywords Per Product

Edit `crawler.js`, search for 'up to 10' in the prompt:
Change range there

### Add/Remove URLs

Edit the `URLS` array in `crawler.js`

## How It Works

### 1. HTML Fetching & Cleaning
- Fetches page HTML using axios
- Removes scripts, styles, navigation, footers
- Extracts main content area

### 2. LLM Analysis
- Sends cleaned content to LLM
- LLM receives specific instructions to:
  - Extract actual product names
  - Ignore buttons ("Quick add", "Quick view")
  - Ignore navigation ("Top trendings", "Latest articles")
  - Ignore labels ("New arrival", "Product type")
  - Ignore non-products ("Contact Us", "Mastercard")
  - Aware that "articles" can be products
- LLM returns JSON with product names and keywords

### 3. Output Generation
- Parses LLM JSON response
- Creates CSV with results
- Generates separate files for comparison

## LLM Pros & Cons

### Ollama (Local)
✅ **Pros:**
- Completely free, no API limits
- Runs offline
- Reproducible results
- Fast feedback loop
- Customizable models

❌ **Cons:**
- Requires local GPU/resources
- Setup required
- Less sophisticated models than cloud

### ChatGPT API (Cloud)
✅ **Pros:**
- More sophisticated models
- No local setup required
- Higher quality results possible

❌ **Cons:**
- Not free (~$5-10 for 27 URLs)

## Troubleshooting

### "Ollama error: connect ECONNREFUSED"
- Make sure Ollama is running: `ollama serve`
- Check if running on `http://localhost:11434`

### "No JSON found in response"
- Model may not be following instructions
- Try different model: `ollama pull neural-chat`
- Check if content extraction is working properly

### Token Limit Exceeded
- Content is being truncated to 4000 chars
- Reduce `substring(0, 4000)` if still hitting limits
- Some models have lower token limits

## Known Issues
### 9wik.com, inpeaceful.com, etherealing.com show "product1", "product2", "product3", etc.
- Proposed Solution: Use GPT-5.1 via ChatGPT API. I was able to test this model in the following way:
	1) I asked "what kind of website is ${url} and what do they sell?"
	2) the model was able to identify 
	- 9wik.com
		- articles, automotive
			- Unleashing Performance: Exploring the Toyota GT Sports Car
	- inpeaceful.com
		- fashion, jewelry, and small accessories
			- 925 Silver SImple Cuff Bracelet
			- Opening Adjustable All-match Ring
			- Natural Stone Bracelet
			- and more
	- etherealing.com
		- Jewelry/Accessories
			- 2 carat moissanite 925 Sterling Silver Pendant Necklace
			- Stainless Steel Zircon Lucky Clover Earrings
			- and more
		- Baby/Safety Product
			- Head Protection Backpack for babies
		- Grooming Tool
			- Automatic Soft Nail File
	Based on these successful results, I have high confidence that GPT-5.1 API would give us useful product names and keywords for these URLs. Further prompt engineering may be required for other websites.

## Dependencies

- **axios**: HTTP client
- **cheerio**: HTML parsing
- **firecrawl**: web crawling for structured data about the domain
- **Ollama**: Local LLM runtime (external)

## License

MIT