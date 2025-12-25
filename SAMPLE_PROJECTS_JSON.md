# Sample projects.json for ChatGPT

Copy this message to ChatGPT:

---

"If you send me a sample projects.json (with fake/redacted data), I can tighten the payload + prompts so the insights are laser accurate to your schema (e.g., exactly how you store margins, costs, progress)."

Here's a sample projects.json structure from my app:

```json
[
  {
    "id": "1764318589337",
    "userId": "user_35gOP06iTxxmej40Y68m79AShXP",
    "title": "Nick Residential Remodel",
    "name": "Nick Residential Remodel",
    "status": "won",
    "location": "Las Vegas, NV",
    "city": "Las Vegas",
    "state": "NV",
    "zip": "89123",
    "client": "Nick Johnson",
    "clientEmail": "nick@example.com",
    "clientPhone": "555-0100",
    "bidPrice": 22425,
    "estimatedCost": 15000,
    "actualCost": 12000,
    "margin": 46.5,
    "markup": 49.5,
    "progress": 25,
    "overallProgressPct": 25,
    "startDate": "2025-01-15",
    "endDate": "2026-02-26",
    "createdAt": "2025-01-10T10:30:00Z",
    "updatedAt": "2025-12-06T19:20:00Z",
    "projectType": "Residential Remodel",
    "lineItems": [
      {
        "name": "Drywall Materials",
        "category": "Materials",
        "quantity": 100,
        "unit": "sq ft",
        "cost": 2500,
        "total": 2500
      },
      {
        "name": "Permit Fees",
        "category": "Permits",
        "quantity": 1,
        "unit": "each",
        "cost": 450,
        "total": 450
      },
      {
        "name": "Framing Labor",
        "category": "Labor",
        "quantity": 40,
        "unit": "hours",
        "cost": 65,
        "total": 2600
      }
    ],
    "receipts": [
      {
        "id": "receipt-001",
        "date": "2025-01-20",
        "amount": 2500,
        "vendor": "Home Depot",
        "category": "Materials"
      }
    ],
    "attachments": [],
    "projectData": {
      "bidPrice": 22425,
      "estimatedCost": 15000,
      "lineItems": [
        {
          "name": "Drywall Materials",
          "category": "Materials",
          "cost": 2500
        }
      ]
    },
    "estimateData": {
      "bidPrice": 22425,
      "grandTotal": 22425,
      "markup": 49.5
    }
  },
  {
    "id": "1762919888878",
    "userId": "user_35gOP06iTxxmej40Y68m79AShXP",
    "title": "Jack Remodel Project",
    "name": "Jack Remodel Project",
    "status": "completed",
    "location": "Salt Lake City, UT",
    "city": "Salt Lake City",
    "state": "UT",
    "zip": "84101",
    "client": "Jack Smith",
    "bidPrice": 12744,
    "estimatedCost": 8500,
    "actualCost": 9200,
    "margin": 27.8,
    "markup": 50,
    "progress": 100,
    "overallProgressPct": 100,
    "startDate": "2025-02-01",
    "endDate": "2025-11-15",
    "createdAt": "2025-01-25T14:20:00Z",
    "updatedAt": "2025-11-15T18:00:00Z",
    "projectType": "Kitchen Remodel",
    "lineItems": [
      {
        "name": "Cabinets",
        "category": "Materials",
        "quantity": 1,
        "unit": "set",
        "cost": 4500,
        "total": 4500
      },
      {
        "name": "Installation Labor",
        "category": "Labor",
        "quantity": 32,
        "unit": "hours",
        "cost": 75,
        "total": 2400
      }
    ],
    "receipts": [
      {
        "id": "receipt-002",
        "date": "2025-02-10",
        "amount": 4500,
        "vendor": "Cabinet Warehouse",
        "category": "Materials"
      },
      {
        "id": "receipt-003",
        "date": "2025-02-15",
        "amount": 2400,
        "vendor": "Labor Payment",
        "category": "Labor"
      }
    ],
    "attachments": [],
    "hasPermitFees": false,
    "hasReceiptsAttached": true
  },
  {
    "id": "1760728073257",
    "userId": "user_35gOP06iTxxmej40Y68m79AShXP",
    "title": "Steve - Kitchen Renovation",
    "name": "Steve - Kitchen Renovation",
    "status": "completed",
    "location": "Reno, NV",
    "city": "Reno",
    "state": "NV",
    "zip": "89501",
    "client": "Steve Williams",
    "bidPrice": 3068,
    "estimatedCost": 2000,
    "actualCost": 2100,
    "margin": 31.5,
    "markup": 53.4,
    "progress": 100,
    "overallProgressPct": 100,
    "startDate": "2025-03-01",
    "endDate": "2025-10-20",
    "createdAt": "2025-02-15T09:00:00Z",
    "updatedAt": "2025-10-20T16:30:00Z",
    "projectType": "Kitchen Remodel",
    "lineItems": [],
    "receipts": [],
    "attachments": [],
    "hasPermitFees": false,
    "hasReceiptsAttached": false
  },
  {
    "id": "draft-project-001",
    "userId": "user_35gOP06iTxxmej40Y68m79AShXP",
    "title": "New Office Build",
    "name": "New Office Build",
    "status": "estimate",
    "location": "St. George, UT",
    "city": "St. George",
    "state": "UT",
    "zip": "84790",
    "client": "ABC Corporation",
    "bidPrice": 125000,
    "estimatedCost": 85000,
    "actualCost": 0,
    "margin": 32,
    "markup": 47,
    "progress": 0,
    "overallProgressPct": 0,
    "startDate": "2026-03-01",
    "endDate": "2026-06-30",
    "createdAt": "2025-12-01T10:00:00Z",
    "updatedAt": "2025-12-05T14:00:00Z",
    "projectType": "Commercial",
    "lineItems": [
      {
        "name": "Framing Materials",
        "category": "Materials",
        "quantity": 5000,
        "unit": "sq ft",
        "cost": 35000,
        "total": 35000
      },
      {
        "name": "Electrical Rough-In",
        "category": "Labor",
        "quantity": 120,
        "unit": "hours",
        "cost": 85,
        "total": 10200
      }
    ],
    "receipts": [],
    "attachments": [],
    "hasPermitFees": true,
    "hasReceiptsAttached": false,
    "permitFeesIncluded": true
  }
]
```

**Key Schema Notes:**
- `margin` is stored as a percentage (e.g., 46.5 = 46.5%)
- `bidPrice` = total bid amount to client
- `estimatedCost` = estimated project cost
- `actualCost` = actual spent (0 if not started)
- `progress` and `overallProgressPct` are 0-100
- `status` can be: "estimate", "bid_submitted", "won", "in_progress", "completed", "lost"
- `lineItems` array contains cost breakdown with `name`, `category`, `cost`, `total`
- `receipts` array tracks actual expenses
- Projects can have nested `projectData` and `estimateData` objects
- `hasPermitFees` and `hasReceiptsAttached` are boolean flags
- Location stored as "City, State" string, also has separate `city` and `state` fields

---



