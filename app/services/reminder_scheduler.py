import threading
import time
from datetime import datetime, timedelta
from flask import current_app

from app.models import db, EventReminder, CalendarEvent
from app.services.notification_service import send_event_reminder


class ReminderScheduler:
    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._check_interval = 60
        self._app = None

    def init_app(self, app):
        self._app = app

    def start(self):
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        print("Reminder scheduler started")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        print("Reminder scheduler stopped")

    def _run(self):
        while not self._stop_event.is_set():
            try:
                with self._app.app_context():
                    self._check_and_send_reminders()
            except Exception as e:
                print(f"Error in reminder scheduler: {e}")
                import traceback
                traceback.print_exc()

            self._stop_event.wait(self._check_interval)

    def _check_and_send_reminders(self):
        now = datetime.utcnow()
        look_ahead = now + timedelta(hours=48)

        pending_reminders = EventReminder.query.filter(
            EventReminder.is_sent == False,
            EventReminder.event != None
        ).join(CalendarEvent).filter(
            CalendarEvent.start_time <= look_ahead,
            CalendarEvent.start_time > now - timedelta(hours=1)
        ).all()

        sent_count = 0
        for reminder in pending_reminders:
            event = reminder.event
            if not event:
                continue

            remind_time = event.start_time - timedelta(minutes=reminder.remind_before_minutes)

            if now >= remind_time and now < event.start_time:
                try:
                    send_event_reminder(reminder, event)
                    sent_count += 1
                except Exception as e:
                    print(f"Error sending reminder {reminder.id}: {e}")

        if sent_count > 0:
            print(f"Sent {sent_count} event reminders")


reminder_scheduler = ReminderScheduler()
