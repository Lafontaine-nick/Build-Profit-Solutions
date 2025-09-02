# Build Profit Solutions - Lead Generation Backend

A powerful Express.js backend with AI-powered lead scoring for construction companies.

## 🚀 Features

- **AI Lead Scoring**: GPT-4 powered lead analysis and prioritization
- **RESTful API**: Complete CRUD operations for lead management
- **Analytics**: Comprehensive lead analytics and reporting
- **Rate Limiting**: Built-in protection against abuse
- **Validation**: Request validation and error handling
- **CORS Support**: Cross-origin resource sharing for mobile app

## 📋 Prerequisites

- Node.js 18+ 
- OpenAI API key
- npm or yarn

## 🛠️ Installation

1. **Clone and navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

4. **Start the server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔧 API Endpoints

### Lead Management

- `GET /api/leads` - Get all leads with optional filtering
- `POST /api/leads` - Create a new lead
- `GET /api/leads/:id` - Get a specific lead
- `PUT /api/leads/:id` - Update a lead
- `DELETE /api/leads/:id` - Delete a lead

### AI Scoring

- `POST /api/leads/score` - Score a lead using AI

### Analytics

- `GET /api/leads/analytics` - Get lead analytics

### Lead Actions

- `POST /api/leads/:id/notes` - Add note to lead
- `POST /api/leads/:id/follow-up` - Schedule follow-up
- `POST /api/leads/:id/convert` - Convert lead to project

## 🤖 AI Lead Scoring

The system uses OpenAI GPT-4 to intelligently score leads based on:

- **Budget Analysis** (0-25 points): Project size and budget range
- **Timeline Assessment** (0-20 points): Urgency and project duration
- **Project Complexity** (0-15 points): Type and scope of work
- **Market Analysis** (0-15 points): Location and market conditions
- **Requirements Clarity** (0-15 points): Completeness of project details
- **Lead Source Quality** (0-10 points): Source reliability and conversion potential

## 📊 Sample Data

The system includes sample leads for testing:

- **John Smith**: High-value residential renovation ($250k-$350k)
- **Sarah Johnson**: Large commercial project ($500k-$750k)
- **Mike Wilson**: Medium renovation project ($75k-$120k)

## 🔒 Security Features

- **Helmet**: Security headers
- **Rate Limiting**: 100 requests per 15 minutes
- **CORS**: Configured for mobile app
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Structured error responses

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📈 Analytics

The analytics endpoint provides:

- Total lead count
- Status breakdown
- Source distribution
- Priority analysis
- Conversion rate
- Average lead score
- Monthly trends

## 🔄 Database Integration

Currently uses in-memory storage. To integrate with a database:

1. Update `src/services/leadStorage.js`
2. Add database connection in `src/server.js`
3. Update environment variables

## 🚀 Deployment

1. **Set environment variables:**
   ```
   NODE_ENV=production
   PORT=3001
   OPENAI_API_KEY=your_production_key
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

## 📱 Mobile App Integration

The backend is designed to work seamlessly with the React Native mobile app:

- CORS configured for mobile development
- JSON responses optimized for mobile consumption
- Error handling compatible with mobile error boundaries

## 🔧 Configuration

Key environment variables:

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `OPENAI_API_KEY`: OpenAI API key for AI scoring
- `FRONTEND_URL`: Mobile app URL for CORS

## 📝 API Documentation

### Lead Object Structure

```json
{
  "id": "lead_1",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "555-0123",
  "company": "Smith Construction",
  "projectType": "residential",
  "projectSize": "large",
  "budget": {
    "min": 250000,
    "max": 350000,
    "currency": "USD"
  },
  "timeline": {
    "startDate": "2024-03-01",
    "duration": 12,
    "urgency": "medium"
  },
  "location": {
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701"
  },
  "requirements": "Complete home renovation...",
  "source": "referral",
  "status": "qualified",
  "score": 85,
  "priority": "high",
  "notes": ["Excellent referral"],
  "tags": ["high-value"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:45:00Z"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details 