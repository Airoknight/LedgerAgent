import argparse
import sys
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.firm import Firm
from app.models.organization import User
from app.models.audit import AuditEvent
from app.services.seed_service import init_db

def create_user_command(email: str, password: str, full_name: str = "CA Hehram", role: str = "ca_admin"):
    db = SessionLocal()
    try:
        # Ensure tables and default firm exist
        init_db(db)
        
        email_clean = email.strip().lower()
        existing = db.query(User).filter(User.email == email_clean).first()
        if existing:
            existing.full_name = full_name
            existing.hashed_password = get_password_hash(password)
            existing.role = role
            existing.is_active = True
            existing.failed_login_attempts = 0
            existing.locked_until = None
            db.commit()
            print(f"User '{email_clean}' credentials updated successfully.")
        else:
            new_user = User(
                firm_id="default_firm",
                email=email_clean,
                full_name=full_name,
                hashed_password=get_password_hash(password),
                role=role,
                is_active=True
            )
            db.add(new_user)
            db.commit()
            print(f"User '{email_clean}' created successfully with role '{role}'.")
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="LedgerAgent Administration CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # init-db
    subparsers.add_parser("init-db", help="Initialize SQLite database schema and seed defaults")

    # create-user
    create_parser = subparsers.add_parser("create-user", help="Create or update an authenticated CA user")
    create_parser.add_argument("--email", required=True, help="User email address")
    create_parser.add_argument("--password", required=True, help="User password")
    create_parser.add_argument("--name", default="CA Hehram", help="User full name")
    create_parser.add_argument("--role", default="ca_admin", help="User role (ca_admin, accountant)")

    # list-users
    subparsers.add_parser("list-users", help="List all registered users")

    args = parser.parse_args()

    if args.command == "init-db":
        db = SessionLocal()
        try:
            init_db(db)
            print("Database schema and default firm initialized successfully.")
        finally:
            db.close()
    elif args.command == "create-user":
        create_user_command(args.email, args.password, args.name, args.role)
    elif args.command == "list-users":
        db = SessionLocal()
        try:
            users = db.query(User).all()
            print(f"Found {len(users)} registered user(s):")
            for u in users:
                print(f" - {u.email} ({u.full_name}, role: {u.role}, active: {u.is_active})")
        finally:
            db.close()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

