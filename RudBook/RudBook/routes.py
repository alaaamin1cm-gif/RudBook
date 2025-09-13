from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_from_directory, current_app
from flask_login import login_required, current_user
from flask_socketio import emit, join_room, leave_room
from werkzeug.utils import secure_filename
from sqlalchemy import func
from app import db, socketio
from models import User, Post, Story, Comment, Like, Message, Notification, PollOption, PollVote, StoryView
from datetime import datetime, timedelta
import os
import uuid

main = Blueprint('main', __name__)

@main.route('/')
@login_required
def index():
    # Get all posts from all users, ordered by creation date
    posts = Post.query.order_by(Post.created_at.desc()).limit(20).all()
    
    # Get all active stories
    stories = Story.query.filter(
        Story.created_at >= datetime.utcnow() - timedelta(hours=24)
    ).order_by(Story.created_at.desc()).limit(20).all()
    
    # Get user suggestions (users not followed by current user)
    suggested_users = User.query.filter(
        User.id != current_user.id,
        ~User.id.in_([f.id for f in current_user.following.all()])
    ).order_by(func.random()).limit(5).all()
    
    return render_template('index.html', 
                         posts=posts, 
                         stories=stories, 
                         suggested_users=suggested_users,
                         Comment=Comment)

@main.route('/profile/<username>')
@login_required
def user_profile(username):
    user = User.query.filter_by(username=username).first_or_404()
    posts = Post.query.filter_by(user_id=user.id, is_active=True).order_by(Post.created_at.desc()).all()
    
    # Get user's stories from last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    stories = Story.query.filter(
        Story.user_id == user.id,
        Story.created_at > yesterday,
        Story.is_active == True
    ).order_by(Story.created_at.desc()).all()
    
    is_following = current_user.is_following(user) if user.id != current_user.id else False
    
    return render_template('profile.html', 
                         user=user, 
                         posts=posts, 
                         stories=stories,
                         is_following=is_following,
                         is_own_profile=(user.id == current_user.id),
                         Comment=Comment)

@main.route('/follow/<int:user_id>', methods=['POST'])
@login_required
def follow_user(user_id):
    user = User.query.get_or_404(user_id)
    
    if user.id == current_user.id:
        return jsonify({'error': 'لا يمكنك متابعة نفسك'}), 400
    
    if current_user.is_following(user):
        current_user.unfollow(user)
        action = 'unfollow'
    else:
        current_user.follow(user)
        action = 'follow'
        
        # Create notification
        notification = Notification(
            user_id=user.id,
            from_user_id=current_user.id,
            title='متابع جديد',
            message=f'{current_user.full_name} بدأ بمتابعتك',
            notification_type='follow'
        )
        db.session.add(notification)
    
    try:
        db.session.commit()
        return jsonify({'status': 'success', 'action': action})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ'}), 500

@main.route('/share_post/<int:post_id>', methods=['POST'])
@login_required
def share_post(post_id):
    original_post = Post.query.get_or_404(post_id)
    
    # Check if post is already shared by the user
    existing_share = Post.query.filter_by(
        user_id=current_user.id,
        original_post_id=post_id
    ).first()
    
    if existing_share:
        return jsonify({'error': 'لقد قمت بمشاركة هذا المنشور مسبقاً'}), 400
    
    # Create new shared post
    share_content = request.form.get('content', '').strip()  # Optional comment on share
    shared_post = Post(
        content=share_content,
        user_id=current_user.id,
        original_post_id=post_id,
        post_type='share'
    )
    
    try:
        db.session.add(shared_post)
        
        # Create notification for original post owner
        if original_post.user_id != current_user.id:
            notification = Notification(
                user_id=original_post.user_id,
                from_user_id=current_user.id,
                title='مشاركة منشور',
                message=f'{current_user.full_name} قام بمشاركة منشورك',
                notification_type='share',
                post_id=post_id
            )
            db.session.add(notification)
            
            # Emit real-time notification
            socketio.emit('new_notification', {
                'user_id': original_post.user_id,
                'message': f'{current_user.full_name} قام بمشاركة منشورك',
                'timestamp': datetime.utcnow().isoformat()
            }, room=f'user_{original_post.user_id}')
        
        db.session.commit()
        return jsonify({
            'status': 'success',
            'message': 'تمت مشاركة المنشور بنجاح'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ أثناء مشاركة المنشور'}), 500

@main.route('/create_post', methods=['POST'])
@login_required
def create_post():
    content = request.form.get('content', '').strip()
    post_type = request.form.get('post_type', 'text')
    location_name = request.form.get('location_name')
    
    if not content and post_type == 'text':
        flash('يرجى إدخال محتوى المنشور', 'error')
        return redirect(url_for('main.index'))
    
    post = Post(
        user_id=current_user.id,
        content=content,
        post_type=post_type,
        location_name=location_name
    )
    
    # Handle file uploads
    if post_type == 'image' and 'image' in request.files:
        file = request.files['image']
        if file and allowed_file(file.filename, ['png', 'jpg', 'jpeg', 'gif', 'webp']):
            filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], 'posts', filename)
            file.save(filepath)
            post.image_url = filename
    
    elif post_type == 'video' and 'video' in request.files:
        file = request.files['video']
        if file and allowed_file(file.filename, ['mp4', 'webm', 'ogg']):
            filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], 'posts', filename)
            file.save(filepath)
            post.video_url = filename
    
    elif post_type == 'poll':
        poll_options = request.form.getlist('poll_options[]')
        if len(poll_options) < 2:
            flash('يجب إضافة خيارين على الأقل للاستطلاع', 'error')
            return redirect(url_for('main.index'))
    
    try:
        db.session.add(post)
        db.session.commit()
        
        # Add poll options if it's a poll
        if post_type == 'poll':
            for option_text in poll_options:
                if option_text.strip():
                    option = PollOption(post_id=post.id, text=option_text.strip())
                    db.session.add(option)
            db.session.commit()
        
        flash('تم نشر المنشور بنجاح', 'success')
    except Exception as e:
        db.session.rollback()
        flash('حدث خطأ أثناء نشر المنشور', 'error')
    
    return redirect(url_for('main.index'))

@main.route('/create_story', methods=['POST'])
@login_required
def create_story():
    content = request.form.get('content', '').strip()
    filter_name = request.form.get('filter_name', '')
    
    if 'story_media' not in request.files:
        flash('يرجى اختيار صورة أو فيديو للقصة', 'error')
        return redirect(url_for('main.index'))
    
    file = request.files['story_media']
    if not file or file.filename == '':
        flash('يرجى اختيار ملف صحيح', 'error')
        return redirect(url_for('main.index'))
    
    story = Story(
        user_id=current_user.id,
        content=content,
        filter_name=filter_name
    )
    
    # Handle media upload
    if allowed_file(file.filename, ['png', 'jpg', 'jpeg', 'gif', 'webp']):
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], 'stories', filename)
        file.save(filepath)
        story.image_url = filename
    elif allowed_file(file.filename, ['mp4', 'webm', 'ogg']):
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], 'stories', filename)
        file.save(filepath)
        story.video_url = filename
    else:
        flash('نوع الملف غير مدعوم', 'error')
        return redirect(url_for('main.index'))
    
    try:
        db.session.add(story)
        db.session.commit()
        flash('تم إضافة القصة بنجاح', 'success')
    except Exception as e:
        db.session.rollback()
        flash('حدث خطأ أثناء إضافة القصة', 'error')
    
    return redirect(url_for('main.index'))

@main.route('/story/<int:story_id>')
@login_required
def view_story(story_id):
    story = Story.query.get_or_404(story_id)
    
    # Check if story is expired
    if story.is_expired():
        flash('هذه القصة منتهية الصلاحية', 'error')
        return redirect(url_for('main.index'))
    
    # Add story view if not already viewed
    if not story.is_viewed_by(current_user):
        view = StoryView(user_id=current_user.id, story_id=story.id)
        db.session.add(view)
        db.session.commit()
    
    # Get user's other stories
    user_stories = Story.query.filter(
        Story.user_id == story.user_id,
        Story.created_at > datetime.utcnow() - timedelta(days=1),
        Story.is_active == True
    ).order_by(Story.created_at.asc()).all()
    
    return render_template('story_viewer.html', 
                         story=story, 
                         user_stories=user_stories)

@main.route('/like_post/<int:post_id>', methods=['POST'])
@login_required
def like_post(post_id):
    post = Post.query.get_or_404(post_id)
    
    existing_like = Like.query.filter_by(user_id=current_user.id, post_id=post_id).first()
    
    if existing_like:
        db.session.delete(existing_like)
        action = 'unliked'
    else:
        like = Like(user_id=current_user.id, post_id=post_id)
        db.session.add(like)
        action = 'liked'
        
        # Create notification for post author
        if post.user_id != current_user.id:
            notification = Notification(
                user_id=post.user_id,
                from_user_id=current_user.id,
                post_id=post.id,
                title='إعجاب جديد',
                message=f'{current_user.full_name} أعجب بمنشورك',
                notification_type='like'
            )
            db.session.add(notification)
    
    try:
        db.session.commit()
        return jsonify({
            'status': 'success',
            'action': action,
            'like_count': post.like_count()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ'}), 500

@main.route('/add_comment', methods=['POST'])
@login_required
def add_comment():
    post_id = request.form.get('post_id')
    content = request.form.get('content', '').strip()
    
    if not content:
        return jsonify({'error': 'يرجى إدخال تعليق'}), 400
    
    post = Post.query.get_or_404(post_id)
    
    comment = Comment(
        user_id=current_user.id,
        post_id=post_id,
        content=content
    )
    
    try:
        db.session.add(comment)
        
        # Create notification for post author
        if post.user_id != current_user.id:
            notification = Notification(
                user_id=post.user_id,
                from_user_id=current_user.id,
                post_id=post.id,
                title='تعليق جديد',
                message=f'{current_user.full_name} علق على منشورك',
                notification_type='comment'
            )
            db.session.add(notification)
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'comment': {
                'id': comment.id,
                'content': comment.content,
                'author': comment.author.full_name,
                'author_avatar': comment.author.avatar,
                'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M')
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ'}), 500

@main.route('/messages')
@login_required
def messages():
    # Get conversations (distinct users who exchanged messages with current user)
    conversations = db.session.query(User).join(
        Message, (Message.sender_id == User.id) | (Message.recipient_id == User.id)
    ).filter(
        Message.sender_id == current_user.id or Message.recipient_id == current_user.id,
        User.id != current_user.id
    ).distinct().all()
    
    return render_template('messages.html', conversations=conversations)

@main.route('/chat/<int:user_id>')
@login_required
def chat(user_id):
    user = User.query.get_or_404(user_id)
    
    # Get message history
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.recipient_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.recipient_id == current_user.id))
    ).order_by(Message.created_at.asc()).all()
    
    # Mark messages as read
    unread_messages = Message.query.filter(
        Message.sender_id == user_id,
        Message.recipient_id == current_user.id,
        Message.is_read == False
    ).all()
    
    for msg in unread_messages:
        msg.is_read = True
    
    db.session.commit()
    
    return render_template('chat.html', user=user, messages=messages)

@main.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)

# Socket.IO events for real-time messaging
@socketio.on('join')
def on_join(data):
    username = data['username']
    room = data['room']
    join_room(room)
    emit('status', {'msg': f'{username} انضم إلى المحادثة'}, room=room)

@socketio.on('leave')
def on_leave(data):
    username = data['username']
    room = data['room']
    leave_room(room)
    emit('status', {'msg': f'{username} غادر المحادثة'}, room=room)

@socketio.on('send_message')
def handle_message(data):
    content = data['message']
    recipient_id = data['recipient_id']
    room = data['room']
    
    if not content.strip():
        return
    
    # Save message to database
    message = Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=content
    )
    
    db.session.add(message)
    db.session.commit()
    
    # Emit message to room
    emit('receive_message', {
        'message': content,
        'sender_id': current_user.id,
        'sender_name': current_user.full_name,
        'sender_avatar': current_user.avatar,
        'timestamp': message.created_at.strftime('%H:%M')
    }, room=room)

def allowed_file(filename, extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in extensions

# API Endpoints
@main.route('/api/notifications')
@login_required
def get_notifications():
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).limit(20).all()
    
    notifications_data = []
    for notification in notifications:
        from_user = User.query.get(notification.from_user_id) if notification.from_user_id else None
        notifications_data.append({
            'id': notification.id,
            'title': notification.title,
            'message': notification.message,
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat(),
            'from_user_avatar': from_user.avatar if from_user else None
        })
    
    return jsonify({'notifications': notifications_data})

@main.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    notification = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first_or_404()
    notification.is_read = True
    db.session.commit()
    
    return jsonify({'status': 'success'})

@main.route('/search')
@login_required
def search():
    query = request.args.get('q', '').strip()
    search_type = request.args.get('type', 'all')  # all, users, posts, hashtags
    sort_by = request.args.get('sort', 'relevance')  # relevance, recent, popular
    
    if not query:
        return jsonify({'users': [], 'posts': [], 'hashtags': []})
    
    results = {
        'users': [],
        'posts': [],
        'hashtags': []
    }
    
    # Advanced user search
    if search_type in ['all', 'users']:
        users_query = User.query.filter(
            db.or_(
                User.full_name.ilike(f'%{query}%'),
                User.username.ilike(f'%{query}%'),
                User.bio.ilike(f'%{query}%')
            )
        ).filter(User.id != current_user.id)
        
        # Sort users
        if sort_by == 'popular':
            users_query = users_query.order_by(User.followers.count().desc())
        else:
            users_query = users_query.order_by(User.full_name)
            
        users = users_query.limit(10).all()
        
        for user in users:
            results['users'].append({
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'avatar': user.avatar,
                'bio': user.bio[:100] if user.bio else '',
                'follower_count': user.followers.count(),
                'is_verified': getattr(user, 'is_verified', False)
            })
    
    # Advanced post search
    if search_type in ['all', 'posts']:
        posts_query = Post.query.filter(
            db.or_(
                Post.content.ilike(f'%{query}%'),
                Post.location_name.ilike(f'%{query}%')
            ),
            Post.is_active == True
        )
        
        # Sort posts
        if sort_by == 'popular':
            posts_query = posts_query.order_by(Post.like_count().desc())
        elif sort_by == 'recent':
            posts_query = posts_query.order_by(Post.created_at.desc())
        else:  # relevance
            posts_query = posts_query.order_by(Post.created_at.desc())
            
        posts = posts_query.limit(15).all()
        
        for post in posts:
            results['posts'].append({
                'id': post.id,
                'content': post.content[:150] + '...' if len(post.content or '') > 150 else post.content,
                'author': {
                    'id': post.author.id,
                    'username': post.author.username,
                    'full_name': post.author.full_name,
                    'avatar': post.author.avatar
                },
                'created_at': post.created_at.isoformat(),
                'like_count': post.like_count(),
                'comment_count': post.comment_count(),
                'post_type': post.post_type,
                'image_url': post.image_url,
                'location_name': post.location_name
            })
    
    # Hashtag search (extract hashtags from query)
    if search_type in ['all', 'hashtags'] and query.startswith('#'):
        hashtag = query[1:]  # Remove # symbol
        hashtag_posts = Post.query.filter(
            Post.content.ilike(f'%#{hashtag}%'),
            Post.is_active == True
        ).order_by(Post.created_at.desc()).limit(10).all()
        
        results['hashtags'].append({
            'tag': hashtag,
            'post_count': len(hashtag_posts),
            'recent_posts': [{
                'id': post.id,
                'content': post.content[:100] + '...' if len(post.content or '') > 100 else post.content,
                'author_name': post.author.full_name
            } for post in hashtag_posts[:3]]
        })
    
    return jsonify(results)

@main.route('/search/advanced')
@login_required
def advanced_search():
    return render_template('search/advanced.html')

# Settings Pages
@main.route('/settings/profile')
@login_required
def edit_profile():
    return render_template('settings/edit_profile.html', user=current_user)

@main.route('/settings/privacy')
@login_required
def privacy_settings():
    return render_template('settings/privacy.html')

@main.route('/settings/notifications')
@login_required
def notification_settings():
    return render_template('settings/notifications.html')

@main.route('/settings/password')
@login_required
def change_password():
    return render_template('settings/password.html')

@main.route('/about')
@login_required
def about():
    return render_template('info/about.html')

@main.route('/help')
@login_required
def help():
    return render_template('info/help.html')

# Followers and Following Pages
@main.route('/profile/<username>/followers')
@login_required
def user_followers(username):
    user = User.query.filter_by(username=username).first_or_404()
    followers = user.followers.all()
    
    return render_template('social/followers.html', 
                         user=user, 
                         followers=followers,
                         is_own_profile=(user.id == current_user.id))

@main.route('/profile/<username>/following')
@login_required
def user_following(username):
    user = User.query.filter_by(username=username).first_or_404()
    following = user.following.all()
    
    return render_template('social/following.html', 
                         user=user, 
                         following=following,
                         is_own_profile=(user.id == current_user.id))

# Share post
@main.route('/share_post/<int:post_id>', methods=['POST'])
@login_required
def share_post(post_id):
    original_post = Post.query.get_or_404(post_id)
    
    # Check if the original post is already a shared post
    if original_post.original_post_id:
        # If it is, use its original post as the source
        original_post_id = original_post.original_post_id
    else:
        # If it's not, use this post as the source
        original_post_id = original_post.id
    
    # Create new post as a share
    shared_post = Post(
        content=request.form.get('content', ''),  # Optional comment on share
        post_type='share',
        user_id=current_user.id,
        original_post_id=original_post_id
    )
    
    try:
        db.session.add(shared_post)
        db.session.commit()
        
        # Create notification for original post author
        if current_user.id != original_post.user_id:
            notification = Notification(
                user_id=original_post.user_id,
                actor_id=current_user.id,
                notification_type='share',
                reference_id=shared_post.id
            )
            db.session.add(notification)
            db.session.commit()
            
            # Emit real-time notification
            socketio.emit('new_notification', {
                'user_id': original_post.user_id,
                'message': f'{current_user.username} قام بمشاركة منشورك'
            })
        
        flash('تمت مشاركة المنشور بنجاح', 'success')
        return jsonify({'status': 'success', 'message': 'تمت مشاركة المنشور بنجاح'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ أثناء مشاركة المنشور'}), 500

# Delete Operations
@main.route('/delete_post/<int:post_id>', methods=['POST'])
@login_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    
    if post.author != current_user:
        return jsonify({'error': 'غير مصرح لك بحذف هذا المنشور'}), 403
    
    try:
        # Delete associated files
        if post.image_url:
            try:
                import os
                os.remove(os.path.join('uploads', 'posts', post.image_url))
            except:
                pass
        if post.video_url:
            try:
                import os
                os.remove(os.path.join('uploads', 'posts', post.video_url))
            except:
                pass
        
        db.session.delete(post)
        db.session.commit()
        flash('تم حذف المنشور بنجاح', 'success')
        return jsonify({'status': 'success', 'message': 'تم حذف المنشور بنجاح'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ أثناء الحذف'}), 500

@main.route('/delete_story/<int:story_id>', methods=['POST'])
@login_required  
def delete_story(story_id):
    story = Story.query.get_or_404(story_id)
    
    if story.author != current_user:
        return jsonify({'error': 'غير مصرح لك بحذف هذه القصة'}), 403
    
    try:
        # Delete associated files
        if story.image_url:
            try:
                import os
                os.remove(os.path.join('uploads', 'stories', story.image_url))
            except:
                pass
        if story.video_url:
            try:
                import os
                os.remove(os.path.join('uploads', 'stories', story.video_url))
            except:
                pass
        
        db.session.delete(story)
        db.session.commit()
        flash('تم حذف القصة بنجاح', 'success')
        return jsonify({'status': 'success', 'message': 'تم حذف القصة بنجاح'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'حدث خطأ أثناء الحذف'}), 500

@main.route('/update_cover', methods=['POST'])
@login_required
def update_cover():
    if 'cover' not in request.files:
        return jsonify({'error': 'لم يتم العثور على الملف'}), 400
    
    file = request.files['cover']
    if file.filename == '':
        return jsonify({'error': 'لم يتم اختيار ملف'}), 400
    
    if file and allowed_file(file.filename):
        import uuid
        from werkzeug.utils import secure_filename
        import os
        
        # Create covers directory if it doesn't exist
        covers_dir = os.path.join('uploads', 'covers')
        os.makedirs(covers_dir, exist_ok=True)
        
        # Generate unique filename
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(covers_dir, filename)
        
        try:
            file.save(filepath)
            
            # Update user's cover image
            current_user.cover_image = filename
            db.session.commit()
            
            return jsonify({'status': 'success', 'message': 'تم تحديث صورة الغلاف بنجاح'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'حدث خطأ أثناء حفظ الصورة'}), 500
    
    return jsonify({'error': 'نوع الملف غير مدعوم'}), 400
