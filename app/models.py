from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from .database import Base


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(20), nullable=False, default="#3B82F6")
    created_at = Column(DateTime, default=datetime.utcnow)

    expenses = relationship("Expense", back_populates="entity", cascade="all, delete-orphan")
    entries = relationship("MonthlyEntry", back_populates="entity", cascade="all, delete-orphan")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    description = Column(String(200), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    installment_amount = Column(Numeric(12, 2), nullable=False)
    expense_type = Column(String(20), nullable=False)  # single | installment | recurring
    total_installments = Column(Integer, nullable=False, default=1)
    start_month = Column(String(7), nullable=False)  # YYYY-MM
    created_at = Column(DateTime, default=datetime.utcnow)

    entity = relationship("Entity", back_populates="expenses")
    entries = relationship(
        "MonthlyEntry",
        back_populates="expense",
        cascade="all, delete-orphan",
        order_by="MonthlyEntry.installment_number",
    )


class MonthlyEntry(Base):
    __tablename__ = "monthly_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    description = Column(String(200), nullable=False)
    reference_month = Column(String(7), nullable=False, index=True)  # YYYY-MM
    installment_number = Column(Integer, nullable=False, default=1)
    total_installments = Column(Integer, nullable=False, default=1)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | paid
    paid_at = Column(DateTime, nullable=True)

    expense = relationship("Expense", back_populates="entries")
    entity = relationship("Entity", back_populates="entries")


class MonthlyIncome(Base):
    __tablename__ = "monthly_incomes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    reference_month = Column(String(7), nullable=False, index=True)  # YYYY-MM
    amount = Column(Numeric(12, 2), nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Receivable(Base):
    __tablename__ = "receivables"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    description = Column(String(200), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    installment_amount = Column(Numeric(12, 2), nullable=False)
    total_installments = Column(Integer, nullable=False, default=1)
    start_month = Column(String(7), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    entity = relationship("Entity")
    entries = relationship(
        "ReceivableEntry",
        back_populates="receivable",
        cascade="all, delete-orphan",
        order_by="ReceivableEntry.installment_number",
    )


class ReceivableEntry(Base):
    __tablename__ = "receivable_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    receivable_id = Column(Integer, ForeignKey("receivables.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    description = Column(String(200), nullable=False)
    reference_month = Column(String(7), nullable=False, index=True)
    installment_number = Column(Integer, nullable=False)
    total_installments = Column(Integer, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | received
    received_at = Column(DateTime, nullable=True)

    receivable = relationship("Receivable", back_populates="entries")
    entity = relationship("Entity")