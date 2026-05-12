// admin.js - Dashboard admin sécurisé via Edge Functions Supabase
// Version robuste avec gestion d'erreur et affichage

let revenueChart = null;
let currentMonthOffset = 0;
let allMonthlyRevenue = {};

// ----------------------------------------------------------------------
// Attendre que Supabase soit complètement initialisé
// ----------------------------------------------------------------------
async function waitForSupabase() {
    if (window.supabaseInitialized) {
        await window.supabaseInitialized;
    }
    if (!window.supabase || typeof window.supabase.auth?.getSession !== 'function') {
        throw new Error('Supabase non initialisé');
    }
    return window.supabase;
}

// ----------------------------------------------------------------------
// Récupérer le token d'accès
// ----------------------------------------------------------------------
async function getAccessToken() {
    const supabase = await waitForSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!session?.access_token) throw new Error('Non authentifié');
    return session.access_token;
}

// ----------------------------------------------------------------------
// Appels aux Edge Functions (admin-dashboard et admin-cancel-booking)
// ----------------------------------------------------------------------
async function fetchAdminDashboard() {
    const token = await getAccessToken();
    const response = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur serveur');
    }
    return response.json();
}

async function cancelBookingAdmin(bookingId) {
    const token = await getAccessToken();
    const response = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-cancel-booking`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookingId })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur annulation');
    }
    return response.json();
}

// ----------------------------------------------------------------------
// Fonctions d'affichage avec vérification des éléments DOM
// ----------------------------------------------------------------------
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function displayUpcomingLessons(lessons) {
    const container = document.getElementById('adminUpcomingLessons');
    if (!container) return;
    if (!lessons || lessons.length === 0) {
        container.innerHTML = '<div class="no-upcoming">Aucun cours à venir</div>';
        return;
    }
    let html = '<div class="upcoming-list">';
    for (const lesson of lessons) {
        const studentName = lesson.profiles?.full_name || 'Étudiant';
        const start = new Date(lesson.start_time);
        html += `
            <div class="upcoming-lesson-card" data-booking-id="${lesson.id}">
                <div><strong>${escapeHtml(studentName)}</strong> - ${lesson.course_type} - ${start.toLocaleString()}</div>
                <div>Durée: ${lesson.duration_minutes} min - Plateforme: ${lesson.platform || 'Zoom'}</div>
                <button class="btn-cancel-admin cancel-admin-booking" data-id="${lesson.id}">
                    Annuler le cours
                </button>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('.cancel-admin-booking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const bookingId = btn.dataset.id;
            if (!confirm('Annuler ce cours ? Un crédit sera ajouté à l\'étudiant.')) return;
            btn.disabled = true;
            btn.innerText = 'Annulation...';
            try {
                const result = await cancelBookingAdmin(bookingId);
                if (result.success) {
                    alert('Cours annulé avec succès (crédit ajouté)');
                    loadAdminDashboard();
                } else {
                    alert('Erreur : ' + (result.error || 'Inconnue'));
                    btn.disabled = false;
                    btn.innerText = 'Annuler le cours';
                }
            } catch (err) {
                alert('Erreur : ' + err.message);
                btn.disabled = false;
                btn.innerText = 'Annuler le cours';
            }
        });
    });
}

function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!container) return;
    if (!students || students.length === 0) {
        container.innerHTML = '<div>Aucun étudiant</div>';
        return;
    }
    let html = '<div class="students-accordion">';
    for (const student of students) {
        html += `
            <div class="student-row" data-student-id="${student.id}">
                <div class="student-summary">
                    <span class="student-name">${escapeHtml(student.full_name || 'Sans nom')}</span>
                    <div class="student-stats">
                        <span>📚 ${student.total_courses || 0} cours</span>
                        <span>💰 ${(student.total_spent_eur || 0).toFixed(2)} €</span>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="student-detail" id="detail-${student.id}">
                    <strong>Historique des réservations :</strong>
                    <div class="booking-history-list">
                        ${(student.bookings || []).map(b => `
                            <div class="booking-history-item">
                                ${new Date(b.start_time).toLocaleDateString()} - ${b.duration_minutes} min - ${b.booking_number} (${b.status})
                            </div>
                        `).join('') || 'Aucune réservation'}
                    </div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('.student-row').forEach(row => {
        const icon = row.querySelector('.toggle-icon');
        const detail = row.querySelector('.student-detail');
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            if (detail) detail.classList.toggle('open');
            if (icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    });
}

function displayActivePackages(packages) {
    const container = document.getElementById('activePackagesList');
    if (!container) return;
    if (!packages || packages.length === 0) {
        container.innerHTML = '<div>Aucun forfait actif</div>';
        return;
    }
    let html = '<div class="active-packages-table">';
    for (const pkg of packages) {
        const student = pkg.profiles;
        const name = student?.full_name || 'Étudiant';
        html += `
            <div class="active-package-item">
                <span><strong>${escapeHtml(name)}</strong> - ${pkg.course_type} (${pkg.duration_minutes} min)</span>
                <span>${pkg.remaining_credits} crédit(s) restant(s)</span>
                <span>Expire le ${new Date(pkg.expires_at).toLocaleDateString()}</span>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function updateRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = new Date();
    let labelMonths = [];
    let revenueData = [];

    if (currentMonthOffset === 0) {
        for (let i = -5; i <= 0; i++) {
            let d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            let key = d.toISOString().substring(0, 7);
            labelMonths.push(d.toLocaleDateString('fr', { month: 'short', year: 'numeric' }));
            revenueData.push(allMonthlyRevenue[key] || 0);
        }
        document.getElementById('monthRangeLabel').innerText = '6 derniers mois';
    } else {
        const offsetMonths = currentMonthOffset;
        const startDate = new Date(now.getFullYear(), now.getMonth() - 11 + offsetMonths, 1);
        for (let i = 0; i < 12; i++) {
            let d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            let key = d.toISOString().substring(0, 7);
            labelMonths.push(d.toLocaleDateString('fr', { month: 'short', year: 'numeric' }));
            revenueData.push(allMonthlyRevenue[key] || 0);
        }
        document.getElementById('monthRangeLabel').innerText = `${labelMonths[0]} - ${labelMonths[11]}`;
    }

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelMonths,
            datasets: [{
                label: 'Revenus (EUR)',
                data: revenueData,
                backgroundColor: '#3c84f6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)} €` } }
            }
        }
    });
}

async function loadAdminDashboard() {
    try {
        // Afficher un indicateur de chargement
        document.getElementById('adminUpcomingLessons').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
        document.getElementById('studentsList').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
        document.getElementById('activePackagesList').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
        
        const data = await fetchAdminDashboard();
        displayUpcomingLessons(data.upcoming);
        displayStudents(data.students);
        displayActivePackages(data.activePackages);
        allMonthlyRevenue = data.monthlyRevenue || {};
        updateRevenueChart();
        
        // Cacher l'éventuel message d'erreur
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) dashboardContent.style.display = 'block';
    } catch (err) {
        console.error('Erreur chargement dashboard admin:', err);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.cssText = 'background:#fee; border:1px solid #fcc; padding:20px; margin:20px; border-radius:8px; color:#c00;';
        errorMsg.innerHTML = `<strong>Erreur de chargement :</strong> ${escapeHtml(err.message)}<br><button onclick="location.reload()" style="margin-top:10px; padding:5px 12px; background:#3c84f6; color:white; border:none; border-radius:4px;">Recharger</button>`;
        const container = document.querySelector('.dashboard-container');
        if (container) container.prepend(errorMsg);
    }
}

// ----------------------------------------------------------------------
// Initialisation de la page
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // Attendre Supabase
    try {
        await waitForSupabase();
    } catch (err) {
        console.error('Supabase non prêt', err);
        document.body.innerHTML = '<div style="color:red; padding:20px;">Erreur technique : Supabase non initialisé. Veuillez rafraîchir.</div>';
        return;
    }

    // Attendre que l'utilisateur soit connecté
    let user = null;
    let attempts = 0;
    while (!user && attempts < 50) {
        if (window.authManager && window.authManager.isAuthenticated()) {
            user = window.authManager.getCurrentUser();
            break;
        }
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('adminEmail') && (document.getElementById('adminEmail').textContent = user.email);

    // Charger le dashboard
    await loadAdminDashboard();

    // Écouteurs des boutons
    const logoutBtn = document.getElementById('logoutAdminBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (window.authManager) await window.authManager.signOut();
            window.location.href = 'index.html';
        });
    }
    const refreshBtn = document.getElementById('refreshAdminBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadAdminDashboard());
    const prevBtn = document.getElementById('monthSliderPrev');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentMonthOffset--; updateRevenueChart(); });
    const nextBtn = document.getElementById('monthSliderNext');
    if (nextBtn) nextBtn.addEventListener('click', () => { currentMonthOffset++; updateRevenueChart(); });
});