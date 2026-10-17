/* ==========================================================
   DEMO DATA — SAMPLE ONLY
   Every name, number and time in this file is invented. It is
   loaded only by `npm run seed-demo` (never in production) and
   also supplies the default placeholder settings on first start.
   ========================================================== */
(function () {
  'use strict';

  const SEED_VERSION = 3;

  function buildSeed() {
    const now = Date.now();
    const DAY = 86400000;
    const iso = (offsetDays, hour) => new Date(now - offsetDays * DAY + (hour || 0) * 3600000).toISOString();

    const settings = {
      eventName: 'Anubhav',
      subtitle: 'A Day of Learning & Training',
      presenter: 'PDEU College presents',
      organizers: [
        { name: 'Sanket Health & Wellness Centre', role: 'Organizer' },
        { name: 'PDEU College', role: 'Institutional partner' }
      ],
      timezone: 'Asia/Kolkata',
      days: [
        { id: 'setup', label: 'Setup Day', note: 'Sample day — date to be confirmed' },
        { id: 'event', label: 'Event Day', note: 'Sample day — date to be confirmed' }
      ],
      idFormat: { prefix: 'ANU-', digits: 4 },
      assignmentInstructions: 'Please arrive at your reporting time, wear your volunteer badge, and check in with your team leader before starting.\nKeep your phone on silent and stay at your assigned venue unless told otherwise.',
      visibility: { teams: true, schedule: true, announcements: true, findRole: true, registration: true },
      contact: {
        email: '[Contact email — to be added]',
        phone: '[Contact phone — to be added]',
        helpdesk: '[Helpdesk location — to be added]'
      },
      eventInfo: {
        date: '[Event date — to be announced]',
        venue: '[Event venue — to be announced]'
      },
      registrationFields: {
        institution: { show: true, required: true },
        course: { show: true, required: true },
        year: { show: true, required: true },
        skills: { show: true, required: false },
        areas: { show: true, required: false },
        availability: { show: true, required: true },
        experience: { show: true, required: false },
        notes: { show: true, required: false }
      }
    };

    /* ---------------- Venues ---------------- */
    const venues = [
      ['v_aud', 'Main Auditorium', 'AUD', 'Academic Block A (sample)', 'Ground floor', 'Plenary sessions, inauguration and closing.', 'Dr. Meenal Raval', 450, 'Stage, podium mics and projector tested by 07:30. Clear all aisles.'],
      ['v_sh1', 'Seminar Hall 1', 'SH1', 'Academic Block B (sample)', 'First floor, Room 101', 'Workshops and training labs.', 'Prof. Hitesh Gandhi', 120, 'Classroom seating with a central aisle; extension boards at the front.'],
      ['v_sh2', 'Seminar Hall 2', 'SH2', 'Academic Block B (sample)', 'First floor, Room 102', 'Parallel workshops and student showcase.', 'Prof. Hitesh Gandhi', 100, 'Cluster seating for activities. Whiteboards stocked.'],
      ['v_reg', 'Registration Foyer', 'REG', 'Academic Block A (sample)', 'Entrance foyer', 'Check-in desks, help desk and badge distribution.', 'Ms. Sejal Doshi', 80, 'Four desks with signage; separate queue for pre-registered guests.'],
      ['v_hos', 'Hospitality Lounge', 'HOS', 'Student Centre (sample)', 'Ground floor', 'Refreshments, speaker lounge and lunch.', 'Ms. Falguni Mehta', 150, 'Tea/coffee stations at 08:00. Water points at every table.'],
      ['v_wel', 'Wellness Studio', 'WEL', 'Sports Complex (sample)', 'Studio room', 'Guided wellness and movement activities.', 'Dr. Aarti Kothari', 40, 'Yoga mats, first-aid kit and water dispenser in place.'],
      ['v_crt', 'Open Courtyard', 'CRT', 'Central Quad (sample)', 'Outdoor', 'Logistics staging, activity zone and group photographs.', 'Mr. Jignesh Patel', 200, 'Marquee and storage stack in the north corner.'],
      ['v_av', 'AV Control Room', 'AVC', 'Academic Block A (sample)', 'First floor, Room 12', 'Technical control, livestream and recording.', 'Mr. Rajiv Menon', 12, 'Keep door locked when unattended. Spare cables in cabinet B.']
    ].map(([id, name, code, area, floor, description, coordinator, capacity, setup]) => ({
      id, name, code, area, floor, description, mapLink: '', coordinator, capacity, setup, status: 'Active', updatedAt: iso(9)
    }));

    /* ---------------- Teams ---------------- */
    const teamDefs = [
      ['t_reg', 'Registration & Help Desk', 'Welcomes every attendee, issues badges and answers questions at the help desk.', 'Ms. Sejal Doshi', 'Isha Trivedi', ['Check-in and badge issue', 'Help desk queries', 'Lost & found'], 'v_reg', ['Registration Desk Executive', 'Help Desk Associate', 'Queue Guide'], 'Greet every attendee with a smile; escalate unresolved queries to the team leader.'],
      ['t_venue', 'Venue Management', 'Keeps halls ready, seating organised and crowds flowing safely.', 'Mr. Kunal Trivedi', 'Karan Solanki', ['Seating and signage', 'Crowd flow', 'Room readiness'], 'v_aud', ['Venue Marshal', 'Seating Coordinator', 'Signage Lead'], 'Do a full walkthrough 30 minutes before every session.'],
      ['t_hosp', 'Hospitality', 'Looks after speakers, guests and refreshments.', 'Ms. Falguni Mehta', 'Riya Bhatt', ['Speaker care', 'Refreshment service', 'Green room'], 'v_hos', ['Guest Host', 'Refreshment Coordinator', 'Green Room Attendant'], 'Keep refreshment stations stocked and tidy between sessions.'],
      ['t_tech', 'Technical & AV', 'Runs sound, projection, recording and livestream.', 'Mr. Rajiv Menon', 'Harsh Vyas', ['Sound and projection', 'Recording and livestream', 'Tech troubleshooting'], 'v_av', ['AV Operator', 'Livestream Assistant', 'Stage Tech'], 'Test every microphone and clicker before the first session.'],
      ['t_sess', 'Session Coordination', 'Makes sure every session starts and ends on time.', 'Prof. Hitesh Gandhi', 'Tanvi Kulkarni', ['Speaker liaison', 'Timekeeping', 'Room-to-room coordination'], 'v_sh1', ['Session Moderator Assistant', 'Timekeeper', 'Speaker Liaison'], 'Show timing cards to the speaker at 10 and 5 minutes.'],
      ['t_vsup', 'Volunteer Support', 'Briefs volunteers, handles shift swaps and keeps morale high.', 'Ms. Pooja Raval', 'Jay Rathod', ['Volunteer briefing', 'Shift swaps', 'Breaks and meals'], 'v_crt', ['Volunteer Buddy', 'Briefing Assistant', 'Shift Coordinator'], 'Check in on each team at least once per shift.'],
      ['t_media', 'Photography & Media', 'Captures the day through photos, video and social updates.', 'Mr. Dhruv Shah', 'Pooja Nair', ['Event photography', 'Video highlights', 'Social media updates'], 'v_aud', ['Event Photographer', 'Videographer', 'Social Media Reporter'], 'Seek consent before close-up photographs of attendees.'],
      ['t_log', 'Logistics', 'Moves materials, manages stock and handles transport.', 'Mr. Jignesh Patel', 'Mihir Shah', ['Material handling', 'Inventory', 'Transport'], 'v_crt', ['Materials Handler', 'Transport Coordinator', 'Inventory Assistant'], 'Log every item in and out on the stock sheet.'],
      ['t_stud', 'Student Engagement', 'Guides participants and hosts interactive activities.', '', '', ['Participant guidance', 'Interactive activities', 'Feedback collection'], 'v_sh2', ['Participant Guide', 'Engagement Facilitator', 'Activity Host'], 'Keep activities inclusive; collect feedback forms at close.'],
      ['t_well', 'Health & Wellness Activities', 'Supports guided wellness sessions and first-aid readiness.', 'Dr. Aarti Kothari', 'Meera Pillai', ['Guided wellness sessions', 'First-aid readiness', 'Hydration points'], 'v_wel', ['Wellness Session Assistant', 'First-aid Volunteer', 'Activity Guide'], 'Know the location of the first-aid kit and the nearest exit.']
    ];
    const teams = teamDefs.map(([id, name, description, leader, assistant, responsibilities, venueId, roles, instructions]) => ({
      id, name, description, leader, assistant, responsibilities, venueId, roles, instructions, archived: false, updatedAt: iso(8)
    }));

    /* ---------------- Shifts ---------------- */
    const shiftTimes = {
      morning: { report: '07:45', setup: '07:30', start: '08:30', end: '12:30' },
      afternoon: { report: '12:15', setup: '12:00', start: '12:30', end: '17:00' }
    };
    const shiftOverride = {
      t_tech: { morning: { report: '07:00', setup: '06:45', start: '07:30', end: '12:30' } },
      t_hosp: { morning: { report: '07:30', setup: '07:15', start: '08:00', end: '12:30' } }
    };
    const shifts = [];
    teams.forEach(t => {
      ['morning', 'afternoon'].forEach(kind => {
        const o = (shiftOverride[t.id] && shiftOverride[t.id][kind]) || shiftTimes[kind];
        shifts.push({
          id: `s_${t.id.slice(2)}_${kind === 'morning' ? 'am' : 'pm'}`,
          name: `${t.name} — ${kind === 'morning' ? 'Morning' : 'Afternoon'}`,
          day: 'event', teamId: t.id, venueId: t.venueId,
          reportTime: o.report, setupTime: o.setup, startTime: o.start, endTime: o.end,
          positions: t.id === 't_reg' && kind === 'morning' ? 4 : 3,
          coordinator: t.leader,
          responsibilities: t.responsibilities.join('; '),
          instructions: t.instructions,
          updatedAt: iso(7)
        });
      });
    });
    shifts.push({
      id: 's_log_setup', name: 'Logistics — Setup Day Prep', day: 'setup', teamId: 't_log', venueId: 'v_crt',
      reportTime: '14:45', setupTime: '14:30', startTime: '15:00', endTime: '18:00', positions: 4,
      coordinator: 'Mr. Jignesh Patel', responsibilities: 'Stage materials, unpack kits, label stock.', instructions: 'Wear closed shoes. Gloves are provided.', updatedAt: iso(7)
    });
    shifts.push({
      id: 's_vsup_brief', name: 'Volunteer Support — Briefing', day: 'setup', teamId: 't_vsup', venueId: 'v_aud',
      reportTime: '15:45', setupTime: '15:30', startTime: '16:00', endTime: '17:00', positions: 2,
      coordinator: 'Ms. Pooja Raval', responsibilities: 'Run the volunteer briefing and hand out badges.', instructions: 'Keep a printed attendance list ready.', updatedAt: iso(7)
    });
    // Deliberate gaps so the warning UI has something to show
    shifts.find(s => s.id === 's_hosp_pm').venueId = '';
    shifts.find(s => s.id === 's_sess_pm').reportTime = '';

    /* ---------------- Volunteers ---------------- */
    const SK = ['Public speaking', 'Event management', 'Photography', 'Video editing', 'Audio/Video setup', 'First aid', 'Hospitality', 'Crowd management', 'Social media', 'Documentation', 'Registration desk', 'Translation'];
    const sk = i => SK[i];
    // [name, institution, course, year, skills[], areas[], status, unassigned?]
    const raw = [
      ['Aarav Mehta', 'PDEU', 'B.Tech Computer Engineering', '3rd', [4, 9], ['t_tech', 't_log'], 'Approved'],
      ['Ananya Iyer', 'Nirma University', 'BBA', '2nd', [6, 0], ['t_hosp', 't_stud'], 'Approved'],
      ['Rahul Patel', 'PDEU', 'B.Tech Mechanical', '4th', [1, 7], ['t_venue'], 'Approved'],
      ['Kavya Desai', 'Gujarat University', 'BA Psychology', '3rd', [0, 11], ['t_stud', 't_sess'], 'Approved'],
      ['Rahul Patel', 'Nirma University', 'MBA', '1st', [1], ['t_vsup'], 'Approved'],
      ['Sneha Joshi', 'Nirma University', 'B.Pharm', '3rd', [5], ['t_well'], 'Approved'],
      ['Dev Parmar', 'LD College of Engineering', 'B.Tech Electronics', '3rd', [4], ['t_tech'], 'Approved'],
      ['Isha Trivedi', 'PDEU', 'B.Tech Chemical', '2nd', [10, 9], ['t_reg'], 'Approved'],
      ['Mihir Shah', 'GTU', 'MBA', '2nd', [1], ['t_log'], 'Approved'],
      ['Pooja Nair', 'PDEU', 'B.Tech Computer Engineering', '1st', [8, 2], ['t_media'], 'Approved'],
      ['Karan Solanki', 'PDEU', 'B.Tech Civil', '4th', [7], ['t_venue'], 'Approved'],
      ['Riya Bhatt', 'Gujarat University', 'BA Psychology', '2nd', [6], ['t_hosp'], 'Approved'],
      ['Neha Sharma', 'PDEU', 'B.Tech ICT', '3rd', [10], ['t_reg'], 'Approved'],
      ['Yash Chauhan', 'Nirma University', 'B.Tech Mechanical', '3rd', [2, 3], ['t_media'], 'Approved'],
      ['Tanvi Kulkarni', 'PDEU', 'B.Tech Petroleum', '2nd', [0], ['t_sess'], 'Approved'],
      ['Harsh Vyas', 'GTU', 'B.Tech Computer Engineering', '4th', [4], ['t_tech'], 'Approved'],
      ['Aditi Rao', 'PDEU', 'M.Tech Thermal', '1st', [9], ['t_sess'], 'Approved'],
      ['Siddharth Jain', 'LD College of Engineering', 'B.Tech Electrical', '3rd', [1], ['t_log'], 'Approved'],
      ['Meera Pillai', 'Nirma University', 'B.Pharm', '3rd', [5], ['t_well'], 'Approved'],
      ['Vivek Gohil', 'PDEU', 'B.Tech Mechanical', '2nd', [7], ['t_venue'], 'Approved'],
      ['Shreya Dave', 'Gujarat University', 'BBA', '2nd', [6, 8], ['t_hosp'], 'Approved'],
      ['Jay Rathod', 'PDEU', 'B.Tech Computer Engineering', '3rd', [1], ['t_vsup'], 'Approved'],
      ['Divya Menon', 'Nirma University', 'BPT Physiotherapy', '4th', [5], ['t_well'], 'Approved'],
      ['Om Bhavsar', 'PDEU', 'B.Tech Chemical', '1st', [10], ['t_reg'], 'Approved'],
      ['Nidhi Kapadia', 'GTU', 'B.Com', '2nd', [11], ['t_stud'], 'Approved'],
      ['Arjun Reddy', 'PDEU', 'B.Tech Computer Engineering', '4th', [4, 3], ['t_tech', 't_media'], 'Approved'],
      ['Pranav Oza', 'LD College of Engineering', 'B.Tech Civil', '3rd', [1], ['t_log'], 'Approved'],
      ['Simran Kaur', 'PDEU', 'B.Tech ICT', '2nd', [0], ['t_sess'], 'Approved'],
      ['Bhavya Amin', 'Nirma University', 'BBA', '1st', [6], ['t_hosp', 't_vsup'], 'Approved'],
      ['Rohan Kakkad', 'PDEU', 'B.Tech Mechanical', '3rd', [2], ['t_media'], 'Approved'],
      // approved but not yet assigned
      ['Zoya Khan', 'Gujarat University', 'BA English', '2nd', [11, 0], ['t_stud'], 'Approved', true],
      ['Chirag Rana', 'PDEU', 'B.Tech Civil', '2nd', [7], ['t_venue'], 'Approved', true],
      ['Lavanya Subramanian', 'Nirma University', 'B.Pharm', '2nd', [5], ['t_well'], 'Approved', true],
      ['Utkarsh Pandey', 'GTU', 'B.Tech Electronics', '3rd', [10], ['t_reg'], 'Approved', true],
      // pending
      ['Ishaan Bajaj', 'PDEU', 'B.Tech Computer Engineering', '2nd', [8], ['t_media'], 'Pending'],
      ['Mansi Thakkar', 'Gujarat University', 'BBA', '3rd', [6], ['t_hosp'], 'Pending'],
      ['Parth Brahmbhatt', 'LD College of Engineering', 'B.Tech Mechanical', '1st', [1], ['t_log'], 'Pending'],
      ['Neha Sharma', 'Nirma University', 'B.Pharm', '2nd', [5], ['t_well'], 'Pending'],
      ['Kunal Desai', 'PDEU', 'B.Tech Chemical', '3rd', [4], ['t_tech'], 'Pending'],
      ['Foram Shah', 'GTU', 'MBA', '1st', [0], ['t_sess'], 'Pending'],
      // rejected
      ['Rakesh Kumar', 'Unknown institution', 'Not specified', '1st', [], [], 'Rejected'],
      ['Nikita Rawal', 'Gujarat University', 'BA Sociology', '2nd', [], ['t_stud'], 'Rejected']
    ];

    const volunteers = raw.map((r, i) => {
      const seq = i + 1;
      const slug = r[0].toLowerCase().replace(/[^a-z]+/g, '.');
      return {
        id: `vol_${seq}`, seq,
        name: r[0], institution: r[1], course: r[2], year: r[3],
        skills: r[4].map(sk), areas: r[5],
        mobile: `+91 90000 ${String(10000 + seq * 37).slice(-5)}`,
        email: `${slug}${seq}@example.com`,
        availability: seq % 5 === 0 ? ['Event day — morning'] : ['Setup day', 'Event day — morning', 'Event day — afternoon'],
        experience: seq % 3 === 0 ? 'Experienced (3+ events)' : seq % 3 === 1 ? 'None yet' : 'Some (1–2 events)',
        notes: seq === 8 ? 'Can stay late if needed.' : '',
        status: r[6],
        unassignedByDesign: !!r[7],
        registeredAt: iso(r[6] === 'Pending' ? 5 - (seq % 5) : 30 - seq, seq % 9),
        updatedAt: iso(r[6] === 'Pending' ? 2 : 12)
      };
    });

    /* ---------------- Assignments ---------------- */
    const assignments = [];
    let aSeq = 1;
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
    const shiftById = Object.fromEntries(shifts.map(s => [s.id, s]));
    function makeAssignment(vol, shiftId, role, status, extra) {
      const s = shiftById[shiftId];
      const t = teamById[s.teamId];
      assignments.push(Object.assign({
        id: `a_${aSeq++}`, volunteerId: vol.id, teamId: s.teamId, role,
        venueId: s.venueId, day: s.day, reportTime: s.reportTime,
        startTime: s.startTime, endTime: s.endTime, shiftId,
        leader: t.leader, responsibilities: s.responsibilities, instructions: s.instructions,
        status: status || 'Active', updatedAt: iso(3, vol.seq % 7)
      }, extra || {}));
    }

    const morningFirst = new Set([1, 2, 26]); // volunteers who also get a 2nd (afternoon) assignment
    let idx = 0;
    volunteers.forEach(v => {
      if (v.status !== 'Approved' || v.unassignedByDesign) return;
      const team = teamById[v.areas[0]];
      const kind = morningFirst.has(v.seq) || v.seq % 2 === 1 ? 'am' : 'pm';
      const role = team.roles[idx % team.roles.length];
      idx++;
      let shiftId = `s_${team.id.slice(2)}_${kind}`;
      if (v.seq === 27) shiftId = 's_log_setup';
      makeAssignment(v, shiftId, role, v.seq === 30 ? 'Draft' : 'Active');
    });

    const byseq = n => volunteers.find(v => v.seq === n);
    // Multiple assignments (non-overlapping: morning ends 12:30, afternoon starts 12:30)
    makeAssignment(byseq(1), 's_log_pm', 'Materials Handler', 'Active', { instructions: 'Second assignment — move to the courtyard after your AV morning shift.' });
    makeAssignment(byseq(2), 's_stud_pm', 'Participant Guide', 'Active');
    makeAssignment(byseq(26), 's_media_pm', 'Videographer', 'Active');
    makeAssignment(byseq(22), 's_vsup_brief', 'Briefing Assistant', 'Active');
    // Deliberate overlap: Mihir (Logistics morning) also placed in the Hospitality morning shift
    makeAssignment(byseq(9), 's_hosp_am', 'Refreshment Coordinator', 'Active');

    /* ---------------- Sessions (public schedule) ---------------- */
    const sessions = [
      ['setup', 'Venue Walkthrough', '15:00', '16:00', 'v_aud', 't_venue', 'Mr. Kunal Trivedi', 'Walk every hall with the checklist.'],
      ['setup', 'Volunteer Briefing', '16:00', '17:00', 'v_aud', 't_vsup', 'Ms. Pooja Raval', 'All volunteers should attend. Badges will be handed out.'],
      ['setup', 'Material Packing & Staging', '17:00', '18:00', 'v_crt', 't_log', 'Mr. Jignesh Patel', 'Label kits by hall.'],
      ['event', 'Registration & Welcome Desk Opens', '08:00', '09:00', 'v_reg', 't_reg', 'Ms. Sejal Doshi', 'Pre-registered attendees use the left queue.'],
      ['event', 'Inauguration', '09:00', '09:45', 'v_aud', 't_venue', 'Mr. Kunal Trivedi', 'Seating closes at 08:55.'],
      ['event', 'Keynote: Learning Through Experience', '09:45', '10:45', 'v_aud', 't_sess', 'Prof. Hitesh Gandhi', 'Speaker liaison meets the guest at the lounge at 09:15.'],
      ['event', 'Hands-on Workshop A', '11:00', '12:30', 'v_sh1', 't_sess', 'Tanvi Kulkarni', 'Distribute materials before entry.'],
      ['event', 'Hands-on Workshop B', '11:00', '12:30', 'v_sh2', 't_stud', 'Prof. Hitesh Gandhi', 'Cluster seating — max 25 participants per cluster.'],
      ['event', 'Lunch & Networking', '12:30', '13:30', 'v_hos', 't_hosp', 'Ms. Falguni Mehta', 'Keep one counter for dietary requests.'],
      ['event', 'Guided Wellness Session', '13:30', '14:15', 'v_wel', 't_well', 'Dr. Aarti Kothari', 'First-aid volunteer stays on site.'],
      ['event', 'Training Lab', '14:15', '16:00', 'v_sh1', 't_sess', 'Prof. Hitesh Gandhi', 'Technical team checks screens before the lab.'],
      ['event', 'Student Showcase', '14:15', '16:00', 'v_sh2', 't_stud', 'Prof. Hitesh Gandhi', 'Collect feedback forms at the exit.'],
      ['event', 'Closing & Feedback', '16:15', '17:00', 'v_aud', 't_venue', 'Mr. Kunal Trivedi', 'Photography team captures group photograph in the courtyard afterwards.']
    ].map((r, i) => ({ id: `se_${i + 1}`, day: r[0], name: r[1], startTime: r[2], endTime: r[3], venueId: r[4], teamId: r[5], coordinator: r[6], instructions: r[7] }));

    /* ---------------- Announcements ---------------- */
    const announcements = [
      { id: 'an_1', title: 'Volunteer registrations are open', message: 'Thank you for stepping forward to support Anubhav. Please complete the registration form; the core team will review it and confirm your assignment.', audience: 'All volunteers', teamId: '', priority: 'Normal', status: 'Published', publishedAt: iso(14), expiry: '' },
      { id: 'an_2', title: 'Volunteer briefing — timing to be confirmed', message: 'A short briefing will be held before the event. The exact time and hall will appear here and on the Find My Role page once confirmed.', audience: 'All volunteers', teamId: '', priority: 'High', status: 'Published', publishedAt: iso(4), expiry: '' },
      { id: 'an_3', title: 'Technical & AV: equipment check', message: 'AV team members, please verify microphones, clickers and projector cables during your morning setup window.', audience: 'Specific team', teamId: 't_tech', priority: 'Normal', status: 'Published', publishedAt: iso(2), expiry: '' },
      { id: 'an_4', title: 'Dress code and badges', message: 'Wear plain dark clothing. Your volunteer badge will be issued at the Registration Foyer — keep it visible at all times.', audience: 'All volunteers', teamId: '', priority: 'Low', status: 'Published', publishedAt: iso(1), expiry: '' },
      { id: 'an_5', title: 'Hospitality: dietary list (draft)', message: 'Draft message about dietary preferences for speakers. To be finalised with the lounge coordinator.', audience: 'Specific team', teamId: 't_hosp', priority: 'Normal', status: 'Draft', publishedAt: '', expiry: '' },
      { id: 'an_6', title: 'Early photo call (expired)', message: 'This announcement has expired and is not shown on the public page.', audience: 'All volunteers', teamId: '', priority: 'Low', status: 'Published', publishedAt: iso(20), expiry: new Date(now - 5 * DAY).toISOString().slice(0, 10) },
      { id: 'an_7', title: 'Last year’s parking note', message: 'Archived example announcement kept for reference.', audience: 'All volunteers', teamId: '', priority: 'Low', status: 'Archived', publishedAt: iso(40), expiry: '' }
    ].map(a => Object.assign(a, { updatedAt: a.publishedAt || iso(3) }));

    /* ---------------- Attendance (keyed by assignment id) ---------------- */
    const attendance = [];
    const sample = ['Present', 'Present', 'Late', 'Present', 'Absent', 'Excused'];
    assignments.slice(0, 6).forEach((a, i) => {
      attendance.push({ id: a.id, status: sample[i], checkIn: sample[i] === 'Absent' || sample[i] === 'Excused' ? '' : (sample[i] === 'Late' ? '08:52' : '08:10'), notes: sample[i] === 'Excused' ? 'Exam clash — informed in advance' : '', updatedAt: iso(0) });
    });

    /* ---------------- Activity feed ---------------- */
    const activity = [
      [0, 1, 'Approved registration for Zoya Khan', 'approve'],
      [0, 3, 'Published announcement “Dress code and badges”', 'announce'],
      [1, 2, 'Assigned Pranav Oza to Logistics — Setup Day Prep', 'assign'],
      [1, 5, 'Created venue “AV Control Room”', 'venue'],
      [2, 4, 'Rejected registration for Rakesh Kumar (incomplete details)', 'reject'],
      [3, 2, 'New registration from Kunal Desai', 'register']
    ].map((r, i) => ({ id: `ac_${i + 1}`, at: iso(r[0], -r[1]), text: r[2], type: r[3] }));

    return { version: SEED_VERSION, settings, venues, teams, shifts, volunteers, assignments, sessions, announcements, attendance, activity };
  }

  window.AnubhavSeed = { version: SEED_VERSION, build: buildSeed };
})();
