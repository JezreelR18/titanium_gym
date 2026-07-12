from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.modules.auth.router import router as auth_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.users.router import router as users_router
from app.modules.members.router import router as members_router
from app.modules.memberships.router import router as memberships_router
from app.modules.sales.router import router as sales_router
from app.modules.classes.router import router as classes_router
from app.modules.attendance.router import router as attendance_router
from app.modules.training.router import router as training_router
from app.modules.notifications.router import router as notifications_router
from app.modules.inventory.router import router as inventory_router
from app.modules.lockers.router import router as lockers_router
from app.modules.cash_register.router import router as cash_register_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,          prefix="/api/auth",          tags=["Auth"])
app.include_router(dashboard_router,     prefix="/api/dashboard",     tags=["Dashboard"])
app.include_router(users_router,         prefix="/api/users",         tags=["Users"])
app.include_router(members_router,       prefix="/api/members",       tags=["Members"])
app.include_router(memberships_router,   prefix="/api/memberships",   tags=["Memberships"])
app.include_router(sales_router,         prefix="/api/sales",         tags=["Sales"])
app.include_router(classes_router,       prefix="/api/classes",       tags=["Classes"])
app.include_router(attendance_router,    prefix="/api/attendance",    tags=["Attendance"])
app.include_router(training_router,      prefix="/api/training",      tags=["Training"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(inventory_router,     prefix="/api/inventory",     tags=["Inventory"])
app.include_router(lockers_router,         prefix="/api/lockers",         tags=["Lockers"])
app.include_router(cash_register_router,  prefix="/api/cash-register",   tags=["CashRegister"])


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}
