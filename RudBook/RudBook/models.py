from datetime import datetime, timedelta
from app import db
from flask_login import UserMixin
from sqlalchemy import func

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    bio = db.Column(db.Text, default='')
    avatar = db.Column(db.String(200), default='default-avatar.png')
    cover_image = db.Column(db.String(200), default='default-cover.jpg')
    password_hash = db.Column(db.String(256), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    posts = db.relationship('Post', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    stories = db.relationship('Story', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    likes = db.relationship('Like', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    # Following relationships
    following = db.relationship(
        'User', secondary='followers',
        primaryjoin=('User.id == followers.c.follower_id'),
        secondaryjoin=('User.id == followers.c.followed_id'),
        backref=db.backref('followers', lazy='dynamic'),
        lazy='dynamic'
    )
    
    def follow(self, user):
        if not self.is_following(user):
            self.following.append(user)
    
    def unfollow(self, user):
        if self.is_following(user):
            self.following.remove(user)
    
    def is_following(self, user):
        return self.following.filter(
            followers.c.followed_id == user.id).count() > 0
    
    def get_timeline_posts(self):
        followed = self.following.all()
        followed_ids = [user.id for user in followed]
        followed_ids.append(self.id)  # Include own posts
        
        return Post.query.filter(
            Post.user_id.in_(followed_ids)
        ).order_by(Post.created_at.desc())
    
    def get_timeline_stories(self):
        followed = self.following.all()
        followed_ids = [user.id for user in followed]
        
        # Stories from last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)
        return Story.query.filter(
            Story.user_id.in_(followed_ids),
            Story.created_at > yesterday
        ).order_by(Story.created_at.desc())
    
    def __repr__(self):
        return f'<User {self.username}>'

# Association table for followers
followers = db.Table('followers',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'))
)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text)
    image_url = db.Column(db.String(200))
    video_url = db.Column(db.String(200))
    post_type = db.Column(db.String(20), default='text')  # text, image, video, poll, location
    location_name = db.Column(db.String(100))
    location_lat = db.Column(db.Float)
    location_lng = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Sharing functionality
    original_post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=True)
    shares = db.relationship('Post', backref=db.backref('original_post', remote_side=[id]),
                           primaryjoin=(id == original_post_id), lazy='dynamic')
    
    # Relationships
    comments = db.relationship('Comment', backref='post', lazy='dynamic', cascade='all, delete-orphan')
    likes = db.relationship('Like', backref='post', lazy='dynamic', cascade='all, delete-orphan')
    poll_options = db.relationship('PollOption', backref='post', lazy='dynamic', cascade='all, delete-orphan')
    
    def like_count(self):
        return self.likes.count()
        
    def reaction_counts(self):
        reactions = {}
        for like in self.likes:
            reaction_type = like.reaction_type
            reactions[reaction_type] = reactions.get(reaction_type, 0) + 1
        return reactions
    
    def comment_count(self):
        return self.comments.count()
    
    def is_liked_by(self, user):
        return self.likes.filter_by(user_id=user.id).first() is not None
        
    def get_user_reaction(self, user):
        like = self.likes.filter_by(user_id=user.id).first()
        return like.reaction_type if like else None
    
    def __repr__(self):
        return f'<Post {self.id}>'

class Story(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(200), nullable=False)
    video_url = db.Column(db.String(200))
    content = db.Column(db.Text)
    filter_name = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(days=1))
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    views = db.relationship('StoryView', backref='story', lazy='dynamic', cascade='all, delete-orphan')
    
    def is_expired(self):
        return datetime.utcnow() > self.expires_at
    
    def view_count(self):
        return self.views.count()
    
    def is_viewed_by(self, user):
        return self.views.filter_by(user_id=user.id).first() is not None
    
    def __repr__(self):
        return f'<Story {self.id}>'

class StoryView(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey('story.id'), nullable=False)
    
    # Relationships
    user = db.relationship('User', backref='story_views')

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comment.id'))
    
    # Self-referential relationship for replies
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]))
    
    def __repr__(self):
        return f'<Comment {self.id}>'

class Like(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reaction_type = db.Column(db.String(20), default='like')  # like, love, laugh, wow, sad, angry
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    
    # Unique constraint to prevent duplicate likes
    __table_args__ = (db.UniqueConstraint('user_id', 'post_id', name='unique_user_post_like'),)

class PollOption(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(200), nullable=False)
    vote_count = db.Column(db.Integer, default=0)
    
    # Foreign keys
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    
    # Relationships
    votes = db.relationship('PollVote', backref='option', cascade='all, delete-orphan')

class PollVote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    option_id = db.Column(db.Integer, db.ForeignKey('poll_option.id'), nullable=False)
    
    # Relationships
    user = db.relationship('User', backref='poll_votes')
    
    # Unique constraint to prevent duplicate votes
    __table_args__ = (db.UniqueConstraint('user_id', 'option_id', name='unique_user_option_vote'),)

class SavedPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    
    # Unique constraint to prevent duplicate saves
    __table_args__ = (db.UniqueConstraint('user_id', 'post_id', name='unique_user_post_save'),)

class Share(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text)  # Optional comment when sharing
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)

class UserStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    status_text = db.Column(db.String(100))
    mood = db.Column(db.String(50))  # happy, sad, excited, busy, etc
    emoji = db.Column(db.String(10))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
    
    # Foreign key
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Hashtag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    use_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class PostHashtag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    hashtag_id = db.Column(db.Integer, db.ForeignKey('hashtag.id'), nullable=False)
    __table_args__ = (db.UniqueConstraint('post_id', 'hashtag_id', name='unique_post_hashtag'),)

class Schedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    scheduled_time = db.Column(db.DateTime, nullable=False)
    post_content = db.Column(db.Text)
    post_type = db.Column(db.String(20), default='text')
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Badge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(50))
    color = db.Column(db.String(20))
    required_points = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

class UserBadge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badge.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('user_id', 'badge_id', name='unique_user_badge'),)

class GroupChat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    avatar = db.Column(db.String(200))
    is_private = db.Column(db.Boolean, default=False)
    max_members = db.Column(db.Integer, default=50)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class GroupMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group_chat.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # admin, moderator, member
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('group_id', 'user_id', name='unique_group_member'),)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(200))
    audio_url = db.Column(db.String(200))  # For voice messages
    message_type = db.Column(db.String(20), default='text')  # text, image, audio, file
    is_read = db.Column(db.Boolean, default=False)
    reply_to_id = db.Column(db.Integer, db.ForeignKey('message.id'))  # For reply functionality
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    group_id = db.Column(db.Integer, db.ForeignKey('group_chat.id'))  # For group messages
    
    # Relationships
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='received_messages')
    reply_to = db.relationship('Message', remote_side=[id])
    
    def __repr__(self):
        return f'<Message {self.id}>'

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)  # like, comment, follow, message
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    from_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'))
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='notifications')
    from_user = db.relationship('User', foreign_keys=[from_user_id])
    post = db.relationship('Post', foreign_keys=[post_id])
