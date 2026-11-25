from fastapi import APIRouter, HTTPException

from .. import models, schemas
from ..deps import Db, User
from ..services import owned

router = APIRouter(prefix="/entities", tags=["Pessoas/Categorias"])


@router.get("", response_model=list[schemas.EntityOut])
def list_entities(db: Db, user_id: User):
    return (
        db.query(models.Entity)
        .filter(models.Entity.user_id == user_id)
        .order_by(models.Entity.id)
        .all()
    )


@router.post("", response_model=schemas.EntityOut)
def create_entity(payload: schemas.EntityCreate, db: Db, user_id: User):
    entity = models.Entity(
        user_id=user_id,
        name=payload.name.strip(),
        color=payload.color,
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{entity_id}", response_model=schemas.EntityOut)
def update_entity(entity_id: int, payload: schemas.EntityCreate, db: Db, user_id: User):
    entity = owned(db, models.Entity, entity_id, user_id, "Pessoa/Categoria não encontrada")
    data = payload.model_dump()
    if "name" in data and isinstance(data["name"], str):
        data["name"] = data["name"].strip()
    for field, value in data.items():
        setattr(entity, field, value)
    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{entity_id}")
def delete_entity(entity_id: int, db: Db, user_id: User, force: bool = False):
    entity = owned(db, models.Entity, entity_id, user_id, "Pessoa/Categoria não encontrada")
    receivables = (
        db.query(models.Receivable)
        .filter(models.Receivable.entity_id == entity.id, models.Receivable.user_id == user_id)
        .all()
    )
    has_expenses = (
        db.query(models.Expense)
        .filter(models.Expense.entity_id == entity.id, models.Expense.user_id == user_id)
        .first()
    )
    if (receivables or has_expenses) and not force:
        raise HTTPException(
            status_code=409,
            detail="Possui lançamentos vinculados. Use force=true para apagar tudo junto.",
        )
    for rec in receivables:
        db.delete(rec)
    db.delete(entity)
    db.commit()
    return {"message": "Pessoa/Categoria removida"}



