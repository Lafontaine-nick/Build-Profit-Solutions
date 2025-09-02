# Build Profit Solutions - FastAPI Backend

## Setup Instructions

1. **Install dependencies:**

```bash
pip install -r requirements.txt
```

2. **Set your OpenAI API key:**

Set the `OPENAI_API_KEY` environment variable in your shell:

```bash
export OPENAI_API_KEY=your-openai-api-key
```

3. **Run the FastAPI server:**

```bash
uvicorn main:app --reload
```

## API Endpoint

### POST `/generate-estimate`

**Request Body (JSON):**
```
{
  "project_type": "string",
  "sq_ft": 1234,
  "zip_code": "string",
  "material_grade": "string",
  "markup_pct": 10.5,
  "timeline_months": 6
}
```

**Response (JSON):**
```
{
  "cost_breakdown": {"labor": ..., "materials": ..., "permits": ...},
  "bid_price": ...,
  "forecasted_inflation": ...,
  "profit_margin": ...
}
``` 