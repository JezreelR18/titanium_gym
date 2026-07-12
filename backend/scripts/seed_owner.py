"""
Run this once to create the first owner account.
Usage: python -m scripts.seed_owner
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from passlib.context import CryptContext

DATABASE_URL = "postgresql+asyncpg://postgres:Jrivera1*@localhost:5432/titanium_gym"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:

        role = await session.execute(text("SELECT id FROM roles WHERE name = 'owner' LIMIT 1"))
        role_id = role.scalar_one_or_none()
        if not role_id:
            print("ERROR: roles not seeded. Run the SQL schema first.")
            return

        email = "admin@titaniumgym.com"
        password = "Admin1234!"

        existing = await session.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email})
        if existing.scalar_one_or_none():
            print(f"Owner already exists: {email}")
            return

        await session.execute(text("""
            INSERT INTO users (id, role_id, first_name, last_name, email, password_hash, status, is_active)
            VALUES (:id, :role_id, :first_name, :last_name, :email, :password_hash, 'active', true)
        """), {
            "id": str(uuid.uuid4()),
            "role_id": str(role_id),
            "first_name": "Admin",
            "last_name": "Owner",
            "email": email,
            "password_hash": pwd_context.hash(password),
        })
        await session.commit()

    print("=" * 40)
    print("Owner account created successfully!")
    print(f"  Email   : {email}")
    print(f"  Password: {password}")
    print("=" * 40)
    await engine.dispose()


asyncio.run(seed())
