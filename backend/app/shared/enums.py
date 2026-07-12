import enum


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class MemberStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"
    frozen = "frozen"


class GenderType(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


class DifficultyLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class MembershipStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"
    frozen = "frozen"
    pending = "pending"


class SaleStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"
    refunded = "refunded"


class DebtStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"
    written_off = "written_off"
    disputed = "disputed"


class ClassStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class EnrollmentStatus(str, enum.Enum):
    enrolled = "enrolled"
    attended = "attended"
    absent = "absent"
    cancelled = "cancelled"


class AttendanceMethod(str, enum.Enum):
    manual = "manual"
    qr_code = "qr_code"
    card = "card"


class RoutineStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    paused = "paused"
    cancelled = "cancelled"


class ReminderType(str, enum.Enum):
    membership_expiry = "membership_expiry"
    payment_due = "payment_due"
    birthday = "birthday"
    class_reminder = "class_reminder"
    custom = "custom"


class NotificationChannel(str, enum.Enum):
    email = "email"
    whatsapp = "whatsapp"
    sms = "sms"
    in_app = "in_app"


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    cancelled = "cancelled"


class PromotionType(str, enum.Enum):
    percentage = "percentage"
    fixed_amount = "fixed_amount"


class PromotionScope(str, enum.Enum):
    all = "all"
    memberships = "memberships"
    products = "products"
    classes = "classes"


class MovementType(str, enum.Enum):
    purchase = "purchase"
    sale = "sale"
    adjustment = "adjustment"
    return_ = "return"


class AuditAction(str, enum.Enum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
