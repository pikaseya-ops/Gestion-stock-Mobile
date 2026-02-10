import uuid
from flask import Blueprint, request, jsonify
from db import get_db

api_bp = Blueprint('api', __name__, url_prefix='/api')


def _generate_id():
    return uuid.uuid4().hex[:8]


# ──────────────────────────────────────────
# GET /api/data
# ──────────────────────────────────────────
@api_bp.route('/data', methods=['GET'])
def get_all_data():
    conn = get_db()
    categories = conn.execute(
        "SELECT * FROM categories ORDER BY sort_order"
    ).fetchall()

    result = []
    for cat in categories:
        products = conn.execute(
            "SELECT * FROM products WHERE category_id = ? ORDER BY id",
            (cat['id'],)
        ).fetchall()
        result.append({
            'id':       cat['id'],
            'name':     cat['name'],
            'icon':     cat['icon'],
            'color':    cat['color'],
            'low_stock_threshold': cat['low_stock_threshold'] if cat['low_stock_threshold'] is not None else 5,
            'products': [
                {
                    'id':    p['id'],
                    'name':  p['name'],
                    'qty':   p['qty'],
                    'unit':  p['unit'],
                    'note':  p['note'] if p['note'] else None,
                    'group': p['grp'] if p['grp'] else None,
                }
                for p in products
            ]
        })
    conn.close()
    return jsonify(result)


# ──────────────────────────────────────────
# POST /api/categories
# ──────────────────────────────────────────
@api_bp.route('/categories', methods=['POST'])
def create_category():
    data = request.get_json()
    name  = data.get('name', '').strip()
    icon  = data.get('icon', 'fa-solid fa-box').strip()
    color = data.get('color', 'conserves').strip()

    if not name:
        return jsonify({'error': 'Le nom est requis'}), 400

    cat_id = name.lower().replace(' ', '-')
    cat_id = ''.join(c for c in cat_id if c.isalnum() or c == '-')

    conn = get_db()
    max_order = conn.execute("SELECT COALESCE(MAX(sort_order), -1) FROM categories").fetchone()[0]
    conn.execute(
        "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
        (cat_id, name, icon, color, max_order + 1)
    )
    conn.commit()
    conn.close()
    return jsonify({'id': cat_id, 'name': name, 'icon': icon, 'color': color, 'products': []}), 201


# ──────────────────────────────────────────
# DELETE /api/categories/<id>
# ──────────────────────────────────────────
@api_bp.route('/categories/<cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    conn = get_db()
    conn.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ──────────────────────────────────────────
# POST /api/products
# ──────────────────────────────────────────
@api_bp.route('/products', methods=['POST'])
def create_product():
    data = request.get_json()
    category_id = data.get('category_id', '').strip()
    name        = data.get('name', '').strip()
    qty         = data.get('qty')
    unit        = data.get('unit', '').strip()
    note        = data.get('note', '').strip()
    grp         = data.get('group', '').strip()

    if not name or not category_id:
        return jsonify({'error': 'Le nom et la cat\u00e9gorie sont requis'}), 400

    conn = get_db()
    cat = conn.execute("SELECT id FROM categories WHERE id = ?", (category_id,)).fetchone()
    if not cat:
        conn.close()
        return jsonify({'error': 'Cat\u00e9gorie introuvable'}), 404

    prod_id = _generate_id()
    conn.execute(
        "INSERT INTO products (id, category_id, name, qty, unit, note, grp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (prod_id, category_id, name, qty, unit, note, grp)
    )
    conn.commit()
    conn.close()
    return jsonify({
        'id': prod_id, 'name': name, 'qty': qty, 'unit': unit, 'note': note, 'group': grp
    }), 201


# ──────────────────────────────────────────
# DELETE /api/products/<id>
# ──────────────────────────────────────────
@api_bp.route('/products/<prod_id>', methods=['DELETE'])
def delete_product(prod_id):
    conn = get_db()
    conn.execute("DELETE FROM products WHERE id = ?", (prod_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ──────────────────────────────────────────
# PUT /api/products/<id>
# ──────────────────────────────────────────
@api_bp.route('/products/<prod_id>', methods=['PUT'])
def update_product(prod_id):
    data = request.get_json()
    conn = get_db()
    existing = conn.execute("SELECT * FROM products WHERE id = ?", (prod_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Produit introuvable'}), 404

    name = data.get('name', existing['name']).strip()
    qty  = data.get('qty', existing['qty'])
    unit = data.get('unit', existing['unit']).strip()
    note = data.get('note', existing['note']).strip()
    grp  = data.get('group', existing['grp']).strip()

    conn.execute(
        "UPDATE products SET name=?, qty=?, unit=?, note=?, grp=? WHERE id=?",
        (name, qty, unit, note, grp, prod_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'id': prod_id, 'name': name, 'qty': qty, 'unit': unit, 'note': note, 'group': grp})


# ──────────────────────────────────────────
# PUT /api/categories/<id>/threshold
# ──────────────────────────────────────────
@api_bp.route('/categories/<cat_id>/threshold', methods=['PUT'])
def update_threshold(cat_id):
    data = request.get_json()
    threshold = data.get('low_stock_threshold', 5)

    conn = get_db()
    conn.execute(
        "UPDATE categories SET low_stock_threshold=? WHERE id=?",
        (threshold, cat_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'low_stock_threshold': threshold})
