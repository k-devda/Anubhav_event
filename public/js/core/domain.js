/* ==========================================================
   Domain rules — derived values shared by every screen.
   All counts come from the single dataset in Store.
   ========================================================== */
const Domain = (() => {
  'use strict';

  const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const overlaps = (a, b) => a.day === b.day && toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime);

  function volCode(v) {
    if (!v) return '';
    const f = Store.settings().idFormat;
    return f.prefix + String(v.seq).padStart(f.digits, '0');
  }
  function volByCode(code) {
    const c = String(code).trim().toUpperCase();
    return Store.list('volunteers').find(v => volCode(v).toUpperCase() === c) || null;
  }

  const team = id => Store.get('teams', id);
  const venue = id => Store.get('venues', id);
  const shift = id => Store.get('shifts', id);
  const volunteer = id => Store.get('volunteers', id);
  const teamName = id => (team(id) || {}).name || '—';
  const venueName = id => (venue(id) || {}).name || '—';
  const fmtDay = (iso, long) => {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  const dayRec = id => Store.settings().days.find(d => d.id === id) || null;
  /** "Event Day 1 (27 Oct)" */
  const dayLabel = id => { const d = dayRec(id); return d ? d.label + (d.date ? ` (${fmtDay(d.date)})` : '') : '—'; };
  /** "Tuesday 27 October 2026" or '' */
  const dayDate = id => { const d = dayRec(id); return d && d.date ? fmtDay(d.date, true) : ''; };
  const activeTeams = () => Store.list('teams').filter(t => !t.archived);
  const activeVenues = () => Store.list('venues').filter(v => v.status !== 'Archived');
  const approved = () => Store.list('volunteers').filter(v => v.status === 'Approved');

  function assignmentsFor(volId, opts) {
    const all = Store.list('assignments').filter(a => a.volunteerId === volId);
    return (opts && opts.activeOnly ? all.filter(a => a.status === 'Active') : all)
      .sort((a, b) => (a.day === b.day ? toMin(a.startTime) - toMin(b.startTime) : a.day === 'setup' ? -1 : 1));
  }
  const activeAssignments = () => Store.list('assignments').filter(a => a.status === 'Active');
  const isAssigned = v => activeAssignments().some(a => a.volunteerId === v.id);
  const leaderFor = a => a.leader || (team(a.teamId) || {}).leader || '';

  function teamMembers(teamId) {
    return activeAssignments().filter(a => a.teamId === teamId)
      .map(a => ({ assignment: a, volunteer: volunteer(a.volunteerId) }))
      .filter(m => m.volunteer);
  }
  function shiftFilled(s) { return activeAssignments().filter(a => a.shiftId === s.id).length; }
  function teamShifts(teamId) { return Store.list('shifts').filter(s => s.teamId === teamId); }
  function teamVacancies(teamId) {
    return teamShifts(teamId).reduce((n, s) => n + Math.max(0, (Number(s.positions) || 0) - shiftFilled(s)), 0);
  }

  function conflictsFor(a) {
    if (a.status !== 'Active' || !a.startTime || !a.endTime) return [];
    return activeAssignments().filter(o => o.id !== a.id && o.volunteerId === a.volunteerId && o.startTime && o.endTime && overlaps(a, o));
  }

  function assignmentIssues(a) {
    const out = [];
    if (!a.role) out.push('Role missing');
    if (!a.venueId) out.push('Venue missing');
    if (!a.reportTime) out.push('Reporting time missing');
    if (!a.startTime || !a.endTime) out.push('Shift time missing');
    else if (toMin(a.endTime) <= toMin(a.startTime)) out.push('Shift ends before it starts');
    if (!leaderFor(a)) out.push('Team leader missing');
    conflictsFor(a).forEach(c => out.push(`Overlaps with ${teamName(c.teamId)} (${c.startTime}–${c.endTime})`));
    return out;
  }

  function shiftIssues(s) {
    const out = [];
    if (!s.venueId) out.push('Missing venue');
    if (!s.reportTime) out.push('Missing reporting time');
    const t = team(s.teamId);
    if (!s.teamId || !t) out.push('No team assigned');
    else if (!t.leader) out.push('Team has no leader');
    const open = (Number(s.positions) || 0) - shiftFilled(s);
    if (open > 0) out.push(`${open} position${open > 1 ? 's' : ''} unfilled`);
    return out;
  }

  /** Every pair of active assignments for the same volunteer that overlap. */
  function overlapList() {
    const seen = new Set(); const out = [];
    activeAssignments().forEach(a => conflictsFor(a).forEach(b => {
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) return; seen.add(key);
      out.push({ volunteer: volunteer(a.volunteerId), a, b });
    }));
    return out;
  }

  function stats() {
    const vols = Store.list('volunteers');
    const appr = vols.filter(v => v.status === 'Approved');
    const assignedIds = new Set(activeAssignments().map(a => a.volunteerId));
    const assigned = appr.filter(v => assignedIds.has(v.id)).length;
    const shifts = Store.list('shifts');
    return {
      total: vols.length,
      approved: appr.length,
      pending: vols.filter(v => v.status === 'Pending').length,
      rejected: vols.filter(v => v.status === 'Rejected').length,
      assigned,
      unassigned: appr.length - assigned,
      teams: activeTeams().length,
      venues: activeVenues().length,
      vacancies: shifts.reduce((n, s) => n + Math.max(0, (Number(s.positions) || 0) - shiftFilled(s)), 0),
      positions: shifts.reduce((n, s) => n + (Number(s.positions) || 0), 0)
    };
  }

  function publicAnnouncements() {
    const today = new Date().toISOString().slice(0, 10);
    return Store.list('announcements')
      .filter(a => a.status === 'Published' && (!a.expiry || a.expiry >= today))
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  }

  function attendanceFor(assignmentId) {
    return Store.get('attendance', assignmentId) || { id: assignmentId, status: 'Not Marked', checkIn: '', notes: '' };
  }

  return {
    toMin, overlaps, volCode, volByCode, team, venue, shift, volunteer, teamName, venueName, dayLabel, dayDate,
    activeTeams, activeVenues, approved, assignmentsFor, activeAssignments, isAssigned, leaderFor,
    teamMembers, shiftFilled, teamShifts, teamVacancies, conflictsFor, assignmentIssues, shiftIssues,
    overlapList, stats, publicAnnouncements, attendanceFor
  };
})();
