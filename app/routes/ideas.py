from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models import db, IdeaCard, User, Like, Comment
from app import log_operation_from_request

ideas_bp = Blueprint('ideas', __name__)


@ideas_bp.route('', methods=['GET'])
def list_ideas():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    category = request.args.get('category', '')
    search = request.args.get('search', '')
    user_id = request.args.get('user_id', type=int)
    sort_by = request.args.get('sort_by', 'created_at')
    
    query = IdeaCard.query.filter(IdeaCard.is_public == True, IdeaCard.status == 'published', IdeaCard.is_deleted == False)
    
    if category:
        query = query.filter(IdeaCard.category == category)
    
    if search:
        query = query.filter(
            (IdeaCard.title.ilike(f'%{search}%')) |
            (IdeaCard.content.ilike(f'%{search}%')) |
            (IdeaCard.tags.ilike(f'%{search}%'))
        )
    
    if user_id:
        query = query.filter(IdeaCard.user_id == user_id)
    
    if sort_by == 'likes':
        query = query.outerjoin(Like).group_by(IdeaCard.id).order_by(db.func.count(Like.id).desc())
    elif sort_by == 'comments':
        query = query.outerjoin(Comment).group_by(IdeaCard.id).order_by(db.func.count(Comment.id).desc())
    else:
        query = query.order_by(IdeaCard.created_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'ideas': [idea.to_dict() for idea in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200


@ideas_bp.route('/my', methods=['GET'])
@jwt_required()
def list_my_ideas():
    current_user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', '')
    
    query = IdeaCard.query.filter(IdeaCard.user_id == current_user_id, IdeaCard.is_deleted == False)
    
    if status:
        query = query.filter(IdeaCard.status == status)
    
    pagination = query.order_by(IdeaCard.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'ideas': [idea.to_dict() for idea in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200


@ideas_bp.route('/<int:idea_id>', methods=['GET'])
def get_idea(idea_id):
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    if not idea.is_public and idea.status != 'published':
        return jsonify({'error': 'Idea is not available'}), 403
    
    return jsonify({'idea': idea.to_dict()}), 200


@ideas_bp.route('', methods=['POST'])
@jwt_required()
def create_idea():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    title = data.get('title')
    content = data.get('content')
    
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
    
    idea = IdeaCard(
        title=title,
        content=content,
        category=data.get('category', 'general'),
        tags=data.get('tags', ''),
        image_url=data.get('image_url'),
        is_public=data.get('is_public', True),
        status=data.get('status', 'published'),
        user_id=current_user_id
    )
    
    db.session.add(idea)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='create',
        target_type='idea',
        target_id=idea.id,
        user_id=current_user_id,
        details={'title': idea.title, 'category': idea.category}
    )
    
    return jsonify({
        'message': 'Idea created successfully',
        'idea': idea.to_dict()
    }), 201


@ideas_bp.route('/<int:idea_id>', methods=['PUT'])
@jwt_required()
def update_idea(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    if idea.user_id != current_user_id:
        return jsonify({'error': 'Permission denied'}), 403
    
    data = request.get_json()
    
    old_values = {}
    new_values = {}
    
    if 'title' in data:
        old_values['title'] = idea.title
        new_values['title'] = data['title']
        idea.title = data['title']
    if 'content' in data:
        old_values['content'] = idea.content[:500] if idea.content else ''
        new_values['content'] = data['content'][:500] if data['content'] else ''
        idea.content = data['content']
    if 'category' in data:
        old_values['category'] = idea.category
        new_values['category'] = data['category']
        idea.category = data['category']
    if 'tags' in data:
        old_values['tags'] = idea.tags
        new_values['tags'] = data['tags']
        idea.tags = data['tags']
    if 'image_url' in data:
        old_values['image_url'] = idea.image_url
        new_values['image_url'] = data['image_url']
        idea.image_url = data['image_url']
    if 'is_public' in data:
        old_values['is_public'] = idea.is_public
        new_values['is_public'] = data['is_public']
        idea.is_public = data['is_public']
    if 'status' in data:
        old_values['status'] = idea.status
        new_values['status'] = data['status']
        idea.status = data['status']
    
    db.session.commit()
    
    if old_values:
        log_operation_from_request(
            operation_type='update',
            target_type='idea',
            target_id=idea_id,
            user_id=current_user_id,
            details={'old': old_values, 'new': new_values}
        )
    
    return jsonify({
        'message': 'Idea updated successfully',
        'idea': idea.to_dict()
    }), 200


@ideas_bp.route('/<int:idea_id>', methods=['DELETE'])
@jwt_required()
def delete_idea(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    if idea.user_id != current_user_id:
        return jsonify({'error': 'Permission denied'}), 403
    
    idea.is_deleted = True
    idea.deleted_at = datetime.utcnow()
    idea.deleted_by = current_user_id
    db.session.commit()
    
    log_operation_from_request(
        operation_type='delete',
        target_type='idea',
        target_id=idea_id,
        user_id=current_user_id,
        details={'title': idea.title, 'content_preview': idea.content[:200] if idea.content else ''}
    )
    
    return jsonify({'message': 'Idea deleted successfully'}), 200


@ideas_bp.route('/<int:idea_id>/like', methods=['POST'])
@jwt_required()
def toggle_like(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    existing_like = Like.query.filter_by(
        user_id=current_user_id,
        idea_id=idea_id
    ).first()
    
    if existing_like:
        db.session.delete(existing_like)
        db.session.commit()
        return jsonify({'message': 'Like removed', 'liked': False}), 200
    
    like = Like(user_id=current_user_id, idea_id=idea_id)
    db.session.add(like)
    db.session.commit()
    
    return jsonify({'message': 'Like added', 'liked': True}), 200


@ideas_bp.route('/<int:idea_id>/likes', methods=['GET'])
def get_likes(idea_id):
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    likes = Like.query.filter_by(idea_id=idea_id).all()
    user_ids = [like.user_id for like in likes]
    users = User.query.filter(User.id.in_(user_ids)).all()
    
    return jsonify({
        'likes': len(likes),
        'users': [user.to_dict() for user in users]
    }), 200


@ideas_bp.route('/<int:idea_id>/comments', methods=['GET'])
def get_comments(idea_id):
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    comments = Comment.query.filter_by(
        idea_id=idea_id,
        parent_id=None
    ).order_by(Comment.created_at.desc()).all()
    
    return jsonify({
        'comments': [comment.to_dict() for comment in comments]
    }), 200


@ideas_bp.route('/<int:idea_id>/comments', methods=['POST'])
@jwt_required()
def add_comment(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea or idea.is_deleted:
        return jsonify({'error': 'Idea not found'}), 404
    
    data = request.get_json()
    content = data.get('content')
    parent_id = data.get('parent_id')
    reply_to_user_id = data.get('reply_to_user_id')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    if parent_id:
        parent_comment = Comment.query.get(parent_id)
        if not parent_comment or parent_comment.idea_id != idea_id:
            return jsonify({'error': 'Invalid parent comment'}), 400
    
    if reply_to_user_id:
        reply_to_user = User.query.get(reply_to_user_id)
        if not reply_to_user:
            return jsonify({'error': 'Invalid reply to user'}), 400
    
    comment = Comment(
        content=content,
        user_id=current_user_id,
        idea_id=idea_id,
        parent_id=parent_id,
        reply_to_user_id=reply_to_user_id
    )
    
    db.session.add(comment)
    db.session.commit()
    
    return jsonify({
        'message': 'Comment added successfully',
        'comment': comment.to_dict()
    }), 201


@ideas_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    current_user_id = int(get_jwt_identity())
    comment = Comment.query.get(comment_id)
    
    if not comment:
        return jsonify({'error': 'Comment not found'}), 404
    
    if comment.user_id != current_user_id:
        return jsonify({'error': 'Permission denied'}), 403
    
    idea_id = comment.idea_id
    content_preview = comment.content[:200] if comment.content else ''
    
    db.session.delete(comment)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='delete',
        target_type='comment',
        target_id=comment_id,
        user_id=current_user_id,
        details={'idea_id': idea_id, 'content_preview': content_preview}
    )
    
    return jsonify({'message': 'Comment deleted successfully'}), 200


@ideas_bp.route('/categories', methods=['GET'])
def get_categories():
    categories = db.session.query(
        IdeaCard.category,
        db.func.count(IdeaCard.id).label('count')
    ).filter(
        IdeaCard.is_public == True,
        IdeaCard.status == 'published',
        IdeaCard.is_deleted == False
    ).group_by(IdeaCard.category).all()
    
    return jsonify({
        'categories': [{'name': cat, 'count': count} for cat, count in categories]
    }), 200
