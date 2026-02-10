import os
from flask import Flask
from dotenv import load_dotenv
from routes.index import index_bp
from routes.api import api_bp
from db import init_db

load_dotenv()

app = Flask(__name__)

app.config['SECRET_KEY'] = os.getenv('SESSION_TOKEN')
DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() == 'true'

app.register_blueprint(index_bp)
app.register_blueprint(api_bp)

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=DEBUG_MODE)