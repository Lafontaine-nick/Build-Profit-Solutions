from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import openai
import os
import jwt
import uuid
from datetime import datetime, timedelta
import json

app = FastAPI(title="Build Profit Solutions API", version="1.0.0")

# CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your mobile app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

# Mock database (replace with real database in production)
users_db = {}
projects_db = {}
subcontractors_db = {}
clients_db = {}

# Models
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    company: Optional[str] = None
    role: str = "Contractor"
    location: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str
    name: str
    email: str
    company: Optional[str] = None
    role: str
    location: Optional[str] = None
    experience: Optional[int] = None
    avatar: Optional[str] = None
    joinDate: str
    totalProjects: int = 0
    completedProjects: int = 0
    activeProjects: int = 0
    totalRevenue: float = 0
    averageRating: float = 0
    reviewCount: int = 0
    licenses: List[str] = []
    insurance: Dict[str, bool] = {}
    certifications: List[str] = []
    preferences: Dict[str, Any] = {}

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: str
    projectType: str
    squareFootage: Optional[int] = None
    materialGrade: Optional[str] = None
    markupPercentage: Optional[float] = None
    timelineMonths: Optional[int] = None

class Project(BaseModel):
    id: str
    name: str
    status: str = "Draft"
    margin: float = 0
    location: str
    description: Optional[str] = None
    clientName: Optional[str] = None
    projectType: str
    squareFootage: Optional[int] = None
    materialGrade: Optional[str] = None
    markupPercentage: Optional[float] = None
    timelineMonths: Optional[int] = None
    estimatedCost: Optional[float] = None
    bidPrice: Optional[float] = None
    createdAt: str
    updatedAt: str
    materials: List[Dict[str, Any]] = []
    equipment: List[Dict[str, Any]] = []
    labor: List[Dict[str, Any]] = []
    overhead: Dict[str, Any] = {}
    finalBid: Dict[str, Any] = {}

class Subcontractor(BaseModel):
    id: str
    name: str
    specialty: str
    rating: float
    reviewCount: int
    hourlyRate: float
    experience: int
    location: str
    availability: str
    insurance: str
    bonded: str
    licensed: str
    completedProjects: int
    responseTime: str
    profileImage: str
    description: str
    certifications: List[str]
    portfolio: List[Dict[str, Any]]
    reviews: List[Dict[str, Any]]

class ClientCreate(BaseModel):
    name: str
    email: str
    phone: str
    address: str
    type: str
    notes: Optional[str] = None

class Client(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    address: str
    type: str
    totalProjects: int = 0
    totalRevenue: float = 0
    lastProject: Optional[str] = None
    notes: Optional[str] = None

class EstimateRequest(BaseModel):
    project_type: str
    sq_ft: int
    zip_code: str
    material_grade: str
    markup_pct: float
    timeline_months: int

class EstimateResponse(BaseModel):
    cost_breakdown: Dict[str, Any]
    bid_price: float
    forecasted_inflation: float
    profit_margin: float

class Analytics(BaseModel):
    monthlyRevenue: List[Dict[str, Any]]
    projectStats: Dict[str, Any]
    performanceMetrics: Dict[str, Any]

# Authentication functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Initialize mock data
def init_mock_data():
    # Mock users
    users_db["1"] = User(
        id="1",
        name="John Smith",
        email="john.smith@email.com",
        company="Smith Construction Co.",
        role="General Contractor",
        location="San Diego, CA",
        experience=8,
        avatar="https://via.placeholder.com/100",
        joinDate="2023-01-15",
        totalProjects=47,
        completedProjects=42,
        activeProjects=5,
        totalRevenue=1250000,
        averageRating=4.8,
        reviewCount=156,
        licenses=["General Contractor License", "Electrical License", "Plumbing License"],
        insurance={
            "generalLiability": True,
            "workersComp": True,
            "autoInsurance": True,
            "umbrellaPolicy": True
        },
        certifications=["OSHA Safety Certified", "LEED Green Associate", "First Aid Certified"],
        preferences={
            "notifications": True,
            "emailUpdates": True,
            "smsAlerts": False,
            "marketingEmails": False,
            "darkMode": True,
            "language": "English",
            "currency": "USD",
            "timezone": "PST"
        }
    )

    # Mock projects
    projects_db["1"] = Project(
        id="1",
        name="Main St Remodel",
        status="Draft",
        margin=12,
        location="San Diego, CA",
        projectType="Residential Remodel",
        createdAt="2024-01-15T10:00:00Z",
        updatedAt="2024-01-15T10:00:00Z"
    )

    # Mock subcontractors
    subcontractors_db["1"] = Subcontractor(
        id="1",
        name="Mike's Electrical Services",
        specialty="Electrical",
        rating=4.8,
        reviewCount=127,
        hourlyRate=65,
        experience=12,
        location="San Diego, CA",
        availability="Available",
        insurance="Yes",
        bonded="Yes",
        licensed="Yes",
        completedProjects=234,
        responseTime="2 hours",
        profileImage="https://via.placeholder.com/60",
        description="Licensed electrical contractor with 12+ years experience.",
        certifications=["Licensed Electrician", "OSHA Certified", "First Aid Certified"],
        portfolio=[],
        reviews=[]
    )

    # Mock clients
    clients_db["1"] = Client(
        id="1",
        name="John Smith",
        email="john.smith@email.com",
        phone="(555) 123-4567",
        address="123 Main St, San Diego, CA 92101",
        type="Residential",
        totalProjects=3,
        totalRevenue=45000,
        lastProject="2024-03-15"
    )

init_mock_data()

# Authentication endpoints
@app.post("/auth/login")
async def login(user_credentials: UserLogin):
    # Mock authentication - in production, verify against database
    if user_credentials.email == "john.smith@email.com" and user_credentials.password == "password":
        user = users_db["1"]
        access_token = create_access_token(data={"sub": user.id})
        return {
            "token": access_token,
            "user": user
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/auth/register")
async def register(user_data: UserCreate):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        name=user_data.name,
        email=user_data.email,
        company=user_data.company,
        role=user_data.role,
        location=user_data.location,
        joinDate=datetime.utcnow().isoformat(),
        preferences={
            "notifications": True,
            "emailUpdates": True,
            "smsAlerts": False,
            "marketingEmails": False,
            "darkMode": False,
            "language": "English",
            "currency": "USD",
            "timezone": "UTC"
        }
    )
    users_db[user_id] = user
    access_token = create_access_token(data={"sub": user_id})
    return {
        "token": access_token,
        "user": user
    }

@app.get("/auth/me")
async def get_current_user(user_id: str = Depends(verify_token)):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    return users_db[user_id]

@app.get("/auth/check")
async def check_auth_status():
    """Check if user is authenticated without requiring a token"""
    return {"authenticated": False, "message": "No active session"}

@app.post("/auth/logout")
async def logout():
    # In production, you might want to blacklist the token
    return {"message": "Logged out successfully"}

# Project endpoints
@app.get("/projects")
async def get_projects(user_id: str = Depends(verify_token)):
    # Return projects for the authenticated user
    return list(projects_db.values())

@app.get("/projects/public")
async def get_public_projects():
    """Get projects without requiring authentication (for demo purposes)"""
    return list(projects_db.values())

@app.get("/projects/{project_id}")
async def get_project(project_id: str, user_id: str = Depends(verify_token)):
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    return projects_db[project_id]

@app.post("/projects")
async def create_project(project_data: ProjectCreate, user_id: str = Depends(verify_token)):
    project_id = str(uuid.uuid4())
    project = Project(
        id=project_id,
        name=project_data.name,
        description=project_data.description,
        location=project_data.location,
        projectType=project_data.projectType,
        squareFootage=project_data.squareFootage,
        materialGrade=project_data.materialGrade,
        markupPercentage=project_data.markupPercentage,
        timelineMonths=project_data.timelineMonths,
        createdAt=datetime.utcnow().isoformat(),
        updatedAt=datetime.utcnow().isoformat()
    )
    projects_db[project_id] = project
    return project

@app.put("/projects/{project_id}")
async def update_project(project_id: str, project_data: dict, user_id: str = Depends(verify_token)):
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = projects_db[project_id]
    for key, value in project_data.items():
        if hasattr(project, key):
            setattr(project, key, value)
    
    project.updatedAt = datetime.utcnow().isoformat()
    projects_db[project_id] = project
    return project

@app.delete("/projects/{project_id}")
async def delete_project(project_id: str, user_id: str = Depends(verify_token)):
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="Project not found")
    
    del projects_db[project_id]
    return {"message": "Project deleted successfully"}

# Estimate generation endpoint
@app.post("/generate-estimate", response_model=EstimateResponse)
async def generate_estimate(request: EstimateRequest):
    # Set your OpenAI API key here or use environment variable
    openai.api_key = os.getenv("OPENAI_API_KEY", "your-openai-api-key")
    
    prompt = f"""
    You are a construction cost estimator. Given the following project details, provide:
    1. A suggested cost breakdown (as a JSON object with keys for labor, materials, permits, etc.)
    2. A bid price (float)
    3. A forecasted inflation percentage for the timeline (float)
    4. An estimated profit margin (float)

    Project details:
    - Project type: {request.project_type}
    - Square footage: {request.sq_ft}
    - Zip code: {request.zip_code}
    - Material grade: {request.material_grade}
    - Markup percentage: {request.markup_pct}
    - Timeline (months): {request.timeline_months}

    Respond in the following JSON format:
    {{
        "cost_breakdown": {{"labor": ..., "materials": ..., "permits": ..., ...}},
        "bid_price": ...,
        "forecasted_inflation": ...,
        "profit_margin": ...
    }}
    """
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.3
        )
        content = response.choices[0].message["content"]
        # Try to parse the response as JSON
        data = json.loads(content)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

# Subcontractor endpoints
@app.get("/subcontractors")
async def get_subcontractors(
    specialty: Optional[str] = None,
    location: Optional[str] = None,
    price_range: Optional[str] = None,
    rating: Optional[float] = None,
    availability: Optional[bool] = None,
    insurance: Optional[bool] = None,
    licensed: Optional[bool] = None
):
    subcontractors = list(subcontractors_db.values())
    
    # Apply filters
    if specialty and specialty != "All Specialties":
        subcontractors = [s for s in subcontractors if s.specialty == specialty]
    
    if location and location != "All Locations":
        subcontractors = [s for s in subcontractors if s.location == location]
    
    if rating:
        subcontractors = [s for s in subcontractors if s.rating >= rating]
    
    if availability:
        subcontractors = [s for s in subcontractors if s.availability == "Available"]
    
    if insurance:
        subcontractors = [s for s in subcontractors if s.insurance == "Yes"]
    
    if licensed:
        subcontractors = [s for s in subcontractors if s.licensed == "Yes"]
    
    return subcontractors

@app.get("/subcontractors/{subcontractor_id}")
async def get_subcontractor(subcontractor_id: str):
    if subcontractor_id not in subcontractors_db:
        raise HTTPException(status_code=404, detail="Subcontractor not found")
    return subcontractors_db[subcontractor_id]

@app.post("/subcontractors/{subcontractor_id}/book")
async def book_subcontractor(subcontractor_id: str, booking_data: dict, user_id: str = Depends(verify_token)):
    if subcontractor_id not in subcontractors_db:
        raise HTTPException(status_code=404, detail="Subcontractor not found")
    
    # In production, create a booking record
    return {
        "bookingId": str(uuid.uuid4()),
        "message": f"Booking request sent to {subcontractors_db[subcontractor_id].name}"
    }

# Client endpoints
@app.get("/clients")
async def get_clients(user_id: str = Depends(verify_token)):
    return list(clients_db.values())

@app.post("/clients")
async def create_client(client_data: ClientCreate, user_id: str = Depends(verify_token)):
    client_id = str(uuid.uuid4())
    client = Client(
        id=client_id,
        name=client_data.name,
        email=client_data.email,
        phone=client_data.phone,
        address=client_data.address,
        type=client_data.type,
        notes=client_data.notes
    )
    clients_db[client_id] = client
    return client

@app.put("/clients/{client_id}")
async def update_client(client_id: str, client_data: dict, user_id: str = Depends(verify_token)):
    if client_id not in clients_db:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client = clients_db[client_id]
    for key, value in client_data.items():
        if hasattr(client, key):
            setattr(client, key, value)
    
    clients_db[client_id] = client
    return client

@app.delete("/clients/{client_id}")
async def delete_client(client_id: str, user_id: str = Depends(verify_token)):
    if client_id not in clients_db:
        raise HTTPException(status_code=404, detail="Client not found")
    
    del clients_db[client_id]
    return {"message": "Client deleted successfully"}

# Analytics endpoints
@app.get("/analytics")
async def get_analytics(user_id: str = Depends(verify_token)):
    # Mock analytics data
    return Analytics(
        monthlyRevenue=[
            {"month": "Jan", "revenue": 85000},
            {"month": "Feb", "revenue": 92000},
            {"month": "Mar", "revenue": 88000},
            {"month": "Apr", "revenue": 95000},
            {"month": "May", "revenue": 102000},
            {"month": "Jun", "revenue": 98000},
            {"month": "Jul", "revenue": 105000},
            {"month": "Aug", "revenue": 112000},
            {"month": "Sep", "revenue": 108000},
            {"month": "Oct", "revenue": 115000},
            {"month": "Nov", "revenue": 118000},
            {"month": "Dec", "revenue": 125000}
        ],
        projectStats={
            "total": 47,
            "completed": 42,
            "active": 5,
            "cancelled": 2,
            "winRate": 89.4
        },
        performanceMetrics={
            "averageProjectValue": 26500,
            "averageProjectDuration": 45,
            "customerSatisfaction": 4.8,
            "repeatCustomerRate": 78.5
        }
    )

@app.get("/analytics/public")
async def get_public_analytics():
    """Get analytics without requiring authentication (for demo purposes)"""
    return Analytics(
        monthlyRevenue=[
            {"month": "Jan", "revenue": 85000},
            {"month": "Feb", "revenue": 92000},
            {"month": "Mar", "revenue": 88000},
            {"month": "Apr", "revenue": 95000},
            {"month": "May", "revenue": 102000},
            {"month": "Jun", "revenue": 98000},
            {"month": "Jul", "revenue": 105000},
            {"month": "Aug", "revenue": 112000},
            {"month": "Sep", "revenue": 108000},
            {"month": "Oct", "revenue": 115000},
            {"month": "Nov", "revenue": 118000},
            {"month": "Dec", "revenue": 125000}
        ],
        projectStats={
            "total": 47,
            "completed": 42,
            "active": 5,
            "cancelled": 2,
            "winRate": 89.4
        },
        performanceMetrics={
            "averageProjectValue": 26500,
            "averageProjectDuration": 45,
            "customerSatisfaction": 4.8,
            "repeatCustomerRate": 78.5
        }
    )

# Profile endpoints
@app.put("/profile")
async def update_profile(profile_data: dict, user_id: str = Depends(verify_token)):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_db[user_id]
    for key, value in profile_data.items():
        if hasattr(user, key):
            setattr(user, key, value)
    
    users_db[user_id] = user
    return user

@app.put("/profile/preferences")
async def update_preferences(preferences: dict, user_id: str = Depends(verify_token)):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_db[user_id]
    user.preferences.update(preferences)
    users_db[user_id] = user
    return user

# File upload endpoint
@app.post("/upload")
async def upload_file(file: Any, project_id: Optional[str] = None, user_id: str = Depends(verify_token)):
    # In production, handle file upload to cloud storage
    return {
        "fileId": str(uuid.uuid4()),
        "url": "https://example.com/uploaded-file.pdf"
    }

# Notification endpoints
@app.get("/notifications")
async def get_notifications(user_id: str = Depends(verify_token)):
    # Mock notifications
    return [
        {
            "id": "1",
            "title": "New Project Opportunity",
            "message": "A new project matching your profile is available.",
            "type": "info",
            "read": False,
            "createdAt": datetime.utcnow().isoformat()
        }
    ]

@app.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str = Depends(verify_token)):
    return {"message": "Notification marked as read"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 