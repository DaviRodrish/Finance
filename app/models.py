from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from .database import Base


class ExpenseType(str, enum.Enum):
    SINGLE = "single"
    INSTALLMENT = "installment"
    RECURRING = "recurring"


class EntryStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"


class Entity(Base):
    __tablename__ = "entities"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_entity_name"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(20), default="#3B82F6")

    expenses = relationship("Expense", back_populates="entity")
    entries = relationship("MonthlyEntry", back_populates="entity")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    description = Column(String(200), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    expense_type = Column(Enum(ExpenseType), default=ExpenseType.SINGLE, nullable=False)
    total_installments = Column(Integer, default=1, nullable=False)
    start_installment = Column(Integer, default=1, nullable=False)
    start_month = Column(String(7), nullable=False)
    is_active = Column(Boolean, default=True)

    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)

    entity = relationship("Entity", back_populates="expenses")
    entries = relationship("MonthlyEntry", back_populates="expense", cascade="all, delete-orphan")


class MonthlyEntry(Base):
    __tablename__ = "monthly_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)

    reference_month = Column(String(7), index=True, nullable=False)
    description = Column(String(200), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    installment_label = Column(String(20), nullable=True)
    status = Column(Enum(EntryStatus), default=EntryStatus.PENDING, nullable=False)

    expense = relationship("Expense", back_populates="entries")
    entity = relationship("Entity", back_populates="entries")


class MonthlyIncome(Base):
    __tablename__ = "monthly_incomes"
    __table_args__ = (UniqueConstraint("user_id", "reference_month", name="uq_user_month_income"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    reference_month = Column(String(7), index=True, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)