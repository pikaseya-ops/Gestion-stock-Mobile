from models.db import db
from models.category import Category
from models.product import Product


def init_db():
    db.create_all()

    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)

    # Migration : ajouter low_stock_threshold aux produits si la colonne est absente
    product_cols = [col['name'] for col in inspector.get_columns('products')]
    if 'low_stock_threshold' not in product_cols:
        with db.engine.connect() as conn:
            conn.execute(text('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5'))
            conn.commit()

    # Migration : ajouter sort_order aux catégories si la colonne est absente
    cat_cols = [col['name'] for col in inspector.get_columns('categories')]
    if 'sort_order' not in cat_cols:
        with db.engine.connect() as conn:
            conn.execute(text('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0'))
            conn.commit()
