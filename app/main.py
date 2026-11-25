from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from . import models, schemas, crud
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Controle Financeiro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, restrinja para a URL do seu frontend na Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Entidades (Pessoas / Categorias) ---
@app.get("/entities", response_model=List[schemas.EntityOut])
def list_entities(db: Session = Depends(get_db)):
    return db.query(models.Entity).all()


@app.post("/entities", response_model=schemas.EntityOut)
def create_entity(payload: schemas.EntityCreate, db: Session = Depends(get_db)):
    exists = db.query(models.Entity).filter(models.Entity.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Entidade já cadastrada")
    entity = models.Entity(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


# --- Lançamentos ---
@app.post("/expenses", status_code=201)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    entity = db.query(models.Entity).filter(models.Entity.id == payload.entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Pessoa/Categoria não encontrada")
    expense = crud.create_expense_with_entries(db, payload)
    return {"id": expense.id, "message": "Lançamento e parcelas criados com sucesso"}


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    db.delete(expense)
    db.commit()
    return {"message": "Lançamento e todas as parcelas removidos"}


# --- Parcelas / Entradas Mensais ---
@app.patch("/entries/{entry_id}", response_model=schemas.MonthlyEntryOut)
def update_entry(entry_id: int, payload: schemas.MonthlyEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(models.MonthlyEntry).filter(models.MonthlyEntry.id == entry_id).first()
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
def pay_all_for_entity(reference_month: str, entity_id: int, db: Session = Depends(get_db)):
    """Marca todas as contas de uma pessoa (ex: Carol) no mês como pagas de uma vez."""
    entries = (
        db.query(models.MonthlyEntry)
        .filter(
            models.MonthlyEntry.reference_month == reference_month,
            models.MonthlyEntry.entity_id == entity_id,
        )
        .all()
    )
    for e in entries:
        e.status = models.EntryStatus.PAID
    db.commit()
    return {"updated": len(entries)}


# --- Ganhos (Receita Mensal) ---
@app.put("/income")
def upsert_income(payload: schemas.IncomeUpsert, db: Session = Depends(get_db)):
    record = (
        db.query(models.MonthlyIncome)
        .filter(models.MonthlyIncome.reference_month == payload.reference_month)
        .first()
    )
    if record:
        record.amount = payload.amount
    else:
        record = models.MonthlyIncome(**payload.model_dump())
        db.add(record)
    db.commit()
    return {"reference_month": payload.reference_month, "amount": payload.amount}


# --- Dashboard & KPIs ---
@app.get("/dashboard/{reference_month}", response_model=schemas.DashboardResponse)
def get_dashboard(reference_month: str, db: Session = Depends(get_db)):
    return crud.get_monthly_dashboard(db, reference_month)

@app.post("/seed/sheet")
def seed_from_sheet(reference_month: str = "2026-11", db: Session = Depends(get_db)):
    entities_data = [
        ("Carol", "#2563EB"),
        ("Mamãe", "#EF4444"),
        ("Academia", "#F59E0B"),
        ("Dh", "#10B981"),
    ]
    created_entities = {}
    for name, color in entities_data:
        ent = db.query(models.Entity).filter(models.Entity.name == name).first()
        if not ent:
            ent = models.Entity(name=name, color=color)
            db.add(ent)
            db.flush()
        created_entities[name] = ent.id

    # Ganhos do mês
    inc = db.query(models.MonthlyIncome).filter(models.MonthlyIncome.reference_month == reference_month).first()
    if not inc:
        db.add(models.MonthlyIncome(reference_month=reference_month, amount=Decimal("1280.00")))
    else:
        inc.amount = Decimal("1280.00")

    # Evita duplicar se rodar mais de uma vez no mesmo mês
    if db.query(models.MonthlyEntry).filter(models.MonthlyEntry.reference_month == reference_month).count() > 0:
        db.commit()
        return {"message": f"Mês {reference_month} já possui lançamentos"}

    items = [
        ("Carol", "Cartão", "458.00", models.ExpenseType.SINGLE, 1, 1),
        ("Carol", "AirBnB Novo", "58.35", models.ExpenseType.INSTALLMENT, 6, 2),
        ("Carol", "Café 89", "55.32", models.ExpenseType.INSTALLMENT, 2, 2),
        ("Carol", "guloseimas viagem", "52.02", models.ExpenseType.INSTALLMENT, 3, 2),
        ("Carol", "Passagem SP-RJ", "50.27", models.ExpenseType.INSTALLMENT, 3, 2),
        ("Carol", "AirBnB Antigo", "51.68", models.ExpenseType.INSTALLMENT, 5, 4),
        ("Carol", "Passagem CA-SP", "76.34", models.ExpenseType.INSTALLMENT, 6, 3),
        ("Mamãe", "Net", "17.00", models.ExpenseType.RECURRING, 1, 1),
        ("Mamãe", "Telefone", "55.00", models.ExpenseType.RECURRING, 1, 1),
        ("Mamãe", "Tenis", "80.00", models.ExpenseType.INSTALLMENT, 4, 2),
        ("Academia", "Academia", "130.00", models.ExpenseType.RECURRING, 1, 1),
        ("Dh", "Churrasco", "52.50", models.ExpenseType.SINGLE, 1, 1),
    ]

    for person, desc, val, etype, total_inst, start_inst in items:
        crud.create_expense_with_entries(
            db,
            schemas.ExpenseCreate(
                entity_id=created_entities[person],
                description=desc,
                amount=Decimal(val),
                expense_type=etype,
                total_installments=total_inst,
                start_installment=start_inst,
                start_month=reference_month,
            ),
        )

    return {"message": f"Dados da planilha carregados em {reference_month}"}