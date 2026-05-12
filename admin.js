// admin.js – Dashboard administrateur avec logs complets
console.log('🔵 [ADMIN.JS] Script chargé');

let revenueChart = null, currentMonthOffset = 0, allMonthlyRevenue = {};

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
    document.querySelectorAll('.btn-cancel-admin').forEach(btn => {
        btn.addEventListener('click', async e => {
            const id = btn.dataset.id;
            console.log(`🖱️ [ADMIN.JS] Clic annulation pour bookingId=${id}`);
            if (!confirm('Annuler ce cours ? Un crédit sera ajouté.')) return;
            btn.disabled = true;
            btn.innerText = 'Annulation...';
            try {
                const result = await cancelBookingAdmin(id);
                alert(result.creditRefunded ? 'Cours annulé (crédit ajouté, Cal.com annulé)' : 'Cours annulé (aucun crédit)');
                location.reload();
            } catch (err) {
                console.error('❌ [ADMIN.JS] Erreur lors de l\'annulation:', err);
                alert('Erreur: ' + err.message);
                btn.disabled = false;
                btn.innerText = 'Annuler le cours';
            }
        });
    });
}

function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!container) return;
    if (!students?.length) { container.innerHTML = '<div>Aucun étudiant</div>'; return; }
    container.innerHTML = students.map(s => {
        let totalSpentEur = 0;
        if (s.packages && window.currencyManager) {
            for (const pkg of s.packages) {
                let amount = parseFloat(pkg.price_paid);
                if (pkg.currency && pkg.currency !== 'EUR') {
                    amount = window.currencyManager.convert(amount, pkg.currency, 'EUR');
                }
                totalSpentEur += amount;
            }
        }
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
        options: { responsive: true, maintainAspectRatio: true, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.toFixed(2)} €` } } } }
    });
    const labelElem = document.getElementById('monthRangeLabel');
    if (labelElem) labelElem.innerText = currentMonthOffset === 0 ? '6 derniers mois' : `${labels[0]} - ${labels[labels.length-1]}`;
}

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

        const refreshBtn = document.getElementById('refreshAdminBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboard());
        const logoutBtn = document.getElementById('logoutAdminBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', async () => {
            if (window.authManager) await window.authManager.signOut();
            window.location.href = 'index.html';
        });
        const prevBtn = document.getElementById('monthSliderPrev');
        if (prevBtn) prevBtn.addEventListener('click', () => { currentMonthOffset--; updateRevenueChart(); });
        const nextBtn = document.getElementById('monthSliderNext');
        if (nextBtn) nextBtn.addEventListener('click', () => { currentMonthOffset++; updateRevenueChart(); });
        console.log('✅ [ADMIN.JS] Initialisation terminée');
    } catch (err) {
        console.error('❌ [ADMIN.JS] Erreur initialisation:', err);
        alert('Erreur initialisation: ' + err.message);
    }
});