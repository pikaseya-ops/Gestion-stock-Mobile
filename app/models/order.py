from models.db import db
from datetime import datetime


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.String, primary_key=True)
    product_id = db.Column(db.String, db.ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = db.Column(db.String, nullable=False)
    supplier = db.Column(db.String, default="")
    quantity = db.Column(db.Integer, nullable=False, default=1)
    # Statuts : en_attente, envoyee, recue, annulee
    status = db.Column(db.String, default="en_attente")
    pennylane_order_id = db.Column(db.String, nullable=True)
    pennylane_url = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.Column(db.String, default="")
    auto_triggered = db.Column(db.Boolean, default=False)

    product = db.relationship("Product", backref="orders", foreign_keys=[product_id])
