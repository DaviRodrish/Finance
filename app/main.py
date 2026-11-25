from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from . import models, schemas, crud
from .database import engine, get_db
from .auth import get_current_user_id

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Controle Financeiro API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/entities", response_model=List[schemas.EntityOut])
def list_entities(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return db.query(models.Entity).filter(models.Entity.user_id == user_id).all()


@app.post("/entities", response_model=schemas.EntityOut)
def create_entity(
    payload: schemas.EntityCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    exists = (
        db.query(models.Entity)
        .filter(models.Entity.user_id == user_id, models.Entity.name == payload.name)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Entidade já cadastrada")
    entity = models.Entity(**payload.model_dump(), user_id=user_id)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@app.post("/expenses", status_code=201)
def create_expense(
    payload: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entity = (
        db.query(models.Entity)
        .filter(models.Entity.id == payload.entity_id, models.Entity.user_id == user_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Pessoa/Categoria não encontrada")
    expense = crud.create_expense_with_entries(db, payload, user_id)
    return {"id": expense.id, "message": "Lançamento e parcelas criados com sucesso"}


@app.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    expense = (
        db.query(models.Expense)
        .filter(models.Expense.id == expense_id, models.Expense.user_id == user_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    db.delete(expense)
    db.commit()
    return {"message": "Lançamento e todas as parcelas removidos"}


@app.patch("/entries/{entry_id}", response_model=schemas.MonthlyEntryOut)
def update_entry(
    entry_id: int,
    payload: schemas.MonthlyEntryUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entry = (
        db.query(models.MonthlyEntry)
        .filter(models.MonthlyEntry.id == entry_id, models.MonthlyEntry.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Registro não encontrado")

    if payload.status is not None:
        entry.status = payload.status
    if payload.amount is not None:
        entry.amount = payload.amount
    if payload.description is not None:
        entry.description = payload.description

    db.commit()
    db.refresh(entry)
    return entry


@app.post("/entries/pay-entity")
def pay_all_for_entity(
    reference_month: str,
    entity_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entries = (
        db.query(models.MonthlyEntry)
        .filter(
            models.MonthlyEntry.user_id == user_id,
            models.MonthlyEntry.reference_month == reference_month,
            models.MonthlyEntry.entity_id == entity_id,
        )
        .all()
    )
    for e in entries:
        e.status = models.EntryStatus.PAID
    db.commit()
    return {"updated": len(entries)}


@app.put("/income")
def upsert_income(
    payload: schemas.IncomeUpsert,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    record = (
        db.query(models.MonthlyIncome)
        .filter(
            models.MonthlyIncome.user_id == user_id,
            models.MonthlyIncome.reference_month == payload.reference_month,
        )
        .first()
    )
    if record:
        record.amount = payload.amount
    else:
        record = models.MonthlyIncome(**payload.model_dump(), user_id=user_id)
        db.add(record)
    db.commit()
    return {"reference_month": payload.reference_month, "amount": payload.amount}


@app.get("/dashboard/{reference_month}", response_model=schemas.DashboardResponse)
def get_dashboard(
    reference_month: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return crud.get_monthly_dashboard(db, reference_month, user_id)