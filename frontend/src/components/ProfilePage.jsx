/**
 * ProfilePage.jsx
 * ---------------
 * Lets the logged-in user view and update their profile:
 *   - Display username and email (read-only)
 *   - Change their timezone (PATCH /api/users/me/)
 *   - Change their password (POST /api/auth/change-password/)
 *
 * The timezone change calls the existing backend endpoint.
 * Password change requires a new backend endpoint (see backend/api/views.py addition below).
 */
import { useState, useEffect } from 'react'
import { User, Lock, Globe, CheckCircle, LoaderCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import axios from 'axios'

const COMMON_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
]

function ProfilePage({ user, onUserUpdate }) {
  // ── profile info ──────────────────────────────────────────────────── //
  const [profileData, setProfileData] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // ── timezone section ─────────────────────────────────────────────── //
  const [timezone, setTimezone]       = useState(user?.timezone || 'UTC')
  const [savingTz, setSavingTz]       = useState(false)
  const [tzSuccess, setTzSuccess]     = useState(false)

  // ── password section ─────────────────────────────────────────────── //
  const [currentPw, setCurrentPw]     = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw]     = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [savingPw, setSavingPw]       = useState(false)
  const [pwError, setPwError]         = useState('')
  const [pwSuccess, setPwSuccess]     = useState(false)

  // fetch full profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get('/api/users/me/')
        setProfileData(res.data)
        setTimezone(res.data.timezone || 'UTC')
      } catch {
        toast.error('Could not load profile')
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  // ── handlers ─────────────────────────────────────────────────────── //
  const handleSaveTimezone = async () => {
    setSavingTz(true)
    setTzSuccess(false)
    try {
      const res = await axios.patch('/api/users/me/', { timezone })
      setProfileData(prev => ({ ...prev, timezone: res.data.timezone }))
      // update parent so NavBar/Calendar reflects new tz without refresh
      if (onUserUpdate) onUserUpdate({ ...user, timezone: res.data.timezone })
      localStorage.setItem('timezone', res.data.timezone)
      setTzSuccess(true)
      toast.success('Timezone updated')
      setTimeout(() => setTzSuccess(false), 3000)
    } catch {
      toast.error('Failed to update timezone')
    } finally {
      setSavingTz(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match')
      return
    }
    if (currentPw === newPw) {
      setPwError('New password must be different from current password')
      return
    }

    setSavingPw(true)
    try {
      await axios.post('/api/auth/change-password/', {
        current_password: currentPw,
        new_password: newPw,
      })
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success('Password changed successfully')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to change password'
      setPwError(msg)
    } finally {
      setSavingPw(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────── //
  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Your Profile</h1>

      {/* ── Account info ─────────────────────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <User className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Account</h2>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-sm text-muted-foreground">Username</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {profileData?.username || user?.username}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-sm text-muted-foreground">Email</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {profileData?.email || '—'}
            </div>
          </div>
        </div>
      </section>

      {/* ── Timezone ─────────────────────────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Timezone</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Your timezone is used to display event times correctly across the calendar.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_ZONES.map(z => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSaveTimezone}
            disabled={savingTz || timezone === profileData?.timezone}
          >
            {savingTz
              ? <><LoaderCircle className="size-4 animate-spin mr-2" />Saving…</>
              : tzSuccess
                ? <><CheckCircle className="size-4 mr-2 text-green-500" />Saved</>
                : 'Save'
            }
          </Button>
        </div>
        {tzSuccess && (
          <p className="mt-2 text-xs text-green-600 dark:text-green-400">
            ✓ Timezone updated — your calendar will reflect the change immediately.
          </p>
        )}
      </section>

      {/* ── Change Password ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="currentPw">Current password</Label>
            <div className="relative">
              <Input
                id="currentPw"
                type={showCurrentPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                disabled={savingPw}
                className="pr-10"
                required
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowCurrentPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="newPw">New password</Label>
            <div className="relative">
              <Input
                id="newPw"
                type={showNewPw ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                disabled={savingPw}
                className="pr-10"
                required
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowNewPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="confirmPw">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirmPw"
                type={showConfirmPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                disabled={savingPw}
                className="pr-10"
                required
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowConfirmPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPw && (
              <p className={`text-xs ${newPw === confirmPw ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {newPw === confirmPw ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          {pwError && <p className="text-sm text-destructive">{pwError}</p>}

          {pwSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="size-4" /> Password changed successfully
            </p>
          )}

          <Button type="submit" disabled={savingPw || !currentPw || !newPw || !confirmPw}>
            {savingPw
              ? <><LoaderCircle className="size-4 animate-spin mr-2" />Updating…</>
              : 'Change password'
            }
          </Button>
        </form>
      </section>
    </div>
  )
}

export default ProfilePage
