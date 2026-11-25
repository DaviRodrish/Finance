from typing import Annotated, Optional

from fastapi import Depends, Path, Query
from sqlalchemy.orm import Session

from .auth import get_current_user_id
from .database import get_db
from .schemas import MONTH_RE

Db = Annotated[Session, Depends(get_db)]
User = Annotated[str, Depends(get_current_user_id)]
MonthPath = Annotated[str, Path(pattern=MONTH_RE)]
MonthQuery = Annotated[str, Query(pattern=MONTH_RE)]
OptMonthQuery = Annotated[Optional[str], Query(pattern=MONTH_RE)]