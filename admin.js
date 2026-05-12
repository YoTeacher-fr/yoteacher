// admin.js – version stable avec vérifications
console.log('admin.js chargé');

let revenueChart = null, currentMonthOffset = 0, allMonthlyRevenue = {};

async function waitForSupabase() {
    if (window.supabaseInitialized) await window.supabaseInitialized;
    if (!window.supabase || !window.supabase.auth) throw new Error('Supabase non initialisé');
    return window.supabase;
}

async function getToken() {
    const supabase = await waitForSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');
    return session.access_token;
}

async function fetchAdminDashboard() {
    const token = await getToken();
    const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function cancelBooking(bookingId) {
    const token = await getToken();
    const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-cancel-booking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function escapeHtml(str) { return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }

function displayUpcoming(lessons) {
    const container = document.getElementById('adminUpcomingLessons');
    if (!container) return;
    if (!lessons?.length) { container.innerHTML = '<div>Aucun cours à venir</div>'; return; }
    container.innerHTML = lessons.map(lesson => `
        <div class="upcoming-lesson-card">
            <div><strong>${escapeHtml(lesson.profiles?.full_name || 'Étudiant')}</strong> - ${lesson.course_type} - ${new Date(lesson.start_time).toLocaleString()}</div>
            <div>Durée: ${lesson.duration_minutes} min - ${lesson.platform || 'Zoom'}</div>
            <button class="btn-cancel-admin" data-id="${lesson.id}">Annuler le cours</button>
        </div>
    `).join('');
    document.querySelectorAll('.btn-cancel-admin').forEach(btn => btn.addEventListener('click', async e => {
        const id = btn.dataset.id;
        if (!confirm('Annuler ce cours ? Un crédit sera ajouté.')) return;
        btn.disabled = true; btn.innerText = 'Annulation...';
        try { await cancelBooking(id); alert('Annulé'); location.reload(); } 
        catch (err) { alert('Erreur: ' + err.message); btn.disabled = false; btn.innerText = 'Annuler le cours'; }
    }));
}

function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!container) return;
    if (!students?.length) { container.innerHTML = '<div>Aucun étudiant</div>'; return; }
    container.innerHTML = students.map(s => `
        <div class="student-row">
            <div class="student-summary">
                <span class="student-name">${escapeHtml(s.full_name || 'Sans nom')}</span>
                <div class="student-stats">
                    <span>📚 ${s.total_courses || 0} cours</span>
                    <span>💰 ${(s.total_spent_eur || 0).toFixed(2)} €</span>
                </div>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </div>
            <div class="student-detail">
                <strong>Historique :</strong>
                <div class="booking-history-list">
                    ${(s.bookings || []).map(b => `
                        <div class="booking-history-item">
                            ${new Date(b.start_time).toLocaleDateString()} - ${b.duration_minutes} min - ${b.booking_number} (${b.status})
                        </div>
                    `).join('') || 'Aucune réservation'}
                </div>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.student-row').forEach(row => {
        const icon = row.querySelector('.toggle-icon');
        const detail = row.querySelector('.student-detail');
        row.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') { detail.classList.toggle('open'); icon.classList.toggle('fa-chevron-down'); icon.classList.toggle('fa-chevron-up'); } });
    });
}

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

function updateRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = new Date();
    let start = currentMonthOffset === 0 ? -5 : -11 + currentMonthOffset;
    let end = currentMonthOffset === 0 ? 0 : start + 11;
    let labels = [], data = [];
    for (let i = start; i <= end; i++) {
        let d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        let key = d.toISOString().slice(0,7);
        labels.push(d.toLocaleDateString('fr', { month:'short', year:'numeric' }));
        data.push(allMonthlyRevenue[key] || 0);
    }
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Revenus (EUR)', data, backgroundColor:'#3c84f6', borderRadius:8 }] }, options:{ responsive:true, maintainAspectRatio:true, plugins:{ tooltip:{ callbacks:{ label: ctx => `${ctx.raw.toFixed(2)} €` } } } } });
    const monthLabel = document.getElementById('monthRangeLabel');
    if (monthLabel) monthLabel.innerText = currentMonthOffset === 0 ? '6 derniers mois' : `${labels[0]} - ${labels[labels.length-1]}`;
}

async function loadDashboard() {
    try {
        const data = await fetchAdminDashboard();
        displayUpcoming(data.upcoming);
        displayStudents(data.students);
        displayPackages(data.activePackages);
        allMonthlyRevenue = data.monthlyRevenue || {};
        updateRevenueChart();
    } catch (err) { console.error(err); alert('Erreur chargement: ' + err.message); }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForSupabase();
        await getToken(); // vérifie la session
        const userEmail = (await supabase.auth.getUser()).data.user?.email;
        const adminEmailElem = document.getElementById('adminEmail');
        if (adminEmailElem) adminEmailElem.innerText = userEmail;
        await loadDashboard();

        // Attachement sécurisé des événements
        const refreshBtn = document.getElementById('refreshAdminBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboard());
        const logoutBtn = document.getElementById('logoutAdminBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', async () => { await window.authManager?.signOut(); window.location.href = 'index.html'; });
        const prevBtn = document.getElementById('monthSliderPrev');
        const nextBtn = document.getElementById('monthSliderNext');
        if (prevBtn) prevBtn.addEventListener('click', () => { currentMonthOffset--; updateRevenueChart(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { currentMonthOffset++; updateRevenueChart(); });
    } catch (err) { 
        console.error(err);
        alert('Erreur initialisation: ' + err.message);
    }
});