// admin.js - Dashboard administrateur
let revenueChart = null;
let currentMonthOffset = 0; // 0 = 6 derniers mois, négatif = mois précédents, positif = mois futurs (si données)

document.addEventListener('DOMContentLoaded', async () => {
    // Attendre l'authentification
    const checkAdmin = () => {
        if (window.authManager && window.authManager.isAuthenticated()) {
            const user = window.authManager.getCurrentUser();
            const adminEmails = (window.YOTEACHER_CONFIG?.ADMIN_EMAILS || '').split(',').map(e => e.trim());
            if (adminEmails.includes(user.email)) {
                document.getElementById('adminEmail').textContent = user.email;
                loadAdminDashboard();
            } else {
                alert('Accès non autorisé. Redirection vers l\'accueil.');
                window.location.href = 'index.html';
            }
        } else {
            setTimeout(checkAdmin, 200);
        }
    };
    checkAdmin();

    document.getElementById('logoutAdminBtn').addEventListener('click', async () => {
        await window.authManager.signOut();
        window.location.href = 'index.html';
    });
    document.getElementById('refreshAdminBtn').addEventListener('click', () => loadAdminDashboard());

    // Navigation du graphique
    document.getElementById('monthSliderPrev').addEventListener('click', () => {
        currentMonthOffset--;
        loadRevenueChart();
    });
    document.getElementById('monthSliderNext').addEventListener('click', () => {
        currentMonthOffset++;
        loadRevenueChart();
    });
});

async function loadAdminDashboard() {
    console.log('📊 Chargement dashboard admin...');
    await Promise.all([
        loadUpcomingLessonsAdmin(),
        loadStudentsList(),
        loadActivePackagesAdmin(),
        loadRevenueChart()
    ]);
}

// ----- 1. Récupération des prochains cours (tous) avec bouton annuler -----
async function loadUpcomingLessonsAdmin() {
    const container = document.getElementById('adminUpcomingLessons');
    if (!window.supabase) return;

    const { data, error } = await supabase
        .from('upcoming_bookings')
        .select('*, profiles(full_name, email)')
        .order('start_time', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="error">Erreur : ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="no-upcoming">Aucun cours à venir</div>';
        return;
    }

    let html = '<div class="upcoming-list">';
    for (const lesson of data) {
        const studentName = lesson.profiles?.full_name || lesson.profiles?.email || 'Inconnu';
        const start = new Date(lesson.start_time);
        const hoursUntil = (start - new Date()) / (1000 * 3600);
        const canCancel = hoursUntil > 24; // pour l'admin on autorise toujours via notre RPC, mais on garde l'affichage

        html += `
            <div class="upcoming-lesson-card" data-booking-id="${lesson.id}">
                <div><strong>${studentName}</strong> - ${lesson.course_type} - ${start.toLocaleString()}</div>
                <div>Durée: ${lesson.duration_minutes} min - Plateforme: ${lesson.platform || 'Zoom'}</div>
                <button class="btn-cancel-admin cancel-admin-booking" data-id="${lesson.id}">
                    Annuler le cours
                </button>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    // Attacher les événements d'annulation
    document.querySelectorAll('.cancel-admin-booking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const bookingId = btn.dataset.id;
            await adminCancelBooking(bookingId);
        });
    });
}

// ----- 2. Annulation admin (force + crédit + Cal.com) -----
async function adminCancelBooking(bookingId) {
    if (!confirm('Annuler ce cours ? Un crédit sera ajouté à l\'étudiant.')) return;

    const originalText = event.target.innerText;
    event.target.innerText = 'Annulation...';
    event.target.disabled = true;

    try {
        // 1. Appel RPC admin_force_cancel_booking
        const { data, error } = await supabase.rpc('admin_force_cancel_booking', {
            p_booking_id: bookingId
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error);

        // 2. Récupérer calcom_uid pour annuler Cal.com
        const { data: booking, error: bErr } = await supabase
            .from('bookings')
            .select('calcom_uid')
            .eq('id', bookingId)
            .single();

        if (!bErr && booking?.calcom_uid) {
            // Utiliser la même méthode que booking-cancel.js
            if (window.bookingCancellation && window.bookingCancellation.cancelCalcomBooking) {
                await window.bookingCancellation.cancelCalcomBooking(booking.calcom_uid);
            } else {
                console.warn('Impossible d\'annuler Cal.com');
            }
        }

        alert('Cours annulé avec succès (crédit ajouté)');
        loadUpcomingLessonsAdmin(); // rafraîchir
        loadStudentsList();         // rafraîchir les stats
        loadActivePackagesAdmin();
    } catch (err) {
        console.error(err);
        alert('Erreur : ' + err.message);
        event.target.innerText = originalText;
        event.target.disabled = false;
    }
}

// ----- 3. Liste des étudiants (nom, total cours, total dépensé) + menu déroulant historique -----
async function loadStudentsList() {
    const container = document.getElementById('studentsList');
    if (!window.supabase) return;

    // Récupérer tous les profils
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email');

    if (pErr) {
        container.innerHTML = `<div class="error">Erreur profils : ${pErr.message}</div>`;
        return;
    }

    let html = '<div class="students-accordion">';
    for (const student of profiles) {
        // Nombre de réservations complétées (status = 'completed')
        const { count: completedCount, error: cErr } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', student.id)
            .eq('status', 'completed');

        // Total dépensé (somme des price_paid des packages convertis en EUR)
        const { data: packages, error: pkgErr } = await supabase
            .from('packages')
            .select('price_paid, currency')
            .eq('user_id', student.id);

        let totalSpentEur = 0;
        if (!pkgErr && packages) {
            for (const pkg of packages) {
                let amount = parseFloat(pkg.price_paid);
                if (pkg.currency && pkg.currency !== 'EUR') {
                    amount = window.currencyManager?.convert(amount, pkg.currency, 'EUR') || amount;
                }
                totalSpentEur += amount;
            }
        }

        // Récupérer l'historique des réservations (toutes, pour affichage déroulant)
        const { data: bookings, error: bkErr } = await supabase
            .from('bookings')
            .select('booking_number, start_time, duration_minutes, status')
            .eq('user_id', student.id)
            .order('start_time', { ascending: false })
            .limit(20);

        let historyHtml = '';
        if (!bkErr && bookings && bookings.length) {
            historyHtml = '<div class="booking-history-list">';
            for (const b of bookings) {
                const date = new Date(b.start_time).toLocaleDateString();
                historyHtml += `
                    <div class="booking-history-item">
                        <span>${date} - ${b.duration_minutes} min - ${b.booking_number} (${b.status})</span>
                    </div>
                `;
            }
            historyHtml += '</div>';
        } else {
            historyHtml = '<div class="booking-history-empty">Aucune réservation</div>';
        }

        html += `
            <div class="student-row" data-student-id="${student.id}">
                <div class="student-summary">
                    <span class="student-name">${student.full_name || student.email}</span>
                    <div class="student-stats">
                        <span>📚 ${completedCount || 0} cours</span>
                        <span>💰 ${totalSpentEur.toFixed(2)} €</span>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="student-detail" id="detail-${student.id}">
                    <strong>Historique des réservations :</strong>
                    ${historyHtml}
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;

    // Gestion du clic pour ouvrir/fermer le détail
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

// ----- 4. Forfaits actifs (par étudiant, crédits restants) -----
async function loadActivePackagesAdmin() {
    const container = document.getElementById('activePackagesList');
    if (!window.supabase) return;

    const { data, error } = await supabase
        .from('user_active_packages')
        .select('*, profiles(full_name, email)')
        .order('expires_at', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="error">Erreur : ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<div>Aucun forfait actif</div>';
        return;
    }

    let html = '<div class="active-packages-table">';
    for (const pkg of data) {
        const student = pkg.profiles;
        const name = student?.full_name || student?.email || 'Inconnu';
        html += `
            <div class="active-package-item">
                <span><strong>${name}</strong> - ${pkg.course_type} (${pkg.duration_minutes} min)</span>
                <span>${pkg.remaining_credits} crédit(s) restant(s)</span>
                <span>Expire le ${new Date(pkg.expires_at).toLocaleDateString()}</span>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

// ----- 5. Graphique des revenus (convertis en euros, slider mois) -----
async function loadRevenueChart() {
    // Déterminer la plage de mois à afficher
    const now = new Date();
    let startDate, endDate;
    let labelMonths = [];

    if (currentMonthOffset === 0) {
        // 6 derniers mois
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        endDate = now;
        for (let i = -5; i <= 0; i++) {
            let d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            labelMonths.push(d.toLocaleDateString('fr', { month: 'short', year: 'numeric' }));
        }
        document.getElementById('monthRangeLabel').innerText = '6 derniers mois';
    } else {
        // Slider mois par mois : on affiche 12 mois glissants ? Le client veut "slider mois par mois sur toutes les données"
        // Pour simplifier, on affiche 12 mois à partir d'un offset.
        const offsetMonths = currentMonthOffset; // décalage
        startDate = new Date(now.getFullYear(), now.getMonth() - 11 + offsetMonths, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1 + offsetMonths, 0);
        for (let i = 0; i < 12; i++) {
            let d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            labelMonths.push(d.toLocaleDateString('fr', { month: 'short', year: 'numeric' }));
        }
        document.getElementById('monthRangeLabel').innerText = `${labelMonths[0]} - ${labelMonths[11]}`;
    }

    // Récupérer les packages achetés dans cette plage
    const { data: packages, error } = await supabase
        .from('packages')
        .select('purchased_at, price_paid, currency')
        .gte('purchased_at', startDate.toISOString())
        .lte('purchased_at', endDate.toISOString());

    if (error) {
        console.error(error);
        return;
    }

    // Aggréger par mois (YYYY-MM)
    const monthlyMap = new Map();
    for (const pkg of packages) {
        const monthKey = pkg.purchased_at.substring(0, 7); // YYYY-MM
        let amount = parseFloat(pkg.price_paid);
        if (pkg.currency && pkg.currency !== 'EUR') {
            amount = window.currencyManager?.convert(amount, pkg.currency, 'EUR') || amount;
        }
        const current = monthlyMap.get(monthKey) || 0;
        monthlyMap.set(monthKey, current + amount);
    }

    // Construire les données pour chaque mois de la plage
    const revenueData = [];
    for (let i = 0; i < labelMonths.length; i++) {
        const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const key = monthDate.toISOString().substring(0, 7);
        revenueData.push(monthlyMap.get(key) || 0);
    }

    // Mettre à jour le graphique
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