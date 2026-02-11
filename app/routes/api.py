import uuid
import random
import colorsys
from flask import Blueprint, request, jsonify
from models import db, Category, Product

api_bp = Blueprint('api', __name__, url_prefix='/api')


def _generate_id():
    return uuid.uuid4().hex[:8]


def _hex_to_hsl(hex_color):
    """Convertit une couleur hex (#RRGGBB) en HSL."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (h * 360, s * 100, l * 100)


def _hsl_distance(hsl1, hsl2):
    """Calcule la distance entre deux couleurs HSL."""
    h1, s1, l1 = hsl1
    h2, s2, l2 = hsl2
    dh = min(abs(h1 - h2), 360 - abs(h1 - h2)) / 180.0
    ds = abs(s1 - s2) / 100.0
    dl = abs(l1 - l2) / 100.0
    return (dh ** 2 + ds ** 2 + dl ** 2) ** 0.5


def _generate_distant_color(existing_colors):
    """Génère une couleur hex aléatoire éloignée des couleurs existantes."""
    if not existing_colors:
        # Première couleur : couleur aléatoire avec bonne saturation et luminosité
        h = random.uniform(0, 360)
        s = random.uniform(40, 80)
        l = random.uniform(30, 70)
    else:
        # Convertir les couleurs existantes en HSL
        existing_hsl = [_hex_to_hsl(c) for c in existing_colors]
        
        # Essayer plusieurs couleurs aléatoires et prendre celle qui est la plus éloignée
        best_color = None
        best_distance = 0
        
        for _ in range(50):
            h = random.uniform(0, 360)
            s = random.uniform(40, 80)
            l = random.uniform(30, 70)
            candidate_hsl = (h, s, l)
            
            # Distance minimale aux couleurs existantes
            min_distance = min(_hsl_distance(candidate_hsl, existing) for existing in existing_hsl)
            
            if min_distance > best_distance:
                best_distance = min_distance
                best_color = candidate_hsl
        
        if best_color:
            h, s, l = best_color
        else:
            # Fallback si aucune bonne couleur trouvée
            h = random.uniform(0, 360)
            s = random.uniform(40, 80)
            l = random.uniform(30, 70)
    
    # Convertir HSL en RGB puis en hex
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s / 100.0)
    r = int(r * 255)
    g = int(g * 255)
    b = int(b * 255)
    
    return f"#{r:02x}{g:02x}{b:02x}"


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
    
    # Si couleur fournie, l'utiliser, sinon générer une couleur éloignée
    if 'color' in data and data.get('color'):
        color = data.get('color', '').strip()
        # Vérifier que c'est un hex valide
        if not color.startswith('#') or len(color) != 7:
            return jsonify({'error': 'Couleur invalide (format hex requis: #RRGGBB)'}), 400
    else:
        # Récupérer toutes les couleurs existantes (uniquement les hex valides)
        existing_colors = [
            cat.color for cat in Category.query.all() 
            if cat.color and cat.color.startswith('#') and len(cat.color) == 7
        ]
        color = _generate_distant_color(existing_colors)

    if not name:
        return jsonify({'error': 'Le nom est requis'}), 400

    # Vérifier si une catégorie avec ce nom existe déjà (insensible à la casse)
    existing = Category.query.filter(db.func.lower(Category.name) == name.lower()).first()
    if existing is not None:
        return jsonify({'error': 'Une catégorie avec ce nom existe déjà.'}), 400

    last = Category.query.order_by(Category.sort_order.desc()).first()
    next_order = (last.sort_order + 1) if last is not None else 0
    cat = Category(
        name=name,
        icon=icon,
        color=color,
        sort_order=next_order,
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify({'id': cat.id, 'name': name, 'icon': icon, 'color': color, 'products': []}), 201


# ──────────────────────────────────────────
# DELETE /api/categories/<id>
# ──────────────────────────────────────────
@api_bp.route('/categories/<int:cat_id>', methods=['DELETE'])
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
    category_id = data.get('category_id')
    if category_id is not None and isinstance(category_id, str):
        category_id = category_id.strip()
    try:
        category_id = int(category_id)
    except (TypeError, ValueError):
        category_id = None
    name = data.get('name', '').strip()
    qty = data.get('qty')
    unit = data.get('unit', '').strip()
    note = data.get('note', '').strip()
    grp = data.get('group', '').strip()

    if not name or category_id is None:
        return jsonify({'error': 'Le nom et la catégorie sont requis'}), 400

    cat = Category.query.get(int(category_id))
    if not cat:
        return jsonify({'error': 'Catégorie introuvable'}), 404

    prod_id = _generate_id()
    product = Product(
        id=prod_id,
        category_id=int(category_id),
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
@api_bp.route('/categories/<int:cat_id>/threshold', methods=['PUT'])
def update_threshold(cat_id):
    data = request.get_json()
    threshold = data.get('low_stock_threshold', 5)

    cat = Category.query.get(cat_id)
    if not cat:
        return jsonify({'error': 'Catégorie introuvable'}), 404
    cat.low_stock_threshold = threshold
    db.session.commit()
    return jsonify({'success': True, 'low_stock_threshold': threshold})
