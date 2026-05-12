// admin.js - Dashboard admin via Edge Function Supabase

let revenueChart = null;
let currentMonthOffset = 0;
let allMonthlyRevenue = {}; // stocké depuis l'API

// Helper pour appeler l'Edge Function dashboard
async function fetchAdminDashboard() {
    const session = await window.supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('Non authentifié');

    const response = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/admin-dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur serveur');
    }
    return response.json();
}

// Helper pour annuler un cours (Edge Function admin-cancel-booking)
async function cancelBookingAdmin(bookingId) {
    const session = await window.supabase.auth.getSession();
    const token = session.data.session?.access_token;
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

async function loadAdminDashboard() {
    try {
        const data = await fetchAdminDashboard();
        // data = { upcoming, students, activePackages, monthlyRevenue }
        displayUpcomingLessons(data.upcoming);
        displayStudents(data.students);
        displayActivePackages(data.activePackages);
        allMonthlyRevenue = data.monthlyRevenue || {};
        updateRevenueChart();
    } catch (err) {
        console.error(err);
        alert('Erreur chargement : ' + err.message);
        if (err.message.includes('Non autorisé') || err.message.includes('Accès interdit')) {
            window.location.href = 'index.html';
        }
    }
}

function displayUpcomingLessons(lessons) {
    const container = document.getElementById('adminUpcomingLessons');
    if (!lessons || lessons.length === 0) {
        container.innerHTML = '<div class="no-upcoming">Aucun cours à venir</div>';
        return;
    }
    let html = '<div class="upcoming-list">';
    for (const lesson of lessons) {
        const studentName = lesson.profiles?.full_name || lesson.profiles?.email || 'Inconnu';
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

    // Attacher événements annulation
    document.querySelectorAll('.cancel-admin-booking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const bookingId = btn.dataset.id;
            if (confirm('Annuler ce cours ? Un crédit sera ajouté à l\'étudiant.')) {
                btn.disabled = true;
                btn.innerText = 'Annulation...';
                try {
                    const result = await cancelBookingAdmin(bookingId);
                    if (result.success) {
                        alert('Cours annulé avec succès (crédit ajouté)');
                        loadAdminDashboard(); // recharger tout
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
            }
        });
    });
}

function displayStudents(students) {
    const container = document.getElementById('studentsList');
    if (!students || students.length === 0) {
        container.innerHTML = '<div>Aucun étudiant</div>';
        return;
    }
    let html = '<div class="students-accordion">';
    for (const student of students) {
        html += `
            <div class="student-row" data-student-id="${student.id}">
                <div class="student-summary">
                    <span class="student-name">${escapeHtml(student.full_name || student.email)}</span>
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

    // Gestion clic pour ouvrir/fermer
    document.querySelectorAll('.student-row').forEach(row => {
        const icon = row.querySelector('.toggle-icon');
        const detail = row.querySelector('.student-detail');
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            detail.classList.toggle('open');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });
    });
}

function displayActivePackages(packages) {
    const container = document.getElementById('activePackagesList');
    if (!packages || packages.length === 0) {
        container.innerHTML = '<div>Aucun forfait actif</div>';
        return;
    }
    let html = '<div class="active-packages-table">';
    for (const pkg of packages) {
        const student = pkg.profiles;
        const name = student?.full_name || student?.email || 'Inconnu';
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
    const now = new Date();
    let startDate, endDate;
    let labelMonths = [];
    let revenueData = [];

    if (currentMonthOffset === 0) {
        // 6 derniers mois
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        for (let i = -5; i <= 0; i++) {
            let d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            let key = d.toISOString().substring(0, 7);
            labelMonths.push(d.toLocaleDateString('fr', { month: 'short', year: 'numeric' }));
            revenueData.push(allMonthlyRevenue[key] || 0);
        }
        document.getElementById('monthRangeLabel').innerText = '6 derniers mois';
    } else {
        // Slider 12 mois
        const offsetMonths = currentMonthOffset;
        startDate = new Date(now.getFullYear(), now.getMonth() - 11 + offsetMonths, 1);
        for (let i = 0; i < 12; i++) {
            let d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            let key = d.toISOString().substring(0, 7);
            labelMonths.push(d.toLocaleDateString('fr', { month: 'short', year: 'numeric' }));
            revenueData.push(allMonthlyRevenue[key] || 0);
        }
        const endDateLabel = new Date(startDate.getFullYear(), startDate.getMonth() + 11, 1);
        document.getElementById('monthRangeLabel').innerText = `${labelMonths[0]} - ${labelMonths[11]}`;
    }

    const ctx = document.getElementById('revenueChart').getContext('2d');
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

// Utilitaires
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Attendre que authManager soit prêt
    const checkAuth = () => {
        if (window.authManager && window.authManager.isAuthenticated()) {
            const user = window.authManager.getCurrentUser();
            document.getElementById('adminEmail').textContent = user.email;
            loadAdminDashboard();
        } else {
            setTimeout(checkAuth, 200);
        }
    };
    checkAuth();

    document.getElementById('logoutAdminBtn').addEventListener('click', async () => {
        await window.authManager.signOut();
        window.location.href = 'index.html';
    });
    document.getElementById('refreshAdminBtn').addEventListener('click', () => loadAdminDashboard());

    document.getElementById('monthSliderPrev').addEventListener('click', () => {
        currentMonthOffset--;
        updateRevenueChart();
    });
    document.getElementById('monthSliderNext').addEventListener('click', () => {
        currentMonthOffset++;
        updateRevenueChart();
    });
});