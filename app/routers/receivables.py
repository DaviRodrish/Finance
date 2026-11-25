from datetime import date

from fastapi import APIRouter

from .. import schemas
from .. import services as sv
from ..deps import Db, MonthPath, MonthQuery, OptMonthQuery, User

router = APIRouter(tags=["Cobranças"])
K = sv.RECEIVABLE


@router.get("/receivables/{reference_month}", response_model=schemas.ReceivablesMonthOut)
def get_receivables_month(reference_month: MonthPath, db: Db, user_id: User):
    return sv.receivables_month(db, reference_month, user_id)


@router.post("/receivables", response_model=schemas.ReceivablesMonthOut)
def create_receivable(payload: schemas.ReceivableCreate, db: Db, user_id: User):
    sv.create_launch(db, K, user_id, payload)
    return sv.receivables_month(db, payload.start_month, user_id)


@router.delete("/receivables/{receivable_id}")
def delete_receivable(receivable_id: int, db: Db, user_id: User):
    sv.delete_parent(db, K, receivable_id, user_id)
    return {"message": "Cobrança parcelada removida por completo"}


@router.get("/receivable-entries/overdue", response_model=list[schemas.ReceivableEntryOut])  # NOVO
def overdue_receivables(db: Db, user_id: User, before: OptMonthQuery = None):
    return sv.overdue_entries(db, K, before or date.today().strftime("%Y-%m"), user_id)


@router.post("/receivable-entries/receive-entity")  # NOVO
def receive_all_entity(reference_month: MonthQuery, entity_id: int, db: Db, user_id: User):
    return {"updated": sv.settle_entity(db, K, reference_month, entity_id, user_id)}


@router.patch("/receivable-entries/{entry_id}", response_model=schemas.ReceivableEntryOut)
def update_receivable_entry(entry_id: int, payload: schemas.ReceivableEntryUpdate, db: Db, user_id: User,
                            apply_future: bool = False):
    return sv.update_entry(db, K, entry_id, payload, apply_future, user_id)


@router.delete("/receivable-entries/{entry_id}")
def delete_receivable_entry(entry_id: int, db: Db, user_id: User):
    sv.delete_entry(db, K, entry_id, user_id)
    return {"message": "Cobrança removida"}