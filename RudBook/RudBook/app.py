import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

# Initialize extensions
db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
socketio = SocketIO()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.secret_key = os.environ.get("SESSION_SECRET")
    if not app.secret_key:
        raise RuntimeError("SESSION_SECRET environment variable must be set for security")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///redbook.db")
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
    
    # Create upload directory if it doesn't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'stories'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'posts'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'avatars'), exist_ok=True)
    
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    
    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")
    
    # Login manager configuration
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'يرجى تسجيل الدخول للوصول إلى هذه الصفحة.'
    login_manager.login_message_category = 'info'
    
    @login_manager.user_loader
    def load_user(user_id):
        from models import User
        return User.query.get(int(user_id))
    
    # Template filters
    from datetime import datetime
    
    @app.template_filter('moment')
    def moment_filter(dt):
        """Convert datetime to relative time"""
        if not dt:
            return ""
        
        now = datetime.utcnow()
        diff = now - dt
        
        if diff.days > 0:
            if diff.days == 1:
                return "منذ يوم واحد"
            elif diff.days < 7:
                return f"منذ {diff.days} أيام"
            elif diff.days < 30:
                weeks = diff.days // 7
                return f"منذ {weeks} أسبوع" if weeks == 1 else f"منذ {weeks} أسابيع"
            elif diff.days < 365:
                months = diff.days // 30
                return f"منذ {months} شهر" if months == 1 else f"منذ {months} أشهر"
            else:
                years = diff.days // 365
                return f"منذ {years} سنة" if years == 1 else f"منذ {years} سنوات"
        
        seconds = diff.seconds
        if seconds < 60:
            return "منذ لحظات"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"منذ {minutes} دقيقة" if minutes == 1 else f"منذ {minutes} دقائق"
        else:
            hours = seconds // 3600
            return f"منذ {hours} ساعة" if hours == 1 else f"منذ {hours} ساعات"
    
    # Register blueprints
    from routes import main
    from auth import auth_bp
    
    app.register_blueprint(main)
    app.register_blueprint(auth_bp)
    
    # Create database tables
    with app.app_context():
        import models  # Import models to create tables
        db.create_all()
        
        # Create default admin user if not exists
        from models import User
        from werkzeug.security import generate_password_hash
        
        # Removed insecure default admin creation
        # Admin users should be created manually with proper credentials
        pass
    
    return app

# Create the app instance
app = create_app()
