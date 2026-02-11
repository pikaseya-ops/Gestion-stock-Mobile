from models.db import db
from models.category import Category
from models.product import Product


def init_db():
    db.create_all()
