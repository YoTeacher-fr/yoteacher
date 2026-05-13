// admin.js – Dashboard administrateur (revenus 100% bookings unitaires)
console.log('🔵 [ADMIN.JS] Script chargé');

let revenueChart = null, currentMonthOffset = 0, allMonthlyRevenue = {};

// --- Carrousel prochains cours ---
let adminUpcomingLessons = [];
let adminCurrentStartIndex = 0;
const LESSONS_PER_PAGE = 3;

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

    // Annulation Cal.com
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

// ========== CARROUSEL PROCHAINS COURS (3 BULLES) ==========
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
        const formattedDate = new Date(lesson.start_time).toLocaleString();
        
        return `
            <div class="upcoming-lesson-card">
                <div><strong>${escapeHtml(lesson.profiles?.full_name || 'Étudiant')}</strong></div>
                <div>${escapeHtml(lesson.course_type)}</div>
                <div>📅 ${formattedDate}</div>
                <div style="display: flex; gap: 10px; margin-top: 12px;">
                    ${hasMeeting ? `<a href="${escapeHtml(meetingLink)}" target="_blank" class="btn-join-admin"><i class="fas fa-video"></i> Rejoindre</a>` : '<button class="btn-join-admin-disabled" disabled title="Lien non disponible">Rejoindre</button>'}
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

    // Attacher événements annulation
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
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (adminCurrentStartIndex > 0) {
                adminCurrentStartIndex = Math.max(0, adminCurrentStartIndex - LESSONS_PER_PAGE);
                renderUpcomingSlice();
            }
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (adminCurrentStartIndex + LESSONS_PER_PAGE < adminUpcomingLessons.length) {
                adminCurrentStartIndex += LESSONS_PER_PAGE;
                renderUpcomingSlice();
            }
        };
    }
}

function displayUpcoming(lessons) {
    adminUpcomingLessons = lessons || [];
    adminCurrentStartIndex = 0;
    renderUpcomingSlice();
}

// ========== ÉTUDIANTS (REVENUS BASÉS UNIQUEMENT SUR BOOKINGS PAYANTS) ==========
function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!container) return;
    if (!students?.length) { container.innerHTML = '<div>Aucun étudiant</div>'; return; }

    container.innerHTML = students.map(s => {
        const totalSpentEur = s.direct_revenue_eur || 0;
        return `
            <div class="student-row">
                <div class="student-summary">
                    <span class="student-name">${escapeHtml(s.full_name || 'Sans nom')}</span>
                    <div class="student-stats">
                        <span>📚 ${s.total_courses || 0} cours</span>
                        <span>💰 ${totalSpentEur.toFixed(2)} €</span>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="student-detail">
                    <strong>Historique (cours passés) :</strong>
                    <div class="booking-history-list">
                        ${(s.bookings || []).map(b => `
                            <div class="booking-history-item">
                                ${new Date(b.start_time).toLocaleDateString()} - ${b.duration_minutes} min - ${b.booking_number} (${b.status})
                            </div>
                        `).join('') || 'Aucune réservation'}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.student-row').forEach(row => {
        const icon = row.querySelector('.toggle-icon');
        const detail = row.querySelector('.student-detail');
        row.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                detail.classList.toggle('open');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    });
}

// ========== FORFAITS ACTIFS ==========
function displayPackages(packages) {
    const container = document.getElementById('activePackagesList');
    if (!container) return;
    if (!packages?.length) { container.innerHTML = '<div>Aucun forfait actif</div>'; return; }
    container.innerHTML = packages.map(p => `
        <div class="active-package-item">
            <span><strong>${escapeHtml(p.profiles?.full_name || 'Étudiant')}</strong> - ${p.course_type} (${p.duration_minutes} min)</span>
            <span>${p.remaining_credits} crédit(s)</span>
            <span>Expire le ${new Date(p.expires_at).toLocaleDateString()}</span>
        </div>
    `).join('');
}

// ========== GRAPHIQUE DES REVENUS ==========
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

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Revenus (EUR)', data, backgroundColor: '#3c84f6', borderRadius: 8 }] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: ctx => `${ctx.raw.toFixed(2)} €` } }
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