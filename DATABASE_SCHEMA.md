# Cohort Manager — Current MongoDB Schema

This document describes the application data model from the backend source. MongoDB is schemaless; these are the document shapes used by the application, not MongoDB-enforced validators. No demo or seed records are included here.

## Database

- Default database: `cohort_manager` (`DATABASE_NAME` can override it).
- Documents use MongoDB `_id` values, generally `ObjectId`.
- Some references are represented as strings and some as `ObjectId` values for compatibility with existing API paths.
- Passwords are stored as bcrypt hashes. Attendance is embedded in session documents.

## Collections

### `users`

Login identities for administrators, mentors, and nominators.

```js
{
  _id: ObjectId,
  name: String,
  email: String,                   // unique
  passwordHash: String,
  role: "admin" | "mentor" | "nominator",
  isActive: Boolean,
  employeeId: String?,
  firstLoginPasswordReset: Boolean?,
  temporaryPassword: String?,      // transitional setup field
  createdAt: Date?, updatedAt: Date?, lastLoginAt: Date?
}
```

### `cohorts`

```js
{
  _id: ObjectId,
  name: String,
  description: String?,
  startDate: String,
  endDate: String,
  status: "draft" | "active" | "closed",
  trainingPlanId: String?,
  feedbackFormId: String?,
  talentnextCourses: [{ courseId: String, isMandatory: Boolean }],
  createdBy: String,
  createdAt: Date
}
```

### `mentors`

```js
{
  _id: ObjectId,
  cohortId: String | null,   // null = nominated but not yet added to a cohort
  nominatedBy: String?,
  userId: String?,                 // linked login in users
  name: String,
  email: String,
  employeeId: String?,
  department: String?,
  location: String?,
  timezone: String?,
  experience: String?,
  skills: [String]?,
  status: String?,
  createdAt: Date?, approvedAt: Date?
}
```

### `trainees`

```js
{
  _id: ObjectId,
  cohortId: String | null,   // null = nominated but not yet added to a cohort
  nominatedBy: String?,
  mentorId: ObjectId | String?,   // assigned mentor profile
  name: String,
  email: String,
  employeeId: String?,
  department: String?,
  location: String?,
  timezone: String?,
  experience: String?,
  skills: [String]?,
  status: String?,                // includes "dropped_out"
  droppedOutAt: Date?,
  droppedOutBy: String?,
  dropoutReason: String?,
  createdAt: Date?, approvedAt: Date?
}
```

Dropped-out trainees remain stored so cohort and attendance history can be reported.

### `trainingTemplates` and `cohortTrainingPlans`

`trainingTemplates` are reusable training plans. `cohortTrainingPlans` stores the cohort-specific plan copy.

```js
{
  _id: ObjectId,
  cohortId: ObjectId | String?,   // present on cohort plan copies
  name: String,
  totalWeeks: Number,
  coreWeeks: Number?,             // cohort plan copy
  bufferWeeks: Number?,           // cohort plan copy
  weeks: [{
    weekNumber: Number,
    title: String,
    isBuffer: Boolean?,
    courses: [{
      courseId: String?,
      title: String,
      description: String?,
      durationHrs: Number?
    }]
  }],
  talentnextCourses: [{
    courseId: String,              // references talentnextCourses._id
    isMandatory: Boolean
  }],
  createdAt: Date
}
```

TalentNext assignments configured on a reusable template are copied into the cohort plan and cohort when that template is applied. The cohort copy can subsequently be managed independently.

### `feedbackTemplates` and `cohortFeedbackForms`

Reusable feedback templates and their cohort-specific copies.

```js
{
  _id: ObjectId,
  cohortId: ObjectId | String?,   // present on cohort form copies
  name: String,
  fields: [{
    key: String,
    label: String,
    type: "rating" | "text" | "select",
    options: [String]?,
    required: Boolean
  }],
  createdAt: Date
}
```

### `progress`

```js
{
  _id: ObjectId,
  cohortId: ObjectId | String,
  traineeId: ObjectId | String,   // unique per trainee
  mentorId: ObjectId | String?,
  planId: ObjectId | String?,
  items: [{
    weekNumber: Number,
    courseId: String?,
    title: String?,
    completed: Boolean,
    completedAt: Date?,
    completedBy: String?
  }],
  percentComplete: Number?,
  createdAt: Date?, updatedAt: Date?
}
```

### `feedbackResponses`

```js
{
  _id: ObjectId,
  cohortId: ObjectId | String,
  traineeId: ObjectId | String,
  mentorId: ObjectId | String?,
  formId: ObjectId | String?,
  weekNumber: Number,
  answers: Object,
  submittedAt: Date?
}
```

There is a unique index on `(traineeId, weekNumber)`.

### `talentnextCourses` and `talentnextProgress`

```js
// talentnextCourses
{ _id: ObjectId, name: String, createdAt: Date? }

// talentnextProgress
{
  _id: ObjectId,
  cohortId: ObjectId | String,
  traineeId: ObjectId | String,
  completionMap: {
    [courseId: string]: {
      completed: Boolean,
      completedAt: Date?,
      completedBy: String?
    }
  },
  createdAt: Date?, updatedAt: Date?
}
```

### `batches`

A mentor-created group of trainees within a cohort.

```js
{
  _id: ObjectId,
  mentorId: ObjectId,
  cohortId: ObjectId,
  name: String,
  description: String?,
  timezone: String?,
  trainingLevel: String?,
  maxTrainees: Number?,
  startDate: Date?, endDate: Date?,
  status: "draft" | "active" | "completed" | "paused" | "archived",
  traineeIds: [ObjectId],
  createdAt: Date,
  updatedAt: Date?
}
```

A trainee can belong to at most one active batch at a time. The application enforces this rule.

### `sessions`

A scheduled mentor meeting for one batch. **Attendance is stored inside the session document**, in `attendance[]`, so each session retains its own attendance history.

```js
{
  _id: ObjectId,
  batchId: ObjectId,
  mentorId: ObjectId,
  sessionDate: Date,
  startTime: String,
  endTime: String,
  title: String,
  description: String?,
  format: String?,
  location: String?,
  meetingLink: String?,
  maxAttendees: Number?,
  roster: [{                       // snapshot of the batch roster for the session
    traineeId: String,
    name: String,
    email: String,
    location: String?,
    status: String?
  }],
  status: "scheduled" | "in_progress" | "completed" | "cancelled",
  attendance: [{
    traineeId: String,
    status: "present" | "absent",
    markedAt: Date,
    markedBy: String
  }],
  createdAt: Date,
  updatedAt: Date?
}
```

Attendance is editable after it has been submitted. A session can hold multiple attendance entries, one for each trainee in its roster.

## Relationships and indexes

- `users` → `mentors`: optional account/profile link through `mentors.userId`.
- `users` (role `nominator`) → `mentors` / `trainees`: a nominator owns the people they nominated through `nominatedBy`. Nominators are not linked to cohorts.
- `mentors` / `trainees`: `cohortId` is `null` while a nominee is only in the nomination pool. An admin adds the nominee to a cohort, which sets `cohortId`.
- `cohorts` → `mentors`, `trainees`, `batches`, and cohort-specific training/feedback copies.
- `mentors` → `trainees`: trainee assignment through `trainees.mentorId`.
- `trainees` → `progress`: one progress document per trainee.
- `trainees` → `feedbackResponses`: one response per trainee and week.
- `batches` → `trainees`: embedded ID list in `batches.traineeIds`.
- `batches` → `sessions`: session documents reference `batches._id`.
- `sessions` → attendance: embedded in `sessions.attendance[]`.

Indexes initialized by the backend include unique `users.email`, unique `progress.traineeId`, unique `feedbackResponses.(traineeId, weekNumber)`, batch lookup indexes, mentor/trainee cohort-location-timezone indexes, and session batch/date indexes.

See [DATABASE_SCHEMA_DIAGRAM.md](DATABASE_SCHEMA_DIAGRAM.md) for the entity relationship diagram.
