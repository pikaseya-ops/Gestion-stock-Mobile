from models.db import db
from models.category import Category
from models.product import Product
from models.order import Order


def init_db():
    db.create_all()

    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)

    # Migration : produits
    product_cols = [col['name'] for col in inspector.get_columns('products')]
    migrations_products = [
        ('low_stock_threshold', 'INTEGER DEFAULT 5'),
        ('low_stock_alert_sent', 'INTEGER DEFAULT 0'),
        ('supplier', "TEXT DEFAULT ''"),
        ('reference', "TEXT DEFAULT ''"),
        ('order_qty', 'INTEGER DEFAULT 1'),
    ]
    for col_name, col_def in migrations_products:
        if col_name not in product_cols:
            with db.engine.connect() as conn:
                conn.execute(text(f'ALTER TABLE products ADD COLUMN {col_name} {col_def}'))
                conn.commit()

    # Migration : catégories
    cat_cols = [col['name'] for col in inspector.get_columns('categories')]
    if 'sort_order' not in cat_cols:
        with db.engine.connect() as conn:
            conn.execute(text('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0'))
            conn.commit()
