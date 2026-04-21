"""
Service d'intégration Pennylane.
Configure la variable d'environnement PENNYLANE_API_KEY pour activer l'envoi automatique.
Documentation API : https://pennylane.com/fr/api-documentation/
"""
import os
from datetime import datetime

PENNYLANE_API_URL = "https://app.pennylane.com/api/external/v1"


def get_api_key():
    return os.getenv("PENNYLANE_API_KEY", "").strip()


def is_configured():
    return bool(get_api_key())


def create_purchase_order(product_name, supplier, quantity, reference="", notes=""):
    """
    Crée un bon de commande dans Pennylane.
    Retourne (pennylane_order_id, pennylane_url) ou (None, None) si non configuré.

    TODO : adapter le payload selon la documentation officielle Pennylane
    une fois l'accès API disponible.
    """
    api_key = get_api_key()
    if not api_key:
        return None, None

    try:
        import requests

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        payload = {
            "supplier_name": supplier,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "memo": notes or f"Commande automatique — {product_name}",
            "line_items": [
                {
                    "description": product_name,
                    "reference": reference,
                    "quantity": quantity,
                }
            ],
        }

        response = requests.post(
            f"{PENNYLANE_API_URL}/purchase_orders",
            json=payload,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        order_id = data.get("id") or data.get("purchase_order", {}).get("id")
        order_url = data.get("url") or data.get("purchase_order", {}).get("url")
        return order_id, order_url

    except Exception as e:
        print(f"[Pennylane] Erreur création commande : {e}")
        return None, None
