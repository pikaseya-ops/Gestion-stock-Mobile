from models.db import db
from models.category import Category
from models.product import Product


def init_db():
    db.create_all()

    # Migration : ajouter low_stock_threshold aux produits si la colonne est absente
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('products')]
    if 'low_stock_threshold' not in columns:
        with db.engine.connect() as conn:
            conn.execute(text('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5'))
            conn.commit()
