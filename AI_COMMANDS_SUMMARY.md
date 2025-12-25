# 🤖 AI Assistant Commands - Complete Summary

This document provides a comprehensive overview of all AI commands implemented in the Build Profit Solutions app.

---

## 📋 Table of Contents

1. [Project & Estimate Management](#1-project--estimate-management)
2. [Materials & Labor Management](#2-materials--labor-management)
3. [Financial Management](#3-financial-management)
4. [Customer & Project Information](#4-customer--project-information)
5. [Research & Search Tools](#5-research--search-tools)
6. [Payment & Timeline Management](#6-payment--timeline-management)
7. [Contract Management](#7-contract-management)
8. [Project Analysis](#8-project-analysis)

---

## 1. Project & Estimate Management

### ✅ **Create New Bid/Estimate**
**Command:** `create_new_bid`

**What it does:** Creates a new blank estimate/bid from scratch

**Usage Examples:**
- "Create a new estimate for John's kitchen remodel"
- "Start a new bid for a bathroom renovation for customer Sarah"
- "New estimate: 500 sqft home addition in Las Vegas"

**Required:**
- Project title/name
- Customer/client name

**Optional:**
- Location (city, state)
- Project type (kitchen, bathroom, room addition, etc.)
- Square footage

**Project Types Supported:**
- `kitchen`
- `bathroom`
- `room_addition`
- `home_addition`
- `new_build`
- `landscaping`
- `other`

---

### ✅ **Add/Update Estimate Items**
**Command:** `update_estimate_item`

**What it does:** Adds new materials/labor to an estimate OR updates existing line items

**Usage Examples:**
- "Add $2000 for drywall to the estimate"
- "Add plumbing labor for $3000 to chris remodel"
- "Update framing labor to $13,500"
- "Add tile material for $1500"

**Key Features:**
- ✅ Asks for project name if unclear
- ✅ Asks for specific material name if you just say "material"
- ✅ Asks for labor type if you say "add sub labor" without specifics
- ✅ Works for draft/estimate projects (NOT change orders)
- ✅ Can update existing items (amount, quantity, unit cost)

**Important Notes:**
- For draft estimates: Adds line items directly to the estimate
- For active projects: Use `create_change_order` instead
- Will ask clarifying questions if information is missing

---

## 2. Materials & Labor Management

### ✅ **Record Material Purchase** (Expense Tracking)
**Command:** `record_material_purchase`

**What it does:** Logs material purchases as expenses (already spent money)

**Usage Examples:**
- "I bought $500 worth of lumber from Home Depot"
- "Record $1200 material purchase from Lowe's for plumbing supplies"
- "I spent $800 on drywall materials"

**Required:**
- Project name
- Amount
- Vendor
- Category

**Important:** This is for tracking expenses, NOT adding to estimate totals. Use `update_estimate_item` to add materials to estimates.

---

### ✅ **Record Labor Expense** (Expense Tracking)
**Command:** `record_labor_expense`

**What it does:** Logs labor/subcontractor payments as expenses

**Usage Examples:**
- "I paid $2000 for plumbing labor"
- "Record $1500 labor expense for tile work"
- "I spent $3000 on framing subcontractor"

**Required:**
- Project name
- Amount

**Optional:**
- Hours worked
- Hourly rate
- Trade type
- Vendor/contractor name
- Notes

---

### ✅ **Search Material Prices**
**Command:** `search_material_prices`

**What it does:** Searches and compares material prices from Home Depot and Lowe's

**Usage Examples:**
- "What's the price for 60 pound concrete?"
- "Where is drywall cheaper, Home Depot or Lowe's?"
- "Compare prices for 2x4 lumber"
- "What does 4x8 drywall sheet cost at Home Depot?"

**Key Features:**
- ✅ Compares prices between Home Depot and Lowe's
- ✅ Asks for specific details if query is vague (size, weight, dimensions)
- ✅ Uses project ZIP code if available

**Note:** Will ask for specific product details (weight, size, dimensions) if the query is too generic.

---

## 3. Financial Management

### ✅ **Create Change Order**
**Command:** `create_change_order`

**What it does:** Creates a change order for active/won projects (adds to budget after bid acceptance)

**Usage Examples:**
- "Create a change order for $5000 additional work"
- "Add a change order for extra electrical work, $2000"
- "Change order: $3000 for additional materials, already approved"

**Required:**
- Project name
- Change order title/description
- Amount
- Materials amount breakdown
- Labor amount breakdown

**Important:** 
- ✅ ONLY works for active/won/completed projects
- ✅ Will ask for materials and labor breakdown
- ✅ Can mark as approved if you specify

---

### ✅ **Approve Change Order**
**Command:** `approve_change_order`

**What it does:** Approves an existing change order

**Usage Examples:**
- "Approve the electrical change order"
- "Approve the latest change order"
- "Approve change order for $5000 additional work"

---

### ✅ **Update Overhead & Markup**
**Command:** `update_overhead_markup`

**What it does:** Sets or updates overhead costs and markup percentage for estimates

**Usage Examples:**
- "Set markup to 18% for chris remodel"
- "Add $500 for insurance overhead"
- "What should I add for my overhead and markup?" (recommendation mode)
- "What do you recommend I put for overhead and markup?" (recommendation mode)

**Features:**
- ✅ **Recommendation Mode:** If you ask for recommendations, AI calculates optimal values based on project type and totals
- ✅ **Direct Set Mode:** If you provide values, sets them directly
- ✅ Asks for project name if unclear

**Overhead Categories:**
- Insurance overhead
- Equipment rentals
- Site facilities
- Other overhead
- Markup percentage

**Industry Standards by Project Type:**
- Kitchen: 15-30% total overhead
- Bathroom: 15-28%
- Room/Home Addition: 12-25%
- New Build: 8-20%
- General: 12-20%
- Optimal Markup: 15-18%

---

### ✅ **Create Purchase Order**
**Command:** `create_purchase_order`

**What it does:** Creates a purchase order for materials/services not yet received

**Usage Examples:**
- "Create a purchase order for $2000 lumber from ABC Supply"
- "PO for $1500 electrical supplies"

---

## 4. Customer & Project Information

### ✅ **Update Customer Information**
**Command:** `update_customer_info`

**What it does:** Updates customer/client contact information for projects

**Usage Examples:**
- "Update customer email to john@example.com for chris remodel"
- "Set customer phone to 702-555-1234"
- "Update customer address: 123 Main St, Las Vegas, NV 89101"

**Fields You Can Update:**
- Customer name
- Email
- Phone
- Company
- Address (street, city, state, zip)
- Notes

**Smart Features:**
- Parses full addresses automatically
- Updates only the fields you specify
- Works for both estimates and active projects

---

### ✅ **Update Project Details**
**Command:** `update_project_details`

**What it does:** Updates project information like budget range, scope description, and dates

**Usage Examples:**
- "Set budget range to $25k-$50k"
- "Update project start date to December 15th"
- "Set project duration to 30 days"
- "Update scope description: Full kitchen remodel with new cabinets and countertops"

**Fields You Can Update:**
- Budget range: `under-10k`, `10k-25k`, `25k-50k`, `50k-100k`, `over-100k`, `flexible`
- Scope description
- Start date (parses natural language like "December 15th", "next Monday")
- End date

---

## 5. Research & Search Tools

### ✅ **Search Contractors/Subcontractors**
**Command:** `search_contractors`

**What it does:** Finds contractors and subcontractors using Yelp API + app users + lead campaigns

**Usage Examples:**
- "Can you find me contractors for plumbing?"
- "Find electrical contractors near me"
- "Search for HVAC contractors"
- "Find me a tile contractor"

**Key Features:**
- ✅ Searches Yelp API for real contractor data (ratings, reviews, contact info)
- ✅ Includes app users who are contractors
- ✅ Includes lead campaign creators (people looking for work)
- ✅ Prioritizes results: Campaigns > App Users > Yelp (then by rating)
- ✅ Shows ratings, review counts, location, contact information

**Supported Trade Types:**
- Plumbing
- Electrical
- HVAC
- Framing
- Tile
- Drywall
- Roofing
- Painting
- Concrete
- General Contractor

**Note:** If you don't specify a trade type, AI will ask what type of contractor you need.

---

## 6. Payment & Timeline Management

### ✅ **Add Payment Milestone**
**Command:** `add_payment_milestone`

**What it does:** Adds a payment milestone to an estimate/project

**Usage Examples:**
- "Add a 30% deposit milestone for December 15th"
- "Add milestone: Framing Complete, $5000, due January 10th"
- "Add final payment milestone, 20%, on completion date"

**Required Information:**
- Project name (AI will ask if unclear)
- Milestone name (AI will ask if unclear)
- Payment amount OR percentage (AI will ask if missing)
- Scheduled date (AI will ask if missing)

**Common Milestones:**
- Deposit
- Start of Work
- Framing Complete
- Drywall Complete
- Final Payment

**Features:**
- ✅ Can add multiple milestones in one conversation
- ✅ Payments appear immediately in the estimate
- ✅ Supports both dollar amounts and percentages

---

### ✅ **Add Weekly Payment**
**Command:** `add_weekly_payment`

**What it does:** Adds a weekly progress payment to an estimate/project

**Usage Examples:**
- "Add weekly payment: $2500, due December 12th"
- "Add week 2 payment, 25%, due next Friday"
- "Add payments for weeks 2, 3, and 4, $2000 each"

**Required Information:**
- Project name (AI will ask if unclear)
- Payment amount OR percentage (AI will ask if missing)
- Scheduled date (AI will ask if missing)

**Features:**
- ✅ Week numbers auto-increment if not specified
- ✅ Can add multiple weekly payments at once (AI calls tool multiple times)
- ✅ Payments appear immediately in the estimate
- ✅ Supports both dollar amounts and percentages

---

### ✅ **Set Payment Schedule Type**
**Command:** `set_payment_schedule_type`

**What it does:** Sets whether payments are milestone-based or weekly

**Usage Examples:**
- "Set payment schedule to weekly for chris remodel"
- "Use milestone-based payments"
- "Change to weekly payment schedule"

**Options:**
- `milestone-based`
- `weekly`

---

### ✅ **Set Work Schedule**
**Command:** `set_work_schedule`

**What it does:** Sets work schedule preference (weekdays only or flexible)

**Usage Examples:**
- "Set work schedule to weekdays only"
- "Use flexible work schedule"
- "Work schedule: weekdays only for chris remodel"

**Options:**
- `weekdays` - Monday through Friday only
- `flexible` - Including weekends

---

### ✅ **Set Project Timeline**
**Command:** `set_project_timeline`

**What it does:** Sets project start date and/or duration

**Usage Examples:**
- "Project starts December 15th"
- "Set start date to next Monday, duration 30 days"
- "Project will take 4 weeks"
- "Set timeline: start December 1st, duration 45 days"

**Features:**
- ✅ Parses natural language dates ("December 15th", "next Monday", "in 2 weeks")
- ✅ Can set start date, duration, or both
- ✅ Asks for project name if unclear

---

### ✅ **Update Timeline Milestone**
**Command:** `update_timeline_milestone`

**What it does:** Updates milestone status, progress, or dates

**Usage Examples:**
- "Mark Framing Complete milestone as done"
- "Update milestone progress to 75%"
- "Change milestone date to December 20th"

---

## 7. Contract Management

### ✅ **Share Contract via Email/Text**
**Command:** `share_contract`

**What it does:** Generates contract PDF and shares it via email or text message

**Usage Examples:**
- "Share the contract for chris remodel via email"
- "Send contract to customer@example.com"
- "Text the contract to 702-555-1234"

**Required Information:**
- Project name (AI will ask if unclear)
- Share method: email or text (AI will ask)
- Email address or phone number (AI will ask)

**Features:**
- ✅ Generates professional PDF contract from estimate data
- ✅ Opens email/messaging app with recipient pre-filled
- ✅ Shows share sheet to attach PDF
- ✅ Includes all estimate details, materials, labor, payment schedule

---

### ✅ **Show Contract in Chat**
**Command:** `show_contract`

**What it does:** Generates and displays the contract PDF in the AI chat

**Usage Examples:**
- "Show me the final contract for chris remodel"
- "Show me the estimate"
- "Display the contract"
- "Let me see the final estimate"

**Features:**
- ✅ Generates PDF contract
- ✅ Displays it as a clickable attachment in chat
- ✅ Tap to view in PDF viewer
- ✅ Works even if project isn't currently open

**Note:** If project name is unclear, AI will ask which project.

---

## 8. Project Analysis

### ✅ **Summarize Project**
**Command:** `summarize_project`

**What it does:** Provides a comprehensive summary of a project

**Includes:**
- Project scope
- Current phase/status
- Milestones and progress
- Budget vs. actual spending
- Important notes and updates

---

### ✅ **Calculate Project Profitability**
**Command:** `calculate_project_profitability`

**What it does:** Analyzes profit, margins, and budget performance

**Provides:**
- Current profit/loss
- Margin analysis
- Over/under budget status
- Recommendations

---

### ✅ **Identify Project Risks**
**Command:** `identify_project_risks`

**What it does:** Analyzes potential risks and red flags

**Considers:**
- Schedule delays
- Budget overruns
- Missing approvals
- Unbilled change orders
- Cash flow issues

---

### ✅ **Suggest Missing Costs**
**Command:** `suggest_missing_costs`

**What it does:** Suggests cost categories that might be missing from estimates

**Common Suggestions:**
- Permits
- Dumpsters
- Cleanup
- Supervision
- Administrative overhead
- Consumables
- Contingencies

**Note:** Only suggests - never adds automatically.

---

### ✅ **Add Project Note**
**Command:** `add_project_note`

**What it does:** Logs notes, daily logs, delay reasons, inspection results, or any project comments

**Usage Examples:**
- "Add note: Site visit completed, foundation looks good"
- "Log delay: Weather delayed roofing by 2 days"
- "Inspection passed on December 5th"

---

## 🎯 Smart Features Across All Commands

### **Project Identification**
- AI asks "Which project is this for?" if the project name is unclear
- Matches project names flexibly (case-insensitive, partial matching)
- Searches through all available projects (active + estimates)

### **Clarification Questions**
- **Materials:** If you say "add $500 for material" without specifying what, AI asks "What material is this for?"
- **Labor:** If you say "add sub labor" without type, AI asks "What type of labor is this for?"
- **Vague Requests:** AI asks for missing required information before proceeding

### **Context Awareness**
- Uses current estimate data when available
- Extracts location/ZIP from projects for searches
- Understands project status (draft vs. active) and uses appropriate tools

### **Error Handling**
- Provides clear error messages if something fails
- Shows available projects when a project isn't found
- Handles missing data gracefully

---

## 📊 Command Summary Count

**Total AI Commands: 24**

- **Project Management:** 1 command
- **Materials & Labor:** 3 commands
- **Financial:** 3 commands
- **Customer & Project Info:** 2 commands
- **Research & Search:** 2 commands
- **Payment & Timeline:** 6 commands
- **Contract Management:** 2 commands
- **Project Analysis:** 4 commands

---

## 🔄 Workflow Examples

### **Creating a Complete Estimate:**
1. "Create new estimate for Josh's kitchen remodel"
2. "Add customer info: email josh@example.com, phone 702-555-1234"
3. "Add $5000 for cabinets"
4. "Add $3000 for plumbing labor"
5. "Add $2000 for tile material"
6. "Set markup to 18%"
7. "Add 30% deposit milestone for December 15th"
8. "Add weekly payments: $2000 each week for 4 weeks"
9. "Show me the final contract"

### **Finding Contractors:**
1. "Find me contractors for plumbing"
2. AI searches Yelp + app users + campaigns
3. Returns top-rated contractors with contact info

### **Price Comparison:**
1. "Where is 60 pound concrete cheaper, Home Depot or Lowe's?"
2. AI searches both stores
3. Returns comparison with prices and links

---

## ✅ Status: All Commands Fully Implemented

All 24 commands are:
- ✅ Fully functional
- ✅ Integrated with the mobile app
- ✅ Include error handling
- ✅ Have confirmation dialogs
- ✅ Update app state immediately
- ✅ Persist data to storage

---

## 📝 Notes

- All commands work in natural language - just talk to the AI like you're talking to a project manager
- The AI will ask clarifying questions if information is missing
- All changes are saved automatically
- The AI understands context (e.g., which estimate you're currently viewing)
- Most commands work for both draft estimates and active projects (using appropriate tools)

---

*Last Updated: December 2024*





