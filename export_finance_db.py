#!/usr/bin/env python3
"""Converte o finance.db (SQLite do backend antigo) no JSON que o app local importa.

Uso (só biblioteca padrão do Python, não precisa instalar nada):
    python export_finance_db.py finance.db luzzy-import.json

Depois, no app: barra lateral -> Dados deste aparelho -> Importar.
O arquivo .db NÃO é alterado (é aberto somente para leitura).
"""
import json
import sqlite3
import sys
import time
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path


def cents(value) -> int:
    """Numeric(12,2) -> centavos inteiros, sem erro de ponto flutuante."""
    if value is None:
        return 0
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def table_rows(con: sqlite3.Connection, table: str):
    exists = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    if not exists:
        return []
    return [dict(r) for r in con.execute(f"SELECT * FROM {table} ORDER BY id")]


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "finance.db")
    dst = Path(sys.argv[2] if len(sys.argv) > 2 else "luzzy-import.json")
    if not src.exists():
        sys.exit(f"Arquivo não encontrado: {src}")

    con = sqlite3.connect(f"file:{src.resolve().as_posix()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row

    now_ms = int(time.time() * 1000)
    stamp = {"updated_at": now_ms, "deleted_at": None}

    raw = {
        name: table_rows(con, name)
        for name in (
            "entities",
            "expenses",
            "monthly_entries",
            "monthly_incomes",
            "receivables",
            "receivable_entries",
        )
    }

    users = {
        r["user_id"]
        for rows in raw.values()
        for r in rows
        if "user_id" in r and r["user_id"] is not None
    }
    if len(users) > 1:
        print(f"AVISO: o banco tem {len(users)} user_id diferentes; todos serão exportados juntos.")

    entities = [
        {"id": r["id"], "name": r["name"], "color": r["color"] or "#3B82F6",
         "created_at": r.get("created_at"), **stamp}
        for r in raw["entities"]
    ]
    entity_ids = {e["id"] for e in entities}

    expenses = [
        {
            "id": r["id"], "entity_id": r["entity_id"], "description": r["description"],
            "total_amount": cents(r["total_amount"]),
            "installment_amount": cents(r["installment_amount"]),
            "expense_type": r["expense_type"],
            "total_installments": r["total_installments"],
            "start_month": r["start_month"], "created_at": r.get("created_at"), **stamp,
        }
        for r in raw["expenses"] if r["entity_id"] in entity_ids
    ]
    expense_ids = {e["id"] for e in expenses}

    monthly_entries = [
        {
            "id": r["id"], "expense_id": r["expense_id"], "entity_id": r["entity_id"],
            "description": r["description"], "reference_month": r["reference_month"],
            "installment_number": r["installment_number"],
            "total_installments": r["total_installments"],
            "amount": cents(r["amount"]), "status": r["status"],
            "paid_at": r.get("paid_at"), **stamp,
        }
        for r in raw["monthly_entries"]
        if r["expense_id"] in expense_ids and r["entity_id"] in entity_ids
    ]

    # ID fixo por mês (ex.: 202611), igual ao que o app usa.
    incomes = {}
    for r in raw["monthly_incomes"]:
        month = r["reference_month"]
        incomes[month] = {
            "id": int(month.replace("-", "")), "reference_month": month,
            "amount": cents(r["amount"]), **stamp,
        }

    receivables = []
    for r in raw["receivables"]:
        if r["entity_id"] not in entity_ids:
            continue
        # O banco antigo pode não ter a coluna expense_type nas cobranças.
        etype = r.get("expense_type") or (
            "installment" if (r["total_installments"] or 1) > 1 else "single"
        )
        receivables.append({
            "id": r["id"], "entity_id": r["entity_id"], "description": r["description"],
            "total_amount": cents(r["total_amount"]),
            "installment_amount": cents(r["installment_amount"]),
            "expense_type": etype, "total_installments": r["total_installments"],
            "start_month": r["start_month"], "created_at": r.get("created_at"), **stamp,
        })
    receivable_ids = {e["id"] for e in receivables}

    receivable_entries = [
        {
            "id": r["id"], "receivable_id": r["receivable_id"], "entity_id": r["entity_id"],
            "description": r["description"], "reference_month": r["reference_month"],
            "installment_number": r["installment_number"],
            "total_installments": r["total_installments"],
            "amount": cents(r["amount"]), "status": r["status"],
            "received_at": r.get("received_at"), **stamp,
        }
        for r in raw["receivable_entries"]
        if r["receivable_id"] in receivable_ids and r["entity_id"] in entity_ids
    ]

    tables = {
        "entities": entities,
        "expenses": expenses,
        "monthly_entries": monthly_entries,
        "monthly_incomes": list(incomes.values()),
        "receivables": receivables,
        "receivable_entries": receivable_entries,
    }
    out = {
        "app": "luzzy",
        "version": 1,
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tables": tables,
    }
    dst.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

    dropped = sum(len(raw[k]) for k in raw) - sum(len(v) for v in tables.values())
    print(f"Gerado: {dst}")
    for name, rows in tables.items():
        print(f"  {name}: {len(rows)}")
    if dropped > 0:
        print(f"  (registros órfãos ignorados: {dropped})")


if __name__ == "__main__":
    main()