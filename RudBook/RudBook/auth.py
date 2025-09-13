from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from app import db
from models import User
import os
import uuid

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = bool(request.form.get('remember', False))
        
        if not username or not password:
            flash('يرجى إدخال اسم المستخدم وكلمة المرور', 'error')
            return render_template('login.html')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user, remember=remember)
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            return redirect(url_for('main.index'))
        else:
            flash('اسم المستخدم أو كلمة المرور غير صحيحة', 'error')
    
    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        full_name = request.form.get('full_name')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validation
        if not all([username, email, full_name, password, confirm_password]):
            flash('يرجى ملء جميع الحقول المطلوبة', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('كلمة المرور وتأكيدها غير متطابقين', 'error')
            return render_template('register.html')
        
        if not password or len(password) < 6:
            flash('يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل', 'error')
            return render_template('register.html')
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            flash('اسم المستخدم موجود مسبقاً', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            flash('البريد الإلكتروني موجود مسبقاً', 'error')
            return render_template('register.html')
        
        # Create new user
        user = User()
        user.username = username
        user.email = email
        user.full_name = full_name
        user.password_hash = generate_password_hash(password) if password else ''
        
        try:
            db.session.add(user)
            db.session.commit()
            
            login_user(user)
            flash('تم إنشاء الحساب بنجاح!', 'success')
            return redirect(url_for('main.index'))
        
        except Exception as e:
            db.session.rollback()
            flash('حدث خطأ أثناء إنشاء الحساب', 'error')
            return render_template('register.html')
    
    return render_template('register.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('تم تسجيل الخروج بنجاح', 'success')
    return redirect(url_for('auth.login'))

@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        full_name = request.form.get('full_name')
        bio = request.form.get('bio')
        email = request.form.get('email')
        
        # Handle avatar upload
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and file.filename != '':
                if allowed_file(file.filename):
                    filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
                    filepath = os.path.join('uploads/avatars', filename)
                    file.save(filepath)
                    current_user.avatar = filename
                else:
                    flash('نوع الملف غير مدعوم. يرجى اختيار صورة (jpg, png, gif)', 'error')
                    return render_template('profile.html', user=current_user)
        
        # Update user info
        if full_name:
            current_user.full_name = full_name
        if bio:
            current_user.bio = bio
        if email and email != current_user.email:
            # Check if email already exists
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                flash('البريد الإلكتروني موجود مسبقاً', 'error')
                return render_template('profile.html', user=current_user)
            current_user.email = email
        
        try:
            db.session.commit()
            flash('تم تحديث الملف الشخصي بنجاح', 'success')
        except Exception as e:
            db.session.rollback()
            flash('حدث خطأ أثناء تحديث الملف الشخصي', 'error')
    
    return render_template('profile.html', user=current_user)

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
