from models.db import db


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String, nullable=False)
    icon = db.Column(db.String, nullable=False)
    color = db.Column(db.String, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    low_stock_threshold = db.Column(db.Integer, default=5)

    products = db.relationship("Product", back_populates="category", cascade="all, delete-orphan")
