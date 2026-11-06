from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.db import connect_to_mongo, close_mongo_connection
from app.routers import (
    auth, users, cohorts, nominations, assignments, templates, mentor, dashboards, talentnext, admin_users, nominator, nominations_v2, batches, sessions
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Custom Exception Handlers for consistent {detail, code} format
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    code = getattr(exc, "headers", {}).get("code") if hasattr(exc, "headers") and exc.headers else None
    if not code:
        if exc.status_code == 404:
            code = "NOT_FOUND"
        elif exc.status_code == 401:
            code = "UNAUTHORIZED"
        elif exc.status_code == 403:
            code = "FORBIDDEN"
        elif exc.status_code == 400:
            code = "BAD_REQUEST"
        else:
            code = "ERROR"
            
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": code}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    msg = first_error.get("msg", "Invalid input data")
    field = ".".join(str(x) for x in first_error.get("loc", []))
    detail = f"{msg} (at {field})" if field else msg
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": detail, "code": "VALIDATION_ERROR"}
    )

# Include Routers under /api
api_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(cohorts.router, prefix=api_prefix)
app.include_router(nominations.router, prefix=api_prefix)
app.include_router(nominations_v2.router, prefix=api_prefix)
app.include_router(batches.router, prefix=api_prefix)
app.include_router(sessions.router, prefix=api_prefix)
app.include_router(assignments.router, prefix=api_prefix)
app.include_router(templates.router, prefix=api_prefix)
app.include_router(mentor.router, prefix=api_prefix)
app.include_router(dashboards.router, prefix=api_prefix)
app.include_router(talentnext.router, prefix=api_prefix)
app.include_router(admin_users.router, prefix=api_prefix)
app.include_router(nominator.router, prefix=api_prefix)

@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}
