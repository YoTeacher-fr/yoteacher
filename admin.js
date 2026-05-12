// admin.js – Dashboard admin complet (v2)
console.log('🔵 admin.js chargé – début');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🟢 DOMContentLoaded – attente Supabase...');

    // Attendre Supabase
    if (window.supabaseInitialized) await window.supabaseInitialized;
    if (!window.supabase || !window.supabase.auth) {
        console.error('❌ Supabase non disponible');
        document.body.innerHTML = '<div style="color:red; padding:20px;">Erreur : Supabase non initialisé</div>';
        return;
    }
    console.log('✅ Supabase prêt');

    // Récupérer session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        console.error('❌ Pas de session', error);
        window.location.href = 'login.html';
        return;
    }
    console.log('✅ Utilisateur connecté:', session.user.email);

    // Vérifier admin (via l'appel à l'Edge Function, on verra ensuite)
    const token = session.access_token;
    console.log('🔑 Token récupéré');

    // Appeler l’Edge Function
    try {
        const resp = await fetch('https://bsbhqathonubghytmbvm.supabase.co/functions/v1/admin-dashboard', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        console.log('📦 Données reçues:', data);

        // Afficher le contenu du dashboard
        afficherDashboard(data);
    } catch (err) {
        console.error('❌ Erreur appel Edge Function:', err);
        document.body.innerHTML = `<div style="color:red; padding:20px;">Erreur : ${err.message}</div>`;
    }
});

function afficherDashboard(data) {
    // Cacher l'écran de chargement (s'il existe)
    const loading = document.querySelector('.loading');
    if (loading) loading.style.display = 'none';

    // Mettre à jour la section "Prochains cours"
    const upcomingDiv = document.getElementById('adminUpcomingLessons');
    if (upcomingDiv) {
        if (!data.upcoming || data.upcoming.length === 0) {
            upcomingDiv.innerHTML = '<div class="no-upcoming">Aucun cours à venir</div>';
        } else {
            let html = '<div class="upcoming-list">';
            for (const lesson of data.upcoming) {
                const studentName = lesson.profiles?.full_name || 'Étudiant';
                const start = new Date(lesson.start_time);
                html += `
                    <div class="upcoming-lesson-card">
                        <div><strong>${escapeHtml(studentName)}</strong> - ${lesson.course_type} - ${start.toLocaleString()}</div>
                        <div>Durée: ${lesson.duration_minutes} min - ${lesson.platform || 'Zoom'}</div>
                        <button class="btn-cancel-admin" data-id="${lesson.id}">Annuler le cours</button>
                    </div>
                `;
            }
            html += '</div>';
            upcomingDiv.innerHTML = html;
            // Attacher les événements d'annulation après affichage
            document.querySelectorAll('.btn-cancel-admin').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.dataset.id;
                    if (confirm('Annuler ce cours ? Un crédit sera ajouté.')) {
                        btn.disabled = true;
                        btn.innerText = 'Annulation...';
                        try {
                            const token = (await supabase.auth.getSession()).data.session?.access_token;
                            const resp = await fetch('https://bsbhqathonubghytmbvm.supabase.co/functions/v1/admin-cancel-booking', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bookingId: id })
                            });
                            const result = await resp.json();
                            if (result.success) {
                                alert('Cours annulé');
                                location.reload();
                            } else {
                                alert('Erreur: ' + (result.error || 'Inconnue'));
                                btn.disabled = false;
                                btn.innerText = 'Annuler le cours';
                            }
                        } catch (err) {
                            alert('Erreur: ' + err.message);
                            btn.disabled = false;
                            btn.innerText = 'Annuler le cours';
                        }
                    }
                });
            });
        }
    }

    // Liste des étudiants
    const studentsDiv = document.getElementById('studentsList');
    if (studentsDiv && data.students) {
        let html = '<div class="students-accordion">';
        for (const s of data.students) {
            html += `
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
            `;
        }
        html += '</div>';
        studentsDiv.innerHTML = html;
        // Gestion clic pour ouvrir/fermer les détails
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

    // Forfaits actifs
    const packagesDiv = document.getElementById('activePackagesList');
    if (packagesDiv && data.activePackages) {
        if (data.activePackages.length === 0) {
            packagesDiv.innerHTML = '<div>Aucun forfait actif</div>';
        } else {
            let html = '<div class="active-packages-table">';
            for (const pkg of data.activePackages) {
                const name = pkg.profiles?.full_name || 'Étudiant';
                html += `
                    <div class="active-package-item">
                        <span><strong>${escapeHtml(name)}</strong> - ${pkg.course_type} (${pkg.duration_minutes} min)</span>
                        <span>${pkg.remaining_credits} crédit(s)</span>
                        <span>Expire le ${new Date(pkg.expires_at).toLocaleDateString()}</span>
                    </div>
                `;
            }
            html += '</div>';
            packagesDiv.innerHTML = html;
        }
    }

    // Graphique des revenus (optionnel, vous pouvez le réactiver plus tard)
    // Pour l'instant, on n'affiche pas le graphique pour simplifier le test.
    console.log('✅ Dashboard affiché');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}