import uuid
from flask import Blueprint, request, jsonify
from models import db
from models.order import Order
from models.product import Product
from services.pennylane import create_purchase_order, is_configured

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


def _generate_id():
    return uuid.uuid4().hex[:8]


def _serialize(o):
    return {
        "id": o.id,
        "product_id": o.product_id,
        "product_name": o.product_name,
        "supplier": o.supplier or "",
        "quantity": o.quantity,
        "status": o.status,
        "pennylane_order_id": o.pennylane_order_id,
        "pennylane_url": o.pennylane_url,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "notes": o.notes or "",
        "auto_triggered": o.auto_triggered or False,
    }


@orders_bp.route("", methods=["GET"])
def get_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify([_serialize(o) for o in orders])


@orders_bp.route("", methods=["POST"])
def create_order():
    data = request.get_json()
    product_id = data.get("product_id")
    quantity = int(data.get("quantity") or 1)
    notes = data.get("notes", "")
    auto_triggered = bool(data.get("auto_triggered", False))

    product = Product.query.get(product_id) if product_id else None
    product_name = data.get("product_name") or (product.name if product else "Produit inconnu")
    supplier = data.get("supplier") or (product.supplier if product else "") or ""
    reference = (product.reference if product else "") or ""

    pennylane_order_id, pennylane_url = None, None
    if is_configured():
        pennylane_order_id, pennylane_url = create_purchase_order(
            product_name, supplier, quantity, reference, notes
        )

    order = Order(
        id=_generate_id(),
        product_id=product_id,
        product_name=product_name,
        supplier=supplier,
        quantity=quantity,
        status="en_attente",
        pennylane_order_id=pennylane_order_id,
        pennylane_url=pennylane_url,
        notes=notes,
        auto_triggered=auto_triggered,
    )
    db.session.add(order)
    db.session.commit()
    return jsonify(_serialize(order)), 201


@orders_bp.route("/<order_id>", methods=["PUT"])
def update_order(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Commande introuvable"}), 404
    data = request.get_json()
    if "status" in data:
        order.status = data["status"]
    if "notes" in data:
        order.notes = data["notes"]
    db.session.commit()
    return jsonify(_serialize(order))


@orders_bp.route("/<order_id>", methods=["DELETE"])
def delete_order(order_id):
    Order.query.filter_by(id=order_id).delete()
    db.session.commit()
    return jsonify({"success": True})


@orders_bp.route("/pennylane/status", methods=["GET"])
def pennylane_status():
    return jsonify({"configured": is_configured()})
