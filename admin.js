// admin.js – Dashboard administrateur final
console.log('admin.js chargé');

let revenueChart = null, currentMonthOffset = 0, allMonthlyRevenue = {};

// ----------------------------------------------------------------------
// Utilitaires d'attente et token
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// Appels aux Edge Functions
// ----------------------------------------------------------------------
async function fetchAdminDashboard() {
    const token = await getToken();
    const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function cancelBookingAdmin(bookingId) {
    const token = await getToken();
    const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-cancel-booking`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookingId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur annulation');

    // === ANNULATION CAL.COM (exactement comme dans booking-cancel.js) ===
    if (result.calcomUid && window.YOTEACHER_CONFIG?.CALCOM_API_KEY) {
        try {
            const apiUrl = `https://api.cal.com/v2/bookings/${result.calcomUid}`;
            // Vérifier si la réservation existe (optionnel)
            const checkRes = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${window.YOTEACHER_CONFIG.CALCOM_API_KEY}`,
                    'Cal-API-Version': 'v2'
                }
            });
            if (checkRes.ok) {
                const cancelRes = await fetch(`${apiUrl}/cancel`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${window.YOTEACHER_CONFIG.CALCOM_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Cal-API-Version': 'v2'
                    },
                    body: JSON.stringify({ cancellationReason: 'Annulé par administrateur' })
                });
                if (!cancelRes.ok) console.warn('Échec annulation Cal.com');
            } else if (checkRes.status === 404) {
                // déjà annulée ou inexistante → rien à faire
            }
        } catch (err) {
            console.warn('Erreur annulation Cal.com (non bloquante)', err);
        }
    }
    // ================================================================

    return result;
}

// ----------------------------------------------------------------------
// Affichage (HTML sécurisé)
// ----------------------------------------------------------------------
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
            if (!confirm('Annuler ce cours ? Un crédit sera ajouté.')) return;
            btn.disabled = true; btn.innerText = 'Annulation...';
            try {
                await cancelBookingAdmin(id);
                alert('Cours annulé (crédit rendu, Cal.com annulé)');
                location.reload();
            } catch (err) {
                alert('Erreur: ' + err.message);
                btn.disabled = false; btn.innerText = 'Annuler le cours';
            }
        });
    });
}

function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!container) return;
    if (!students?.length) { container.innerHTML = '<div>Aucun étudiant</div>'; return; }
    container.innerHTML = students.map(s => {
        // Calcul du total dépensé en EUR via currencyManager
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

    // Gestion clic pour ouvrir/fermer les détails
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
    try {
        const data = await fetchAdminDashboard();
        displayUpcoming(data.upcoming);
        displayStudents(data.students);
        displayPackages(data.activePackages);
        allMonthlyRevenue = data.monthlyRevenue || {};
        updateRevenueChart();
    } catch (err) {
        console.error(err);
        alert('Erreur chargement: ' + err.message);
    }
}

// ----------------------------------------------------------------------
// Initialisation
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForSupabase();
        await getToken(); // valide la session
        const { data: { user } } = await supabase.auth.getUser();
        const emailSpan = document.getElementById('adminEmail');
        if (emailSpan && user) emailSpan.innerText = user.email;

        await loadDashboard();
        document.body.classList.add('loaded');  // corrige l'écran blanc (CSS)

        // Écouteurs
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
    } catch (err) {
        console.error(err);
        alert('Erreur initialisation: ' + err.message);
    }
});