-- =============================================================
-- SyncCal Database Schema (PostgreSQL)
-- =============================================================

-- ---------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    username    VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    timezone    VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- CALENDARS
-- ---------------------------------------------------------------
CREATE TABLE calendars (
    id          SERIAL PRIMARY KEY,
    owner_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7)   NOT NULL DEFAULT '#3B82F6',  -- hex color
    is_visible  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------
CREATE TABLE events (
    id               SERIAL PRIMARY KEY,
    calendar_id      INT          NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    start_time       TIMESTAMPTZ  NOT NULL,
    end_time         TIMESTAMPTZ  NOT NULL,
    is_all_day       BOOLEAN      NOT NULL DEFAULT FALSE,
    location         VARCHAR(255),
    recurrence_rule  TEXT,                                 -- iCal RRULE string (nullable)
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time >= start_time)
);

-- ---------------------------------------------------------------
-- OVERLAY GROUPS
-- ---------------------------------------------------------------
CREATE TABLE overlay_groups (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    created_by  INT          NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    invite_code VARCHAR(32)  NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE overlay_group_members (
    id          SERIAL PRIMARY KEY,
    group_id    INT          NOT NULL REFERENCES overlay_groups(id) ON DELETE CASCADE,
    user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(10)  NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

-- Controls which calendars a user shares with a group
CREATE TABLE shared_calendar_visibility (
    id           SERIAL PRIMARY KEY,
    group_id     INT     NOT NULL REFERENCES overlay_groups(id) ON DELETE CASCADE,
    calendar_id  INT     NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    is_shared    BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (group_id, calendar_id)
);

-- ---------------------------------------------------------------
-- INVITES & PROPOSED EVENTS
-- ---------------------------------------------------------------
CREATE TABLE event_invites (
    id           SERIAL PRIMARY KEY,
    event_id     INT         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    invitee_id   INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
    responded_at TIMESTAMPTZ,
    UNIQUE (event_id, invitee_id)
);

CREATE TABLE proposed_time_slots (
    id           SERIAL PRIMARY KEY,
    group_id     INT          NOT NULL REFERENCES overlay_groups(id) ON DELETE CASCADE,
    proposed_by  INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    start_time   TIMESTAMPTZ  NOT NULL,
    end_time     TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_slot_range CHECK (end_time > start_time)
);

CREATE TABLE time_slot_votes (
    id       SERIAL PRIMARY KEY,
    slot_id  INT        NOT NULL REFERENCES proposed_time_slots(id) ON DELETE CASCADE,
    user_id  INT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote     VARCHAR(11) NOT NULL CHECK (vote IN ('available', 'unavailable', 'maybe')),
    UNIQUE (slot_id, user_id)
);

-- ---------------------------------------------------------------
-- REMINDERS & NOTIFICATIONS
-- ---------------------------------------------------------------
CREATE TABLE reminders (
    id         SERIAL PRIMARY KEY,
    event_id   INT        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    INT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remind_at  TIMESTAMPTZ NOT NULL,
    method     VARCHAR(10) NOT NULL DEFAULT 'in_app'
                           CHECK (method IN ('push', 'email', 'in_app')),
    is_sent    BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,   -- e.g. 'invite', 'vote', 'reminder'
    payload    JSONB       NOT NULL DEFAULT '{}',
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------
CREATE INDEX idx_calendars_owner         ON calendars(owner_id);
CREATE INDEX idx_events_calendar         ON events(calendar_id);
CREATE INDEX idx_events_time_range       ON events(start_time, end_time);
CREATE INDEX idx_group_members_group     ON overlay_group_members(group_id);
CREATE INDEX idx_group_members_user      ON overlay_group_members(user_id);
CREATE INDEX idx_shared_vis_group        ON shared_calendar_visibility(group_id);
CREATE INDEX idx_invites_invitee         ON event_invites(invitee_id);
CREATE INDEX idx_reminders_remind_at     ON reminders(remind_at) WHERE is_sent = FALSE;
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
