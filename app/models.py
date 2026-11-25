from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from .database import Base


class ExpenseType(str, enum.Enum):
    SINGLE = "single"           # À vista / único no mês
    INSTALLMENT = "installment" # Parcelado (ex: 2/6)
    RECURRING = "recurring"     # Fixo mensal (ex: Academia, Net)


class EntryStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)  # Ex: Carol, Mamãe, Academia, Dh
    color = Column(String(20), default="#3B82F6")            # Cor para o gráfico e tags

    expenses = relationship("Expense", back_populates="entity")
    entries = relationship("MonthlyEntry", back_populates="entity")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(200), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)          # Valor da parcela/mensalidade
    expense_type = Column(Enum(ExpenseType), default=ExpenseType.SINGLE, nullable=False)
    total_installments = Column(Integer, default=1, nullable=False)
    start_installment = Column(Integer, default=1, nullable=False) # Ex: 2 se já estiver na 2/6
    start_month = Column(String(7), nullable=False)          # Formato "YYYY-MM"
    is_active = Column(Boolean, default=True)                # Para cancelar recorrentes no futuro

    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)

    entity = relationship("Entity", back_populates="expenses")
    entries = relationship("MonthlyEntry", back_populates="expense", cascade="all, delete-orphan")


class MonthlyEntry(Base):
    __tablename__ = "monthly_entries"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)

    reference_month = Column(String(7), index=True, nullable=False)  # Formato "YYYY-MM"
    description = Column(String(200), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    installment_label = Column(String(20), nullable=True)            # Ex: "2/6" ou None se à vista/fixo
    status = Column(Enum(EntryStatus), default=EntryStatus.PENDING, nullable=False)

    expense = relationship("Expense", back_populates="entries")
    entity = relationship("Entity", back_populates="entries")


class MonthlyIncome(Base):
    __tablename__ = "monthly_incomes"

    id = Column(Integer, primary_key=True, index=True)
    reference_month = Column(String(7), unique=True, index=True, nullable=False)  # "YYYY-MM"
    amount = Column(Numeric(10, 2), nullable=False)