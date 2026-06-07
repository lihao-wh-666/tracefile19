from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, time, timedelta
import calendar
import json
import hashlib

from app.models import db, User, Project, ProjectMember, ProjectMeeting, DeliveryTask, CalendarEvent
from app import log_operation_from_request, get_local_tz, to_local_time

calendar_bp = Blueprint('calendar', __name__)

_calendar_cache = {}
_CACHE_TTL = 60


def _get_cache_key(user_id, start, end, filters):
    key_str = f"{user_id}:{start}:{end}:{json.dumps(filters, sort_keys=True)}"
    return hashlib.md5(key_str.encode()).hexdigest()


def _get_cached_events(cache_key):
    cached = _calendar_cache.get(cache_key)
    if cached and (datetime.utcnow() - cached['timestamp']).total_seconds() < _CACHE_TTL:
        return cached['data']
    return None


def _set_cached_events(cache_key, data):
    _calendar_cache[cache_key] = {
        'data': data,
        'timestamp': datetime.utcnow()
    }


def _invalidate_user_cache(user_id):
    keys_to_remove = [k for k in _calendar_cache.keys() if k.startswith(f"{user_id}:")]
    for k in keys_to_remove:
        del _calendar_cache[k]


def _get_user_project_ids(user_id):
    memberships = ProjectMember.query.filter_by(user_id=user_id).all()
    return [m.project_id for m in memberships]


def _generate_meeting_occurrences(meeting, start_date, end_date):
    occurrences = []
    current = max(meeting.start_date, start_date)
    meeting_end = meeting.end_date or date(2100, 12, 31)
    last_date = min(meeting_end, end_date)

    if meeting.recurrence_type == 'once':
        if meeting.start_date >= start_date and meeting.start_date <= end_date:
            occurrences.append(meeting.start_date)
        return occurrences

    while current <= last_date:
        if meeting.recurrence_type == 'daily':
            occurrences.append(current)
            current += timedelta(days=1)
        elif meeting.recurrence_type == 'weekly':
            if current.weekday() == meeting.recurrence_day:
                occurrences.append(current)
                current += timedelta(weeks=1)
            else:
                current += timedelta(days=1)
        elif meeting.recurrence_type == 'monthly':
            if current.day == meeting.recurrence_day:
                occurrences.append(current)
                if current.month == 12:
                    current = date(current.year + 1, 1, meeting.recurrence_day)
                else:
                    try:
                        current = date(current.year, current.month + 1, meeting.recurrence_day)
                    except ValueError:
                        current = date(current.year, current.month + 2, 1) - timedelta(days=1)
            else:
                current += timedelta(days=1)

    return occurrences


def _meeting_to_event(meeting, occurrence_date):
    local_tz = get_local_tz()
    start_dt = local_tz.localize(datetime.combine(occurrence_date, meeting.start_time))
    end_dt = local_tz.localize(datetime.combine(occurrence_date, meeting.end_time))

    colors = {
        'weekly': '#8b5cf6',
        'daily': '#06b6d4',
        'monthly': '#f59e0b',
        'once': '#6366f1'
    }

    return {
        'id': f'meeting_{meeting.id}_{occurrence_date.isoformat()}',
        'project_id': meeting.project_id,
        'project_name': meeting.project.name if meeting.project else '',
        'title': meeting.title,
        'description': meeting.description,
        'event_type': 'meeting',
        'event_source_id': meeting.id,
        'start_time': start_dt.isoformat(),
        'end_time': end_dt.isoformat(),
        'location': meeting.location,
        'meeting_link': meeting.meeting_link,
        'color': colors.get(meeting.recurrence_type, '#6366f1'),
        'is_all_day': False,
        'recurrence_type': meeting.recurrence_type,
        'created_by': meeting.created_by
    }


def _delivery_to_event(task):
    colors = {
        'art': '#ec4899',
        'code': '#3b82f6',
        'document': '#10b981',
        'sound': '#f59e0b',
        'general': '#6366f1'
    }

    deadline_local = to_local_time(task.deadline)
    end_time = deadline_local + timedelta(hours=1)

    return {
        'id': f'delivery_{task.id}',
        'project_id': task.project_id,
        'project_name': task.project.name if task.project else '',
        'title': task.title,
        'description': task.description,
        'event_type': 'delivery',
        'event_source_id': task.id,
        'start_time': deadline_local.isoformat(),
        'end_time': end_time.isoformat(),
        'location': '',
        'meeting_link': '',
        'color': colors.get(task.resource_type, '#6366f1'),
        'is_all_day': False,
        'resource_type': task.resource_type,
        'status': task.status,
        'priority': task.priority,
        'assignee': task.assignee.to_dict() if task.assignee else None,
        'created_by': task.created_by
    }


@calendar_bp.route('/events', methods=['GET'])
@jwt_required()
def get_calendar_events():
    current_user_id = int(get_jwt_identity())

    start_str = request.args.get('start')
    end_str = request.args.get('end')
    project_id = request.args.get('project_id', type=int)
    event_type = request.args.get('event_type', '')
    resource_type = request.args.get('resource_type', '')

    if not start_str or not end_str:
        return jsonify({'error': '缺少时间范围参数'}), 400

    try:
        start_date = date.fromisoformat(start_str[:10])
        end_date = date.fromisoformat(end_str[:10])
    except (ValueError, IndexError):
        return jsonify({'error': '时间格式错误'}), 400

    filters = {
        'project_id': project_id,
        'event_type': event_type,
        'resource_type': resource_type
    }

    cache_key = _get_cache_key(current_user_id, start_str, end_str, filters)
    cached = _get_cached_events(cache_key)
    if cached is not None:
        return jsonify(cached), 200

    project_ids = _get_user_project_ids(current_user_id)
    if project_id:
        if project_id not in project_ids:
            return jsonify({'error': '你不是该项目成员'}), 403
        project_ids = [project_id]

    events = []

    if not event_type or event_type == 'meeting':
        meetings = ProjectMeeting.query.filter(
            ProjectMeeting.project_id.in_(project_ids),
            ProjectMeeting.is_active == True,
            ProjectMeeting.start_date <= end_date
        ).all()

        for meeting in meetings:
            occurrences = _generate_meeting_occurrences(meeting, start_date, end_date)
            for occ in occurrences:
                events.append(_meeting_to_event(meeting, occ))

    if not event_type or event_type == 'delivery':
        delivery_query = DeliveryTask.query.filter(
            DeliveryTask.project_id.in_(project_ids),
            DeliveryTask.deadline >= datetime.combine(start_date, time.min),
            DeliveryTask.deadline <= datetime.combine(end_date, time.max)
        )

        if resource_type:
            delivery_query = delivery_query.filter(DeliveryTask.resource_type == resource_type)

        deliveries = delivery_query.all()
        for task in deliveries:
            events.append(_delivery_to_event(task))

    if not event_type or event_type == 'general':
        general_events = CalendarEvent.query.filter(
            CalendarEvent.project_id.in_(project_ids),
            CalendarEvent.start_time <= datetime.combine(end_date, time.max),
            CalendarEvent.end_time >= datetime.combine(start_date, time.min)
        ).all()
        for evt in general_events:
            events.append(evt.to_dict())

    events.sort(key=lambda e: e['start_time'])

    result = {
        'events': events,
        'total': len(events)
    }

    _set_cached_events(cache_key, result)

    return jsonify(result), 200


@calendar_bp.route('/meetings', methods=['GET'])
@jwt_required()
def get_meetings():
    current_user_id = int(get_jwt_identity())
    project_id = request.args.get('project_id', type=int)

    project_ids = _get_user_project_ids(current_user_id)
    if project_id:
        if project_id not in project_ids:
            return jsonify({'error': '你不是该项目成员'}), 403
        project_ids = [project_id]

    meetings = ProjectMeeting.query.filter(
        ProjectMeeting.project_id.in_(project_ids)
    ).order_by(ProjectMeeting.created_at.desc()).all()

    return jsonify({
        'meetings': [m.to_dict() for m in meetings]
    }), 200


@calendar_bp.route('/meetings', methods=['POST'])
@jwt_required()
def create_meeting():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    project_id = data.get('project_id')
    title = data.get('title', '').strip()
    recurrence_type = data.get('recurrence_type', 'weekly')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')
    start_date_str = data.get('start_date')
    end_date_str = data.get('end_date')

    if not project_id or not title or not start_time_str or not end_time_str or not start_date_str:
        return jsonify({'error': '缺少必填字段'}), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404

    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 403

    try:
        start_time = time.fromisoformat(start_time_str)
        end_time = time.fromisoformat(end_time_str)
        start_date = date.fromisoformat(start_date_str)
        end_date = date.fromisoformat(end_date_str) if end_date_str else None
    except ValueError:
        return jsonify({'error': '时间格式错误'}), 400

    if start_time >= end_time:
        return jsonify({'error': '结束时间必须晚于开始时间'}), 400

    if end_date and end_date < start_date:
        return jsonify({'error': '结束日期不能早于开始日期'}), 400

    recurrence_day = data.get('recurrence_day')
    if recurrence_type == 'weekly':
        if recurrence_day is None or recurrence_day < 0 or recurrence_day > 6:
            return jsonify({'error': '周例会需要指定周几 (0-6)'}), 400
    elif recurrence_type == 'monthly':
        if recurrence_day is None or recurrence_day < 1 or recurrence_day > 31:
            return jsonify({'error': '月例会需要指定日期 (1-31)'}), 400
    elif recurrence_type == 'once':
        recurrence_day = None

    meeting = ProjectMeeting(
        project_id=project_id,
        title=title,
        description=data.get('description', ''),
        recurrence_type=recurrence_type,
        recurrence_day=recurrence_day,
        start_time=start_time,
        end_time=end_time,
        location=data.get('location', ''),
        meeting_link=data.get('meeting_link', ''),
        start_date=start_date,
        end_date=end_date,
        created_by=current_user_id
    )

    db.session.add(meeting)
    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='create',
        target_type='meeting',
        target_id=meeting.id,
        user_id=current_user_id,
        details={'title': title, 'project_id': project_id}
    )

    return jsonify({
        'meeting': meeting.to_dict()
    }), 201


@calendar_bp.route('/meetings/<int:meeting_id>', methods=['PUT'])
@jwt_required()
def update_meeting(meeting_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    meeting = ProjectMeeting.query.get(meeting_id)
    if not meeting:
        return jsonify({'error': '例会不存在'}), 404

    membership = ProjectMember.query.filter_by(
        project_id=meeting.project_id,
        user_id=current_user_id
    ).first()
    if not membership or membership.role not in ['owner', 'admin']:
        if meeting.created_by != current_user_id:
            return jsonify({'error': '没有权限修改此例会'}), 403

    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': '标题不能为空'}), 400
        meeting.title = title

    if 'description' in data:
        meeting.description = data['description']

    if 'recurrence_type' in data:
        meeting.recurrence_type = data['recurrence_type']

    if 'recurrence_day' in data:
        meeting.recurrence_day = data['recurrence_day']

    if 'start_time' in data:
        try:
            meeting.start_time = time.fromisoformat(data['start_time'])
        except ValueError:
            return jsonify({'error': '开始时间格式错误'}), 400

    if 'end_time' in data:
        try:
            meeting.end_time = time.fromisoformat(data['end_time'])
        except ValueError:
            return jsonify({'error': '结束时间格式错误'}), 400

    if 'start_date' in data:
        try:
            meeting.start_date = date.fromisoformat(data['start_date'])
        except ValueError:
            return jsonify({'error': '开始日期格式错误'}), 400

    if 'end_date' in data:
        if data['end_date']:
            try:
                meeting.end_date = date.fromisoformat(data['end_date'])
            except ValueError:
                return jsonify({'error': '结束日期格式错误'}), 400
        else:
            meeting.end_date = None

    if 'location' in data:
        meeting.location = data['location']

    if 'meeting_link' in data:
        meeting.meeting_link = data['meeting_link']

    if 'is_active' in data:
        meeting.is_active = data['is_active']

    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='update',
        target_type='meeting',
        target_id=meeting.id,
        user_id=current_user_id,
        details=data
    )

    return jsonify({
        'meeting': meeting.to_dict()
    }), 200


@calendar_bp.route('/meetings/<int:meeting_id>', methods=['DELETE'])
@jwt_required()
def delete_meeting(meeting_id):
    current_user_id = int(get_jwt_identity())

    meeting = ProjectMeeting.query.get(meeting_id)
    if not meeting:
        return jsonify({'error': '例会不存在'}), 404

    membership = ProjectMember.query.filter_by(
        project_id=meeting.project_id,
        user_id=current_user_id
    ).first()
    if not membership or membership.role not in ['owner', 'admin']:
        if meeting.created_by != current_user_id:
            return jsonify({'error': '没有权限删除此例会'}), 403

    meeting_title = meeting.title
    db.session.delete(meeting)
    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='delete',
        target_type='meeting',
        target_id=meeting_id,
        user_id=current_user_id,
        details={'title': meeting_title}
    )

    return jsonify({'message': '例会已删除'}), 200


@calendar_bp.route('/deliveries', methods=['GET'])
@jwt_required()
def get_deliveries():
    current_user_id = int(get_jwt_identity())
    project_id = request.args.get('project_id', type=int)
    status = request.args.get('status', '')
    resource_type = request.args.get('resource_type', '')

    project_ids = _get_user_project_ids(current_user_id)
    if project_id:
        if project_id not in project_ids:
            return jsonify({'error': '你不是该项目成员'}), 403
        project_ids = [project_id]

    query = DeliveryTask.query.filter(DeliveryTask.project_id.in_(project_ids))

    if status:
        query = query.filter(DeliveryTask.status == status)
    if resource_type:
        query = query.filter(DeliveryTask.resource_type == resource_type)

    tasks = query.order_by(DeliveryTask.deadline.asc()).all()

    return jsonify({
        'deliveries': [t.to_dict() for t in tasks]
    }), 200


@calendar_bp.route('/deliveries', methods=['POST'])
@jwt_required()
def create_delivery():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    project_id = data.get('project_id')
    title = data.get('title', '').strip()
    deadline_str = data.get('deadline')

    if not project_id or not title or not deadline_str:
        return jsonify({'error': '缺少必填字段'}), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404

    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 403

    try:
        local_tz = get_local_tz()
        deadline_local = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
        if deadline_local.tzinfo is None:
            deadline_local = local_tz.localize(deadline_local)
        deadline_utc = deadline_local.astimezone(pytz.UTC).replace(tzinfo=None)
    except (ValueError, ImportError):
        import pytz
        try:
            local_tz = get_local_tz()
            deadline_local = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            if deadline_local.tzinfo is None:
                deadline_local = local_tz.localize(deadline_local)
            deadline_utc = deadline_local.astimezone(pytz.UTC).replace(tzinfo=None)
        except ValueError:
            return jsonify({'error': '截止时间格式错误'}), 400

    assignee_id = data.get('assignee_id')
    if assignee_id:
        assignee_membership = ProjectMember.query.filter_by(
            project_id=project_id,
            user_id=assignee_id
        ).first()
        if not assignee_membership:
            return jsonify({'error': '负责人不是项目成员'}), 400

    task = DeliveryTask(
        project_id=project_id,
        title=title,
        description=data.get('description', ''),
        resource_type=data.get('resource_type', 'general'),
        deadline=deadline_utc,
        assignee_id=assignee_id,
        status=data.get('status', 'pending'),
        priority=data.get('priority', 'medium'),
        created_by=current_user_id
    )

    db.session.add(task)
    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='create',
        target_type='delivery_task',
        target_id=task.id,
        user_id=current_user_id,
        details={'title': title, 'project_id': project_id}
    )

    return jsonify({
        'delivery': task.to_dict()
    }), 201


@calendar_bp.route('/deliveries/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_delivery(task_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    task = DeliveryTask.query.get(task_id)
    if not task:
        return jsonify({'error': '交付任务不存在'}), 404

    membership = ProjectMember.query.filter_by(
        project_id=task.project_id,
        user_id=current_user_id
    ).first()
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 403

    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': '标题不能为空'}), 400
        task.title = title

    if 'description' in data:
        task.description = data['description']

    if 'resource_type' in data:
        task.resource_type = data['resource_type']

    if 'deadline' in data:
        import pytz
        try:
            local_tz = get_local_tz()
            deadline_local = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
            if deadline_local.tzinfo is None:
                deadline_local = local_tz.localize(deadline_local)
            task.deadline = deadline_local.astimezone(pytz.UTC).replace(tzinfo=None)
        except ValueError:
            return jsonify({'error': '截止时间格式错误'}), 400

    if 'assignee_id' in data:
        assignee_id = data['assignee_id']
        if assignee_id:
            assignee_membership = ProjectMember.query.filter_by(
                project_id=task.project_id,
                user_id=assignee_id
            ).first()
            if not assignee_membership:
                return jsonify({'error': '负责人不是项目成员'}), 400
        task.assignee_id = assignee_id

    if 'status' in data:
        task.status = data['status']

    if 'priority' in data:
        task.priority = data['priority']

    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='update',
        target_type='delivery_task',
        target_id=task.id,
        user_id=current_user_id,
        details=data
    )

    return jsonify({
        'delivery': task.to_dict()
    }), 200


@calendar_bp.route('/deliveries/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_delivery(task_id):
    current_user_id = int(get_jwt_identity())

    task = DeliveryTask.query.get(task_id)
    if not task:
        return jsonify({'error': '交付任务不存在'}), 404

    membership = ProjectMember.query.filter_by(
        project_id=task.project_id,
        user_id=current_user_id
    ).first()
    if not membership or membership.role not in ['owner', 'admin']:
        if task.created_by != current_user_id:
            return jsonify({'error': '没有权限删除此任务'}), 403

    task_title = task.title
    db.session.delete(task)
    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='delete',
        target_type='delivery_task',
        target_id=task_id,
        user_id=current_user_id,
        details={'title': task_title}
    )

    return jsonify({'message': '交付任务已删除'}), 200


@calendar_bp.route('/events/general', methods=['POST'])
@jwt_required()
def create_general_event():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    title = data.get('title', '').strip()
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')
    project_id = data.get('project_id')

    if not title or not start_time_str or not end_time_str:
        return jsonify({'error': '缺少必填字段'}), 400

    import pytz
    try:
        local_tz = get_local_tz()
        start_local = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_local = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        if start_local.tzinfo is None:
            start_local = local_tz.localize(start_local)
        if end_local.tzinfo is None:
            end_local = local_tz.localize(end_local)
        start_utc = start_local.astimezone(pytz.UTC).replace(tzinfo=None)
        end_utc = end_local.astimezone(pytz.UTC).replace(tzinfo=None)
    except ValueError:
        return jsonify({'error': '时间格式错误'}), 400

    if start_utc >= end_utc:
        return jsonify({'error': '结束时间必须晚于开始时间'}), 400

    if project_id:
        membership = ProjectMember.query.filter_by(
            project_id=project_id,
            user_id=current_user_id
        ).first()
        if not membership:
            return jsonify({'error': '你不是该项目成员'}), 403

    event = CalendarEvent(
        project_id=project_id,
        title=title,
        description=data.get('description', ''),
        event_type=data.get('event_type', 'general'),
        start_time=start_utc,
        end_time=end_utc,
        location=data.get('location', ''),
        meeting_link=data.get('meeting_link', ''),
        color=data.get('color', '#6366f1'),
        is_all_day=data.get('is_all_day', False),
        created_by=current_user_id
    )

    db.session.add(event)
    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='create',
        target_type='calendar_event',
        target_id=event.id,
        user_id=current_user_id,
        details={'title': title}
    )

    return jsonify({
        'event': event.to_dict()
    }), 201


@calendar_bp.route('/events/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_general_event(event_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    event = CalendarEvent.query.get(event_id)
    if not event:
        return jsonify({'error': '事件不存在'}), 404

    if event.created_by != current_user_id:
        membership = None
        if event.project_id:
            membership = ProjectMember.query.filter_by(
                project_id=event.project_id,
                user_id=current_user_id
            ).first()
        if not membership or membership.role not in ['owner', 'admin']:
            return jsonify({'error': '没有权限修改此事件'}), 403

    import pytz
    if 'start_time' in data:
        try:
            local_tz = get_local_tz()
            start_local = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            if start_local.tzinfo is None:
                start_local = local_tz.localize(start_local)
            event.start_time = start_local.astimezone(pytz.UTC).replace(tzinfo=None)
        except ValueError:
            return jsonify({'error': '开始时间格式错误'}), 400

    if 'end_time' in data:
        try:
            local_tz = get_local_tz()
            end_local = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            if end_local.tzinfo is None:
                end_local = local_tz.localize(end_local)
            event.end_time = end_local.astimezone(pytz.UTC).replace(tzinfo=None)
        except ValueError:
            return jsonify({'error': '结束时间格式错误'}), 400

    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': '标题不能为空'}), 400
        event.title = title

    if 'description' in data:
        event.description = data['description']

    if 'location' in data:
        event.location = data['location']

    if 'meeting_link' in data:
        event.meeting_link = data['meeting_link']

    if 'color' in data:
        event.color = data['color']

    if 'is_all_day' in data:
        event.is_all_day = data['is_all_day']

    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='update',
        target_type='calendar_event',
        target_id=event.id,
        user_id=current_user_id,
        details=data
    )

    return jsonify({
        'event': event.to_dict()
    }), 200


@calendar_bp.route('/events/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_general_event(event_id):
    current_user_id = int(get_jwt_identity())

    event = CalendarEvent.query.get(event_id)
    if not event:
        return jsonify({'error': '事件不存在'}), 404

    if event.created_by != current_user_id:
        membership = None
        if event.project_id:
            membership = ProjectMember.query.filter_by(
                project_id=event.project_id,
                user_id=current_user_id
            ).first()
        if not membership or membership.role not in ['owner', 'admin']:
            return jsonify({'error': '没有权限删除此事件'}), 403

    event_title = event.title
    db.session.delete(event)
    db.session.commit()

    _invalidate_user_cache(current_user_id)

    log_operation_from_request(
        operation_type='delete',
        target_type='calendar_event',
        target_id=event_id,
        user_id=current_user_id,
        details={'title': event_title}
    )

    return jsonify({'message': '事件已删除'}), 200


@calendar_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_calendar_summary():
    current_user_id = int(get_jwt_identity())

    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    end_of_month = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])

    project_ids = _get_user_project_ids(current_user_id)

    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)
    week_end = datetime.combine(end_of_week, time.max)
    month_end = datetime.combine(end_of_month, time.max)

    deliveries_today = DeliveryTask.query.filter(
        DeliveryTask.project_id.in_(project_ids),
        DeliveryTask.deadline >= today_start,
        DeliveryTask.deadline <= today_end,
        DeliveryTask.status != 'completed'
    ).count()

    deliveries_week = DeliveryTask.query.filter(
        DeliveryTask.project_id.in_(project_ids),
        DeliveryTask.deadline >= today_start,
        DeliveryTask.deadline <= week_end,
        DeliveryTask.status != 'completed'
    ).count()

    deliveries_month = DeliveryTask.query.filter(
        DeliveryTask.project_id.in_(project_ids),
        DeliveryTask.deadline >= today_start,
        DeliveryTask.deadline <= month_end,
        DeliveryTask.status != 'completed'
    ).count()

    meetings_count = ProjectMeeting.query.filter(
        ProjectMeeting.project_id.in_(project_ids),
        ProjectMeeting.is_active == True
    ).count()

    return jsonify({
        'summary': {
            'deliveries_today': deliveries_today,
            'deliveries_this_week': deliveries_week,
            'deliveries_this_month': deliveries_month,
            'active_meetings': meetings_count,
            'today': today.isoformat()
        }
    }), 200
