# Overview

الكتاب الأحمر (The Red Book) is a comprehensive Arabic social media platform built with Flask. It provides a full-featured social networking experience including user profiles, posts, stories (24-hour temporary content), real-time messaging, and interactive features like likes, comments, and following systems. The platform supports multimedia content with image and video uploads, real-time chat via WebSockets, and advanced features like face filters for camera content.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses a traditional server-side rendered approach with Jinja2 templates, enhanced with modern JavaScript for interactive features. The UI is built with Bootstrap 5 for responsive design and Font Awesome for icons, with custom CSS providing the red-themed Arabic-friendly styling. Real-time features are powered by Socket.IO for WebSocket communication.

## Backend Architecture
Built on Flask with a modular blueprint structure separating concerns:
- **Main routes** (`routes.py`) - Core social media functionality
- **Authentication** (`auth.py`) - User registration, login, logout
- **Models** (`models.py`) - SQLAlchemy ORM models defining database schema
- **App factory** (`app.py`) - Application configuration and extension initialization

The application follows the Model-View-Controller pattern with clear separation between data models, route handlers, and template rendering.

## Database Design
Uses SQLAlchemy ORM with a flexible database configuration supporting both SQLite (development) and PostgreSQL (production via DATABASE_URL environment variable). Key entities include:
- **Users** - Profile information, authentication, relationships
- **Posts** - Main content with text, images, videos, polls
- **Stories** - Temporary 24-hour content with view tracking
- **Messages** - Private messaging between users
- **Social features** - Likes, comments, follows, notifications

The schema includes proper foreign key relationships and cascading deletes for data integrity.

## Authentication & Authorization
Implements Flask-Login for session management with secure password hashing using Werkzeug. Features include:
- User registration with email verification support
- Remember me functionality
- Login protection for authenticated routes
- User activity tracking (last seen)

## File Upload System
Structured file storage with separate directories for different content types:
- `/uploads/avatars/` - User profile pictures
- `/uploads/posts/` - Post attachments
- `/uploads/stories/` - Story media content
Maximum file size limited to 50MB with secure filename handling.

## Real-time Features
Socket.IO integration provides:
- Live messaging with typing indicators
- Real-time notifications
- Online status tracking
- Message delivery confirmation

## Frontend Interactive Features
Advanced JavaScript modules provide:
- **Camera integration** - Photo/video capture with face filters
- **Real-time chat** - WebSocket-based messaging
- **Face filters** - AR effects using browser APIs
- **Media handling** - Image/video processing and upload

# External Dependencies

## Core Framework Dependencies
- **Flask** - Web framework with SQLAlchemy for database ORM
- **Flask-Login** - User session management
- **Flask-SocketIO** - WebSocket support for real-time features
- **Werkzeug** - Security utilities and file handling

## Frontend Libraries
- **Bootstrap 5** - Responsive UI framework
- **Font Awesome 6** - Icon library
- **Google Fonts (Tajawal)** - Arabic typography
- **Socket.IO Client** - Real-time communication

## Database Support
- **SQLite** - Default development database
- **PostgreSQL** - Production database (configurable via DATABASE_URL)

## Media Processing
- Browser native APIs for camera access and face detection
- Custom JavaScript modules for media capture and filtering

## Development Tools
- Python 3.x runtime environment
- File system storage for uploaded media
- Environment variable configuration for deployment flexibility