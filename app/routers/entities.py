from fastapi import APIRouter, HTTPException

from .. import models, schemas
from ..deps import Db, User
from ..services import owned

router = APIRouter(prefix="/entities", tags=["Pessoas/Categorias"])


@router.get("", response_model=list[schemas.EntityOut])
def list_entities(db: Db, user_id: User):
    return db.query(models.Entity).filter(models.Entity.user_id == user_id).order_by(models.Entity.id).all()


@router.post("", response_model=schemas.EntityOut)
def create_entity(payload: schemas.EntityCreate, db: Db, user_id: User):
    entity = models.Entity(user_id=user_id, **payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{entity_id}", response_model=schemas.EntityOut)  # NOVO
def update_entity(entity_id: int, payload: schemas.EntityCreate, db: Db, user_id: User):
    entity = owned(db, models.Entity, entity_id, user_id, "Pessoa/Categoria não encontrada")
    for field, value in payload.model_dump().items():
        setattr(entity, field, value)
    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{entity_id}")  # NOVO
def delete_entity(entity_id: int, db: Db, user_id: User, force: bool = False):
    entity = owned(db, models.Entity, entity_id, user_id, "Pessoa/Categoria não encontrada")
    receivables = db.query(models.Receivable).filter(models.Receivable.entity_id == entity.id).all()
    has_expenses = db.query(models.Expense).filter(models.Expense.entity_id == entity.id).first()
    if (receivables or has_expenses) and not force:
        raise HTTPException(409, "Possui lançamentos vinculados. Use force=true para apagar tudo junto.")
    for rec in receivables:
        db.delete(rec)
    db.delete(entity)
    db.commit()
    return {"message": "Pessoa/Categoria removida"}