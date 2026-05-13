// admin.js – Dashboard administrateur (revenus 100% bookings unitaires)
console.log('🔵 [ADMIN.JS] Script chargé');

let revenueChart = null, currentMonthOffset = 0, allMonthlyRevenue = {};

// --- Carrousel prochains cours ---
let adminUpcomingLessons = [];
let adminCurrentStartIndex = 0;
const LESSONS_PER_PAGE = 3;

// Stockage global pour les forfaits
let activePackagesData = [];

// IDs des étudiants à exclure (placés en dernier)
const EXCLUDED_STUDENT_IDS = [
    '88698eb2-904f-410b-88e1-a93c1397e0d1',
    'ddb62c55-b9f0-4852-8aa4-a53ea219ca83'
];

// Données supplémentaires pour l'historique (X et Y)
const EXTRA_COURSES = {
    'd35cafae-a634-418d-96cb-403fcc48bf2a': 152,
    '56caf5e7-f54e-487f-9c14-edae4248ae59': 106,
    '82bc81cf-5d78-4e9d-8db9-23c21873c397': 100,
    '9e932799-fdd6-4a1c-8bbf-5aa7c03e83ac': 90,
    '3945e698-3d3f-4b78-870e-c7f04f6e784e': 83,
    '1eec17f7-ccad-4d78-8c89-93ade89f2143': 67,
    '76633fd7-e78f-43d7-b438-f5a8955401d3': 61,
    '2dbedd47-78bc-4e33-b877-e11ca99e59e8': 18
};

const EXTRA_AMOUNTS = {
    'd35cafae-a634-418d-96cb-403fcc48bf2a': 1560,
    '56caf5e7-f54e-487f-9c14-edae4248ae59': 1090,
    '82bc81cf-5d78-4e9d-8db9-23c21873c397': 685,
    '9e932799-fdd6-4a1c-8bbf-5aa7c03e83ac': 620,
    '3945e698-3d3f-4b78-870e-c7f04f6e784e': 1100,
    '1eec17f7-ccad-4d78-8c89-93ade89f2143': 575,
    '76633fd7-e78f-43d7-b438-f5a8955401d3': 420,
    '2dbedd47-78bc-4e33-b877-e11ca99e59e8': 162
};

// ========== AUTH / SUPABASE ==========
async function waitForSupabase() {
    console.log('⏳ [ADMIN.JS] waitForSupabase – début');
    if (window.supabaseInitialized) await window.supabaseInitialized;
    if (!window.supabase || !window.supabase.auth) throw new Error('Supabase non initialisé');
    console.log('✅ [ADMIN.JS] Supabase prêt');
    return window.supabase;
}

async function getToken() {
    console.log('🔑 [ADMIN.JS] getToken – récupération session');
    const supabase = await waitForSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!session?.access_token) throw new Error('Non authentifié');
    console.log('✅ [ADMIN.JS] Token récupéré');
    return session.access_token;
}

async function fetchAdminDashboard() {
    console.log('📊 [ADMIN.JS] fetchAdminDashboard – appel Edge Function');
    const token = await getToken();
    const url = `${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-dashboard`;
    console.log(`🌐 [ADMIN.JS] GET ${url}`);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    console.log('✅ [ADMIN.JS] Données dashboard reçues');
    return data;
}

async function cancelBookingAdmin(bookingId) {
    console.log(`🚀 [ADMIN.JS] cancelBookingAdmin – début pour bookingId=${bookingId}`);
    const token = await getToken();
    const url = `${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-cancel-booking`;
    console.log(`🌐 [ADMIN.JS] POST ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
    });
    const responseText = await res.text();
    console.log(`📥 [ADMIN.JS] Réponse brute (status ${res.status}): ${responseText}`);
    let result;
    try {
        result = JSON.parse(responseText);
    } catch(e) {
        console.error('❌ [ADMIN.JS] Réponse non JSON', responseText);
        throw new Error('Réponse non JSON');
    }
    if (!res.ok) throw new Error(result.error || 'Erreur annulation');
    console.log(`✅ [ADMIN.JS] Annulation DB réussie, creditRefunded=${result.creditRefunded}, calcomUid=${result.calcomUid}`);

    if (result.calcomUid && window.bookingCancellation?.cancelCalcomBooking) {
        console.log(`📞 [ADMIN.JS] Appel à bookingCancellation.cancelCalcomBooking pour UID ${result.calcomUid}`);
        try {
            await window.bookingCancellation.cancelCalcomBooking(result.calcomUid);
            console.log('✅ [ADMIN.JS] Cal.com annulé avec succès');
        } catch (err) {
            console.warn('⚠️ [ADMIN.JS] Échec annulation Cal.com (non bloquant):', err);
        }
    } else {
        console.warn(`⚠️ [ADMIN.JS] Annulation Cal.com ignorée: calcomUid=${result.calcomUid}, bookingCancellation disponible=${!!window.bookingCancellation}`);
    }
    console.log('🏁 [ADMIN.JS] cancelBookingAdmin terminé');
    return result;
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
}

// ========== PROCHAINS COURS (carrousel) ==========
function formatDateWithDay(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const formatted = date.toLocaleDateString('fr-FR', options);
    const parts = formatted.split(' ');
    // Format typique: "lundi 17 mai 2026"
    const day = parts[0];
    const rest = parts.slice(1).join(' ');
    return `<strong>${day}</strong> ${rest}`;
}

function renderUpcomingSlice() {
    const container = document.getElementById('adminUpcomingLessons');
    if (!container) return;

    const lessons = adminUpcomingLessons;
    if (!lessons.length) {
        container.innerHTML = '<div>Aucun cours à venir</div>';
        return;
    }

    const total = lessons.length;
    const start = adminCurrentStartIndex;
    const end = Math.min(start + LESSONS_PER_PAGE, total);
    const visibleLessons = lessons.slice(start, end);

    const cardsHTML = visibleLessons.map(lesson => {
        const meetingLink = lesson.meeting_link || null;
        const hasMeeting = meetingLink && meetingLink.trim() !== '';
        const lessonDate = new Date(lesson.start_time);
        const dateStr = formatDateWithDay(lessonDate);
        const timeStr = lessonDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const courseTypeFormatted = (lesson.course_type || '').charAt(0).toUpperCase() + (lesson.course_type || '').slice(1);
        
        return `
            <div class="upcoming-lesson-card">
                <div><strong>${escapeHtml(lesson.profiles?.full_name || 'Étudiant')}</strong></div>
                <div>${escapeHtml(courseTypeFormatted)}</div>
                <div>📅 ${dateStr}</div>
                <div>⏰ <strong>${timeStr}</strong></div>
                <div style="display: flex; gap: 10px; margin-top: 12px; width: 100%;">
                    ${hasMeeting ? `<a href="${escapeHtml(meetingLink)}" target="_blank" class="btn-join-admin"><i class="fas fa-video"></i> Rejoindre</a>` : '<button class="btn-join-admin-disabled" disabled>Rejoindre</button>'}
                    <button class="btn-cancel-admin" data-id="${lesson.id}">Annuler</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button id="adminPrevLessons" class="nav-arrow" ${start === 0 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            <div style="display: flex; gap: 15px; flex: 1; overflow-x: auto; padding: 10px 0;">
                ${cardsHTML}
            </div>
            <button id="adminNextLessons" class="nav-arrow" ${end >= total ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <div style="text-align: center; margin-top: 10px; font-size: 0.9rem; color: #666;">
            ${start + 1}–${end} sur ${total}
        </div>
    `;

    // Annulation
    container.querySelectorAll('.btn-cancel-admin').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            if (!confirm('Annuler ce cours ? Un crédit sera ajouté.')) return;
            btn.disabled = true;
            btn.innerText = 'Annulation...';
            try {
                const result = await cancelBookingAdmin(id);
                alert(result.creditRefunded ? 'Cours annulé (crédit ajouté)' : 'Cours annulé');
                location.reload();
            } catch (err) {
                console.error('Erreur annulation:', err);
                alert('Erreur: ' + err.message);
                btn.disabled = false;
                btn.innerText = 'Annuler';
            }
        });
    });

    // Navigation flèches
    const prevBtn = document.getElementById('adminPrevLessons');
    const nextBtn = document.getElementById('adminNextLessons');
    if (prevBtn) prevBtn.onclick = () => {
        if (adminCurrentStartIndex > 0) {
            adminCurrentStartIndex = Math.max(0, adminCurrentStartIndex - LESSONS_PER_PAGE);
            renderUpcomingSlice();
        }
    };
    if (nextBtn) nextBtn.onclick = () => {
        if (adminCurrentStartIndex + LESSONS_PER_PAGE < adminUpcomingLessons.length) {
            adminCurrentStartIndex += LESSONS_PER_PAGE;
            renderUpcomingSlice();
        }
    };
}

function displayUpcoming(lessons) {
    adminUpcomingLessons = lessons || [];
    adminCurrentStartIndex = 0;
    renderUpcomingSlice();
}

// ========== FORFAITS ACTIFS (bulles interactives) ==========
function getStudentCredits(studentId) {
    const studentPackages = activePackagesData.filter(pkg => (pkg.profiles?.id || pkg.user_id) === studentId);
    const credits = {
        conversation: { 30: 0, 45: 0, 60: 0 },
        curriculum: { 30: 0, 45: 0, 60: 0 },
        examen: { 30: 0, 45: 0, 60: 0 }
    };
    studentPackages.forEach(pkg => {
        const type = pkg.course_type;
        const duration = pkg.duration_minutes;
        if (credits[type] && credits[type][duration] !== undefined) {
            credits[type][duration] += pkg.remaining_credits;
        }
    });
    return credits;
}

function getTotalCreditsForStudent(studentId) {
    const credits = getStudentCredits(studentId);
    let total = 0;
    for (const type of ['conversation', 'curriculum', 'examen']) {
        for (const dur of [30, 45, 60]) {
            total += credits[type][dur];
        }
    }
    return total;
}

function getNearestExpiryForStudent(studentId) {
    const studentPackages = activePackagesData.filter(pkg => 
        (pkg.profiles?.id || pkg.user_id) === studentId && pkg.remaining_credits > 0 && pkg.expires_at
    );
    let nearest = null;
    studentPackages.forEach(pkg => {
        const expiryDate = new Date(pkg.expires_at);
        if (!nearest || expiryDate < nearest) nearest = expiryDate;
    });
    return nearest;
}

function findFirstAvailableCombination(studentId) {
    const credits = getStudentCredits(studentId);
    const types = ['conversation', 'curriculum', 'examen'];
    const durations = [30, 45, 60];
    for (const type of types) {
        for (const dur of durations) {
            if (credits[type][dur] > 0) {
                return { type, duration: dur };
            }
        }
    }
    return { type: 'conversation', duration: 30 };
}

function updateCreditsAndExpiry(studentId, type, duration, credits) {
    const selectedCreditsSpan = document.getElementById(`student-${studentId}-selected-credits`);
    if (selectedCreditsSpan) {
        const value = credits[type]?.[duration] || 0;
        selectedCreditsSpan.innerText = value;
    }
    const expirySpan = document.getElementById(`student-${studentId}-expiry`);
    if (expirySpan) {
        const matchingPackages = activePackagesData.filter(pkg => 
            (pkg.profiles?.id || pkg.user_id) === studentId &&
            pkg.course_type === type &&
            pkg.duration_minutes === duration &&
            pkg.remaining_credits > 0
        );
        let nearestExpiry = null;
        matchingPackages.forEach(pkg => {
            if (pkg.expires_at) {
                const d = new Date(pkg.expires_at);
                if (!nearestExpiry || d < nearestExpiry) nearestExpiry = d;
            }
        });
        const expiryText = nearestExpiry ? nearestExpiry.toLocaleDateString() : 'Aucun forfait actif';
        expirySpan.innerText = `Expire le : ${expiryText}`;
    }
}

function displayPackages(packages) {
    const container = document.getElementById('activePackagesList');
    if (!container) return;
    activePackagesData = packages || [];
    if (!activePackagesData.length) {
        container.innerHTML = '<div>Aucun forfait actif</div>';
        return;
    }

    const studentsMap = new Map();
    activePackagesData.forEach(pkg => {
        const studentId = pkg.profiles?.id || pkg.user_id;
        if (!studentId) return;
        if (!studentsMap.has(studentId)) {
            studentsMap.set(studentId, {
                name: pkg.profiles?.full_name || 'Étudiant',
                packages: []
            });
        }
        studentsMap.get(studentId).packages.push(pkg);
    });

    let studentEntries = Array.from(studentsMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        packages: data.packages,
        nearestExpiry: getNearestExpiryForStudent(id)
    }));

    studentEntries.sort((a, b) => {
        const aExcluded = EXCLUDED_STUDENT_IDS.includes(a.id);
        const bExcluded = EXCLUDED_STUDENT_IDS.includes(b.id);
        if (aExcluded && !bExcluded) return 1;
        if (!aExcluded && bExcluded) return -1;
        if (!a.nearestExpiry && !b.nearestExpiry) return 0;
        if (!a.nearestExpiry) return 1;
        if (!b.nearestExpiry) return -1;
        return a.nearestExpiry - b.nearestExpiry;
    });

    let html = '';
    for (const student of studentEntries) {
        const studentId = student.id;
        const credits = getStudentCredits(studentId);
        const totalCredits = getTotalCreditsForStudent(studentId);
        
        let defaultType = 'conversation';
        let defaultDuration = 30;
        let hasDefaultCredit = credits[defaultType]?.[defaultDuration] > 0;
        if (!hasDefaultCredit) {
            const firstAvailable = findFirstAvailableCombination(studentId);
            defaultType = firstAvailable.type;
            defaultDuration = firstAvailable.duration;
        }
        
        const defaultPackages = activePackagesData.filter(pkg => 
            (pkg.profiles?.id || pkg.user_id) === studentId &&
            pkg.course_type === defaultType &&
            pkg.duration_minutes === defaultDuration &&
            pkg.remaining_credits > 0
        );
        let defaultExpiry = null;
        defaultPackages.forEach(pkg => {
            if (pkg.expires_at) {
                const d = new Date(pkg.expires_at);
                if (!defaultExpiry || d < defaultExpiry) defaultExpiry = d;
            }
        });
        const defaultExpiryStr = defaultExpiry ? defaultExpiry.toLocaleDateString() : 'Aucun forfait actif';

        html += `
            <div class="student-package-row" data-student-id="${studentId}">
                <div class="student-package-name"><strong>${escapeHtml(student.name)}</strong></div>
                <div class="package-filters">
                    <div class="package-type-bubbles">
                        ${['conversation', 'curriculum', 'examen'].map(type => {
                            const hasAnyCredit = Object.values(credits[type]).some(v => v > 0);
                            const disabledClass = !hasAnyCredit ? 'disabled' : '';
                            const activeClass = (type === defaultType) ? 'active' : '';
                            return `
                                <button class="package-type-btn ${activeClass} ${disabledClass}" 
                                        data-type="${type}" data-student="${studentId}" 
                                        ${!hasAnyCredit ? 'disabled' : ''}>
                                    ${type === 'conversation' ? 'Conversation' : type === 'curriculum' ? 'Curriculum' : 'Examen'}
                                </button>
                            `;
                        }).join('')}
                    </div>
                    <div class="package-duration-bubbles">
                        ${[30, 45, 60].map(dur => {
                            const hasCredit = credits[defaultType]?.[dur] > 0;
                            const disabledClass = !hasCredit ? 'disabled' : '';
                            const activeClass = (dur === defaultDuration) ? 'active' : '';
                            return `
                                <button class="package-duration-btn ${activeClass} ${disabledClass}" 
                                        data-duration="${dur}" data-student="${studentId}"
                                        ${!hasCredit ? 'disabled' : ''}>
                                    ${dur} min
                                </button>
                            `;
                        }).join('')}
                    </div>
                    <div class="package-selected-credits">
                        Crédits : <strong id="student-${studentId}-selected-credits">${credits[defaultType][defaultDuration] || 0}</strong>
                    </div>
                    <div class="package-expiry" id="student-${studentId}-expiry">
                        Expire le : ${defaultExpiryStr}
                    </div>
                </div>
                <div class="package-credits-display" id="student-${studentId}-total-credits">
                    Total crédits : <strong>${totalCredits}</strong>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    document.querySelectorAll('.package-type-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.dataset.student;
            const type = btn.dataset.type;
            const parentRow = document.querySelector(`.student-package-row[data-student-id="${studentId}"]`);
            parentRow.querySelectorAll('.package-type-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            const credits = getStudentCredits(studentId);
            let firstAvailableDuration = 30;
            if (credits[type][30] > 0) firstAvailableDuration = 30;
            else if (credits[type][45] > 0) firstAvailableDuration = 45;
            else if (credits[type][60] > 0) firstAvailableDuration = 60;
            else firstAvailableDuration = 30;
            
            const durationBubbles = parentRow.querySelectorAll('.package-duration-btn');
            let selectedDuration = null;
            durationBubbles.forEach(durBtn => {
                const dur = parseInt(durBtn.dataset.duration);
                const hasCredit = credits[type]?.[dur] > 0;
                if (!hasCredit) {
                    durBtn.disabled = true;
                    durBtn.classList.add('disabled');
                    if (durBtn.classList.contains('active')) {
                        durBtn.classList.remove('active');
                    }
                } else {
                    durBtn.disabled = false;
                    durBtn.classList.remove('disabled');
                    if (dur === firstAvailableDuration && !selectedDuration) {
                        durBtn.classList.add('active');
                        selectedDuration = dur;
                    } else {
                        durBtn.classList.remove('active');
                    }
                }
            });
            if (!selectedDuration) selectedDuration = firstAvailableDuration;
            updateCreditsAndExpiry(studentId, type, selectedDuration, credits);
        });
    });

    document.querySelectorAll('.package-duration-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.dataset.student;
            const duration = parseInt(btn.dataset.duration);
            const parentRow = document.querySelector(`.student-package-row[data-student-id="${studentId}"]`);
            const activeType = parentRow.querySelector('.package-type-btn.active')?.dataset.type || 'conversation';
            const credits = getStudentCredits(studentId);
            if (!credits[activeType]?.[duration]) {
                alert(`Aucun crédit disponible pour ${activeType} ${duration} min`);
                return;
            }
            parentRow.querySelectorAll('.package-duration-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateCreditsAndExpiry(studentId, activeType, duration, credits);
        });
    });
}

// ========== ÉTUDIANTS ==========
function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!container) return;
    if (!students?.length) { container.innerHTML = '<div>Aucun étudiant</div>'; return; }

    const sortedStudents = [...students].sort((a, b) => (b.total_courses || 0) - (a.total_courses || 0));

    container.innerHTML = sortedStudents.map(s => {
        const totalSpentEur = s.direct_revenue_eur || 0;
        const extraCourses = EXTRA_COURSES[s.id] || 0;
        const extraAmount = EXTRA_AMOUNTS[s.id] || 0;
        const totalCoursesWithExtra = s.total_courses + extraCourses;
        const totalAmountWithExtra = totalSpentEur + extraAmount;

        const bookingsHtml = (s.bookings || []).map(b => `
            <div class="booking-history-item">
                ${new Date(b.start_time).toLocaleDateString()} - ${b.duration_minutes} min - ${b.booking_number} (${b.status})
            </div>
        `).join('') || 'Aucune réservation';

        return `
            <div class="student-row" data-student-id="${s.id}">
                <div class="student-summary">
                    <span class="student-name">${escapeHtml(s.full_name || 'Sans nom')}</span>
                    <span class="student-courses">📚 ${s.total_courses || 0} cours</span>
                    <span class="student-revenue">💰 ${totalSpentEur.toFixed(2)} €</span>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="student-detail">
                    <div class="student-detail-grid">
                        <div class="detail-col">
                            <strong>Historique (cours passés) :</strong>
                            <div class="booking-history-list">${bookingsHtml}</div>
                        </div>
                        <div class="detail-col detail-col-center">
                            <strong>Nombre de cours</strong>
                            <div class="detail-value">${totalCoursesWithExtra}</div>
                            ${extraCourses ? `<div class="detail-note">(+${extraCourses} bonus)</div>` : ''}
                        </div>
                        <div class="detail-col detail-col-center">
                            <strong>Total dépensé</strong>
                            <div class="detail-value">${totalAmountWithExtra.toFixed(2)} €</div>
                            ${extraAmount ? `<div class="detail-note">(+${extraAmount.toFixed(2)} € bonus)</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.student-row').forEach(row => {
        const icon = row.querySelector('.toggle-icon');
        const detail = row.querySelector('.student-detail');
        row.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('.btn-cancel-admin')) {
                detail.classList.toggle('open');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    });
}

// ========== GRAPHIQUE REVENUS ==========
function updateRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const months = Object.keys(allMonthlyRevenue).sort();
    if (months.length === 0) return;

    const startIndex = currentMonthOffset === 0 ? Math.max(0, months.length - 6) : Math.max(0, months.length - 12 + currentMonthOffset);
    const endIndex = currentMonthOffset === 0 ? months.length - 1 : Math.min(months.length - 1, startIndex + 11);
    const visible = months.slice(startIndex, endIndex + 1);

    const labels = visible.map(m => {
        const [y, mo] = m.split('-');
        return new Date(parseInt(y), parseInt(mo)-1, 1).toLocaleDateString('fr', { month:'short', year:'numeric' });
    });
    const data = visible.map(m => allMonthlyRevenue[m] || 0);

    const totalRevenue = Object.values(allMonthlyRevenue).reduce((sum, val) => sum + val, 0);
    const totalRevenueFormatted = totalRevenue.toFixed(2);
    const chartLabel = `Total revenus : ${totalRevenueFormatted} €`;

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: chartLabel, data, backgroundColor: '#3c84f6', borderRadius: 8 }] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: ctx => `${ctx.raw.toFixed(2)} €` } },
                legend: {
                    labels: {
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });

    const labelElem = document.getElementById('monthRangeLabel');
    if (labelElem) labelElem.innerText = currentMonthOffset === 0 ? '6 derniers mois' : `${labels[0]} - ${labels[labels.length-1]}`;
}

// ========== CHARGEMENT PRINCIPAL ==========
async function loadDashboard() {
    console.log('🔄 [ADMIN.JS] loadDashboard – début');
    try {
        const data = await fetchAdminDashboard();
        displayUpcoming(data.upcoming);
        displayStudents(data.students);
        displayPackages(data.activePackages);
        allMonthlyRevenue = data.monthlyRevenue || {};
        updateRevenueChart();
        console.log('✅ [ADMIN.JS] Dashboard chargé');
    } catch (err) {
        console.error('❌ [ADMIN.JS] Erreur chargement dashboard:', err);
        alert('Erreur chargement: ' + err.message);
    }
}

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏁 [ADMIN.JS] DOMContentLoaded');
    try {
        await waitForSupabase();
        await getToken();
        const { data: { user } } = await supabase.auth.getUser();
        const emailSpan = document.getElementById('adminEmail');
        if (emailSpan && user) emailSpan.innerText = user.email;
        console.log(`👤 [ADMIN.JS] Utilisateur admin : ${user.email}`);
        await loadDashboard();
        document.body.classList.add('loaded');

        document.getElementById('refreshAdminBtn')?.addEventListener('click', () => loadDashboard());
        document.getElementById('logoutAdminBtn')?.addEventListener('click', async () => {
            if (window.authManager) await window.authManager.signOut();
            window.location.href = 'index.html';
        });
        document.getElementById('monthSliderPrev')?.addEventListener('click', () => { currentMonthOffset--; updateRevenueChart(); });
        document.getElementById('monthSliderNext')?.addEventListener('click', () => { currentMonthOffset++; updateRevenueChart(); });

        console.log('✅ [ADMIN.JS] Initialisation terminée');
    } catch (err) {
        console.error('❌ [ADMIN.JS] Erreur initialisation:', err);
        alert('Erreur initialisation: ' + err.message);
    }
});