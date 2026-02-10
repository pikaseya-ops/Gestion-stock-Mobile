import uuid
from flask import Blueprint, request, jsonify
from models import db, Category, Product

api_bp = Blueprint('api', __name__, url_prefix='/api')


def _generate_id():
    return uuid.uuid4().hex[:8]


# ──────────────────────────────────────────
# GET /api/data
# ──────────────────────────────────────────
@api_bp.route('/data', methods=['GET'])
def get_all_data():
    categories = Category.query.order_by(Category.sort_order).all()
    result = []
    for cat in categories:
        result.append({
            'id': cat.id,
            'name': cat.name,
            'icon': cat.icon,
            'color': cat.color,
            'low_stock_threshold': cat.low_stock_threshold if cat.low_stock_threshold is not None else 5,
            'products': [
                {
                    'id': p.id,
                    'name': p.name,
                    'qty': p.qty,
                    'unit': p.unit,
                    'note': p.note if p.note else None,
                    'group': p.grp if p.grp else None,
                }
                for p in sorted(cat.products, key=lambda x: x.id)
            ]
        })
    return jsonify(result)


# ──────────────────────────────────────────
# POST /api/categories
# ──────────────────────────────────────────
@api_bp.route('/categories', methods=['POST'])
def create_category():
    data = request.get_json()
    name = data.get('name', '').strip()
    icon = data.get('icon', 'fa-solid fa-box').strip()
    color = data.get('color', 'conserves').strip()

    if not name:
        return jsonify({'error': 'Le nom est requis'}), 400

    cat_id = name.lower().replace(' ', '-')
    cat_id = ''.join(c for c in cat_id if c.isalnum() or c == '-')

    last = Category.query.order_by(Category.sort_order.desc()).first()
    next_order = (last.sort_order + 1) if last is not None else 0
    cat = Category(
        id=cat_id,
        name=name,
        icon=icon,
        color=color,
        sort_order=next_order,
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify({'id': cat_id, 'name': name, 'icon': icon, 'color': color, 'products': []}), 201


# ──────────────────────────────────────────
# DELETE /api/categories/<id>
# ──────────────────────────────────────────
@api_bp.route('/categories/<cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    Category.query.filter_by(id=cat_id).delete()
    db.session.commit()
    return jsonify({'success': True})


# ──────────────────────────────────────────
# POST /api/products
# ──────────────────────────────────────────
@api_bp.route('/products', methods=['POST'])
def create_product():
    data = request.get_json()
    category_id = data.get('category_id', '').strip()
    name = data.get('name', '').strip()
    qty = data.get('qty')
    unit = data.get('unit', '').strip()
    note = data.get('note', '').strip()
    grp = data.get('group', '').strip()

    if not name or not category_id:
        return jsonify({'error': 'Le nom et la catégorie sont requis'}), 400

    cat = Category.query.get(category_id)
    if not cat:
        return jsonify({'error': 'Catégorie introuvable'}), 404

    prod_id = _generate_id()
    product = Product(
        id=prod_id,
        category_id=category_id,
        name=name,
        qty=qty,
        unit=unit or '',
        note=note or '',
        grp=grp or '',
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({
        'id': prod_id, 'name': name, 'qty': qty, 'unit': unit, 'note': note, 'group': grp
    }), 201


# ──────────────────────────────────────────
# DELETE /api/products/<id>
# ──────────────────────────────────────────
@api_bp.route('/products/<prod_id>', methods=['DELETE'])
def delete_product(prod_id):
    Product.query.filter_by(id=prod_id).delete()
    db.session.commit()
    return jsonify({'success': True})


# ──────────────────────────────────────────
# PUT /api/products/<id>
# ──────────────────────────────────────────
@api_bp.route('/products/<prod_id>', methods=['PUT'])
def update_product(prod_id):
    data = request.get_json()
    product = Product.query.get(prod_id)
    if not product:
        return jsonify({'error': 'Produit introuvable'}), 404

    product.name = data.get('name', product.name).strip()
    product.qty = data.get('qty', product.qty)
    product.unit = data.get('unit', product.unit).strip()
    product.note = data.get('note', product.note).strip()
    product.grp = data.get('group', product.grp).strip()
    db.session.commit()
    return jsonify({
        'id': prod_id, 'name': product.name, 'qty': product.qty,
        'unit': product.unit, 'note': product.note, 'group': product.grp
    })


# ──────────────────────────────────────────
# PUT /api/categories/<id>/threshold
# ──────────────────────────────────────────
@api_bp.route('/categories/<cat_id>/threshold', methods=['PUT'])
def update_threshold(cat_id):
    data = request.get_json()
    threshold = data.get('low_stock_threshold', 5)

    cat = Category.query.get(cat_id)
    if not cat:
        return jsonify({'error': 'Catégorie introuvable'}), 404
    cat.low_stock_threshold = threshold
    db.session.commit()
    return jsonify({'success': True, 'low_stock_threshold': threshold})
