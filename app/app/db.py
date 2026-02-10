import sqlite3
import os

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stock.db')


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            icon                TEXT NOT NULL,
            color               TEXT NOT NULL,
            sort_order          INTEGER DEFAULT 0,
            low_stock_threshold INTEGER DEFAULT 5
        );

        CREATE TABLE IF NOT EXISTS products (
            id          TEXT PRIMARY KEY,
            category_id TEXT NOT NULL,
            name        TEXT NOT NULL,
            qty         INTEGER,
            unit        TEXT NOT NULL DEFAULT '',
            note        TEXT DEFAULT '',
            grp         TEXT DEFAULT '',
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
    """)

    # Migration : ajouter low_stock_threshold si absente
    cols = [row[1] for row in cursor.execute("PRAGMA table_info(categories)").fetchall()]
    if 'low_stock_threshold' not in cols:
        cursor.execute("ALTER TABLE categories ADD COLUMN low_stock_threshold INTEGER DEFAULT 5")

    count = cursor.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if count == 0:
        _seed(cursor)

    conn.commit()
    conn.close()


def _seed(cursor):
    categories = [
        ("conserves",    "Conserves",    "fa-solid fa-jar",          "conserves",    0),
        ("sous-vides",   "Sous-vides",   "fa-solid fa-box-archive",  "sousvides",    1),
        ("consommables", "Consommables", "fa-solid fa-tape",         "consommables", 2),
        ("epices",       "\u00c9pices",   "fa-solid fa-pepper-hot",   "epices",       3),
        ("sabots",       "Sabots",       "fa-solid fa-shoe-prints",  "sabots",       4),
        ("bottes",       "Bottes",       "fa-solid fa-socks",        "bottes",       5),
    ]
    for cat_id, name, icon, color, sort_order in categories:
        cursor.execute(
            "INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
            (cat_id, name, icon, color, sort_order)
        )

    products = [
        # ── CONSERVES ──
        ("c01", "conserves", "Terrine volaille",         370,  "",  "\u00e0 1100",           ""),
        ("c02", "conserves", "Rillettes volaille",       355,  "",  "",                      ""),
        ("c03", "conserves", "Rillettes poulet r\u00f4ti", None, "",  "stock \u00e0 v\u00e9rifier",  ""),
        ("c04", "conserves", "Terrine lapin",            245,  "",  "",                      ""),
        ("c05", "conserves", "Rillettes lapin",          97,   "",  "",                      ""),
        ("c06", "conserves", "Galantine dinde FG",       476,  "",  "",                      ""),
        ("c07", "conserves", "Galantine dinde figues",   375,  "",  "",                      ""),
        ("c08", "conserves", "P\u00e2t\u00e9 foie volaille",  None, "",  "stock \u00e0 v\u00e9rifier",  ""),
        ("c09", "conserves", "P\u00e2t\u00e9 foie chapon",    169,  "",  "",                      ""),
        ("c10", "conserves", "G\u00e9siers confits",      None, "",  "126 en 700g / 24 en 500g", ""),
        ("c11", "conserves", "Bolo volaille",            63,   "",  "",                      ""),
        ("c12", "conserves", "Cuisses poulet confites",  192,  "",  "",                      ""),
        ("c13", "conserves", "Cuisses canard confites",  103,  "",  "",                      ""),
        ("c14", "conserves", "P\u00e2t\u00e9 canette cognac", 720,  "",  "",                      ""),
        ("c15", "conserves", "Foie gras canard",         132,  "",  "",                      ""),
        ("c16", "conserves", "Poulet curry / coco",      154,  "",  "",                      ""),
        ("c17", "conserves", "Poulet curry / ananas",    1287, "",  "",                      ""),
        ("c18", "conserves", "Sucre",                    8,    "",  "",                      ""),
        ("c19", "conserves", "Chocolat",                 2,    "",  "",                      ""),
        ("c20", "conserves", "Caf\u00e9",                 19,   "",  "",                      ""),
        ("c21", "conserves", "Cappuccino",               2,    "",  "",                      ""),
        ("c22", "conserves", "Th\u00e9",                  4,    "",  "",                      ""),

        # ── SOUS-VIDES ── 90 mic
        ("sv01", "sous-vides", "90mic 170\u00d7250",  23,   "", "",                     "90 mic"),
        ("sv02", "sous-vides", "90mic 200\u00d7300",  24,   "", "",                     "90 mic"),
        ("sv03", "sous-vides", "90mic 200\u00d7350",  None, "", "stock \u00e0 v\u00e9rifier", "90 mic"),
        ("sv04", "sous-vides", "90mic 200\u00d7400",  10,   "", "",                     "90 mic"),
        ("sv05", "sous-vides", "90mic 250\u00d7300",  27,   "", "",                     "90 mic"),
        ("sv06", "sous-vides", "90mic 250\u00d7350",  19,   "", "",                     "90 mic"),
        ("sv07", "sous-vides", "90mic 250\u00d7400",  20,   "", "",                     "90 mic"),
        ("sv08", "sous-vides", "90mic 350\u00d7400",  2,    "", "",                     "90 mic"),
        ("sv09", "sous-vides", "90mic 300\u00d7400",  24,   "", "",                     "90 mic"),
        ("sv10", "sous-vides", "90mic 300\u00d7500",  21,   "", "",                     "90 mic"),
        ("sv11", "sous-vides", "90mic 350\u00d7500",  3,    "", "",                     "90 mic"),
        ("sv12", "sous-vides", "90mic 400\u00d7500",  12,   "", "",                     "90 mic"),
        # 145 mic
        ("sv13", "sous-vides", "145mic 170\u00d7250", 17,   "", "",                     "145 mic"),
        ("sv14", "sous-vides", "145mic 200\u00d7300", 14,   "", "",                     "145 mic"),
        ("sv15", "sous-vides", "145mic 250\u00d7300", 20,   "", "",                     "145 mic"),
        ("sv16", "sous-vides", "145mic 200\u00d7400", 12,   "", "",                     "145 mic"),
        ("sv17", "sous-vides", "145mic 250\u00d7400", 20,   "", "",                     "145 mic"),
        # Gants
        ("sv18", "sous-vides", "Gants S",             5,    "", "",                     "Gants"),
        ("sv19", "sous-vides", "Gants M",             11,   "", "",                     "Gants"),
        ("sv20", "sous-vides", "Gants L",             3,    "", "",                     "Gants"),
        ("sv21", "sous-vides", "Gants XL",            4,    "", "",                     "Gants"),
        ("sv22", "sous-vides", "Gants XXL",           2,    "", "",                     "Gants"),
        # Divers
        ("sv23", "sous-vides", "Raclettes",           3,    "", "",                     ""),
        ("sv24", "sous-vides", "Brosses",             2,    "", "",                     ""),
        ("sv25", "sous-vides", "Serpilli\u00e8res",    2,    "", "",                     ""),

        # ── CONSOMMABLES ──
        ("co01", "consommables", "Petites cartonnettes",         33,   "",        "",                           ""),
        ("co02", "consommables", "Grandes cartonnettes",         50,   "",        "",                           ""),
        ("co03", "consommables", "Cartonnettes brochettes",      10,   "cart.",   "",                           ""),
        ("co04", "consommables", "Papier fond de caisse petit",  5,    "",        "",                           ""),
        ("co05", "consommables", "Papier fond de caisse grand",  12,   "",        "",                           ""),
        ("co06", "consommables", "\u00c9lastiques \u00e0 brider", 13,  "poches", "",                           ""),
        ("co07", "consommables", "Film \u00e9tirable 45\u00d7300", 12, "rlx",    "",                           ""),
        ("co08", "consommables", "Pics \u00e0 brochettes",       None, "",        "stock \u00e0 v\u00e9rifier", ""),
        ("co09", "consommables", "Ficelle blanche",              13,   "rlx",     "",                           ""),
        ("co10", "consommables", "Ficelle rouge",                2,    "rlx",     "",                           ""),
        ("co11", "consommables", "Ficelle verte",                1,    "rlx",     "",                           ""),
        ("co12", "consommables", "Ficelle jaune",                3,    "rlx",     "",                           ""),
        ("co13", "consommables", "Essuie-tout",                  49,   "\u00e0 6 rlx", "",                     ""),
        ("co14", "consommables", "Papier WC",                    86,   "",        "",                           ""),
        ("co15", "consommables", "Manchettes",                   32,   "poches",  "",                           ""),
        ("co16", "consommables", "Charlottes",                   65,   "paquets", "",                           ""),
        ("co17", "consommables", "Barbiches",                    28,   "poches",  "",                           ""),
        ("co18", "consommables", "Sacs poubelle 100L",           20,   "rlx",     "",                           ""),
        ("co19", "consommables", "Sacs poubelle 160L",           8,    "rlx",     "",                           ""),
        ("co20", "consommables", "Produit vaisselle",            10,   "bidons",  "",                           ""),
        ("co21", "consommables", "Tabliers chair",               9,    "",        "",                           ""),
        ("co22", "consommables", "\u00c9ponges",                 None, "",        "7 paquets + divers = 30",    ""),
        ("co23", "consommables", "Bandes aff\u00fbtage",         14,   "",        "",                           ""),
        ("co24", "consommables", "Couteaux bouchers",            10,   "",        "",                           ""),
        ("co25", "consommables", "Couteaux saign\u00e9e",        3,    "",        "",                           ""),
        ("co26", "consommables", "Couteaux g\u00e9n\u00e9raux",  157,  "",        "",                           ""),
        ("co27", "consommables", "Fusils",                       3,    "",        "",                           ""),
        ("co28", "consommables", "Poches lapin",                 4,    "\u00e0 2000", "",                       ""),
        ("co29", "consommables", "Poches coq",                   None, "",        "stock \u00e0 v\u00e9rifier", ""),
        ("co30", "consommables", "Poches vierges",               5,    "cart.",   "",                           ""),
        ("co31", "consommables", "Poches d\u00e9tachables",      11,   "cart.",   "",                           ""),
        ("co32", "consommables", "Poches abats",                 206,  "paquets", "",                           ""),

        # ── ÉPICES ──
        ("e01", "epices", "Merguez",             1,    "",       "",                     ""),
        ("e02", "epices", "Saucisse",            None, "",       "1 \u00e0 10 kg",       ""),
        ("e03", "epices", "Saucisse herbes",     None, "",       "36 \u00e0 800g",       ""),
        ("e04", "epices", "Saucisson",           2,    "",       "",                     ""),
        ("e05", "epices", "Arizona",             9,    "",       "",                     ""),
        ("e06", "epices", "Indienne",            6,    "",       "",                     ""),
        ("e07", "epices", "Gros sel",            None, "",       "2 \u00e0 5 kg",        ""),
        ("e08", "epices", "Sel fin",             None, "",       "2 seaux",              ""),
        ("e09", "epices", "Poivre",              3,    "",       "",                     ""),
        ("e10", "epices", "Noix",                5,    "",       "",                     ""),
        ("e11", "epices", "Marrons",             36,   "bo\u00eetes", "",                ""),
        ("e12", "epices", "C\u00e8pes",          None, "",       "15 \u00e0 500g",       ""),
        ("e13", "epices", "Morilles",            None, "",       "500g",                 ""),
        ("e14", "epices", "Huile",               None, "",       "5 \u00e0 10L",         ""),
        ("e15", "epices", "R\u00e9gilait",       None, "",       "3 \u00e0 300g",        ""),
        ("e16", "epices", "Poudre morilles",     None, "",       "stock \u00e0 v\u00e9rifier", ""),
        ("e17", "epices", "Abricots",            1,    "bo\u00eete", "",                 ""),
        ("e18", "epices", "Figues",              None, "",       "1 \u00e0 3 kg",        ""),
        ("e19", "epices", "Pomeaux",             None, "",       "stock \u00e0 v\u00e9rifier", ""),
        ("e20", "epices", "Roquefort",           None, "",       "3 \u00e0 12",          ""),
        ("e21", "epices", "Gouda",               3,    "balles", "",                     ""),
        ("e22", "epices", "Boyaux chipo",        4,    "",       "",                     ""),
        ("e23", "epices", "Boyaux tout",         4,    "",       "",                     ""),
        ("e24", "epices", "Boyaux saucisson",    2,    "",       "",                     ""),

        # ── SABOTS ──
        ("s01", "sabots", "Sabots 37", 10, "paires", "", ""),
        ("s02", "sabots", "Sabots 38", 3,  "paires", "", ""),
        ("s03", "sabots", "Sabots 39", 3,  "paires", "", ""),
        ("s04", "sabots", "Sabots 40", 2,  "paires", "", ""),
        ("s05", "sabots", "Sabots 41", 2,  "paires", "", ""),
        ("s06", "sabots", "Sabots 42", 1,  "paires", "", ""),
        ("s07", "sabots", "Sabots 43", 4,  "paires", "", ""),
        ("s08", "sabots", "Sabots 45", 1,  "paires", "", ""),

        # ── BOTTES ──
        ("b01", "bottes", "Bottes 37", 1, "paires", "", ""),
        ("b02", "bottes", "Bottes 38", 5, "paires", "", ""),
        ("b03", "bottes", "Bottes 39", 1, "paires", "", ""),
        ("b04", "bottes", "Bottes 40", 1, "paires", "", ""),
        ("b05", "bottes", "Bottes 41", 1, "paires", "", ""),
        ("b06", "bottes", "Bottes 42", 1, "paires", "", ""),
        ("b07", "bottes", "Bottes 43", 1, "paires", "", ""),
        ("b08", "bottes", "Bottes 44", 2, "paires", "", ""),
        ("b09", "bottes", "Bottes 45", 1, "paires", "", ""),
    ]

    for pid, cat_id, name, qty, unit, note, grp in products:
        cursor.execute(
            "INSERT INTO products (id, category_id, name, qty, unit, note, grp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (pid, cat_id, name, qty, unit, note, grp)
        )
