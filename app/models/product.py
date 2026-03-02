from models.db import db


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.String, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String, nullable=False)
    qty = db.Column(db.Integer)
    unit = db.Column(db.String, default="", nullable=False)
    note = db.Column(db.String, default="")
    grp = db.Column(db.String, default="")
    low_stock_threshold = db.Column(db.Integer, default=5)

    category = db.relationship("Category", back_populates="products")
