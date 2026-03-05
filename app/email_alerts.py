"""Envoi d'email quand un produit passe sous le seuil de stock"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_low_stock_alert(product, category):
    """
    Envoie un email à ALERT_EMAIL si la config SMTP est présente.
    """
    to_email = os.getenv('ALERT_EMAIL', '').strip()
    host = os.getenv('SMTP_HOST', '').strip()
    user = os.getenv('SMTP_USER', '').strip()
    password = os.getenv('SMTP_PASSWORD', '')
    if not to_email or not host or not user or not password:
        return

    port = int(os.getenv('SMTP_PORT', '587'))
    from_email = os.getenv('SMTP_FROM', user).strip()
    threshold = product.low_stock_threshold if product.low_stock_threshold is not None else 5
    qty_display = str(product.qty) if product.qty is not None else '?'
    unit = (product.unit or '').strip()
    unit_suffix = f' {unit}' if unit else ''

    subject = f"[Poulstock] Stock faible — {product.name}"
    body = (
        f"Le produit « {product.name} » (catégorie {category.name}) "
        f"est passé sous le seuil minimal.\n\n"
        f"Quantité actuelle : {qty_display}{unit_suffix}\n"
        f"Seuil minimal : {threshold}{unit_suffix}\n\n"
        "Pensez à réapprovisionner, bisous !"
    )

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = from_email
    msg['To'] = to_email
    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_email, [to_email], msg.as_string())
    except Exception:
        pass  # Ne pas faire échouer la requête API
