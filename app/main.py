from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import entities, expenses, receivables, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Controle Financeiro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(entities.router)
app.include_router(expenses.router)
app.include_router(receivables.router)
app.include_router(reports.router)