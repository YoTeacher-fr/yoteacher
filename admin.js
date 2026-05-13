// admin.js – version avec la règle demandée (uniquement cours confirmés et passés/completed_at)
console.log('🔵 [ADMIN.JS] Script chargé – règle: confirmed + (passé ou completed_at dans le mois)');

let revenueChart = null, currentMonthOffset = 0, allMonthlyRevenue = {};

// --- Carrousel prochains cours ---
let adminUpcomingLessons = [];
let adminCurrentStartIndex = 0;
const LESSONS_PER_PAGE = 3;

// --- Carrousel forfaits actifs ---
let activePackagesList = [];
let packagesCurrentStartIndex = 0;
const PACKAGES_PER_PAGE = 3;

let activePackagesData = [];

const EXCLUDED_STUDENT_IDS = [
    '88698eb2-904f-410b-88e1-a93c1397e0d1',
    'ddb62c55-b9f0-4852-8aa4-a53ea219ca83'
];

const EXTRA_COURSES = { /* ... */ };
const EXTRA_AMOUNTS = { /* ... */ };

let lessonsStudentsChart = null;
let currentLessonsMonthOffset = 0;
let allMonthlyLessons = {};

// ========== AUTH / SUPABASE (inchangé) ==========
async function waitForSupabase() { /* ... */ }
async function getToken() { /* ... */ }
async function fetchAdminDashboard() { /* ... */ }
async function cancelBookingAdmin(bookingId) { /* ... */ }
function escapeHtml(str) { /* ... */ }

// ========== PROCHAINS COURS (inchangé) ==========
function formatDateWithDay(date) { /* ... */ }
function renderUpcomingSlice() { /* ... */ }
function displayUpcoming(lessons) { /* ... */ }

// ========== FORFAITS ACTIFS (inchangé) ==========
function getStudentCredits(studentId) { /* ... */ }
function getTotalCreditsForStudent(studentId) { /* ... */ }
function getNearestExpiryForStudent(studentId) { /* ... */ }
function findFirstAvailableCombination(studentId) { /* ... */ }
function updateSelectedCreditsAndExpiry(studentId, type, duration) { /* ... */ }
function renderPackagesSlice() { /* ... */ }
function buildPackagesList() { /* ... */ }
function displayPackages(packages) { /* ... */ }

// ========== ÉTUDIANTS (inchangé) ==========
function displayStudents(students) { /* ... */ }

// ========== GRAPHIQUE REVENUS (inchangé) ==========
function updateRevenueChart() { /* ... */ }

// ========== NOUVEAU : GRAPHIQUE COURS (règle demandée) ==========
function computeMonthlyLessonsAndStudents(studentsData) {
    const monthlyMap = new Map(); // key "YYYY-MM": { lessons: 0, students: Set() }
    const now = new Date();

    for (const student of studentsData) {
        if (!student.bookings) continue;
        for (const booking of student.bookings) {
            // 1. On ignore les annulés
            if (booking.status === 'cancelled') continue;

            // 2. On ne garde que les confirmed (ou éventuellement completed)
            if (booking.status !== 'confirmed' && booking.status !== 'completed') continue;

            // 3. Vérifier si le cours est "effectué"
            const startTime = new Date(booking.start_time);
            if (isNaN(startTime.getTime())) continue;

            let isEffectue = false;

            // Condition A : date de début passée
            if (startTime < now) {
                isEffectue = true;
            }
            // Condition B : completed_at (si présent) est dans le mois
            else if (booking.completed_at) {
                const completedDate = new Date(booking.completed_at);
                if (!isNaN(completedDate.getTime())) {
                    // On compare l'année et le mois UTC
                    const completedYearMonth = booking.completed_at.substring(0, 7);
                    const startYearMonth = booking.start_time.substring(0, 7);
                    if (completedYearMonth === startYearMonth) {
                        isEffectue = true;
                    }
                }
            }

            if (!isEffectue) continue;

            // 4. Extraire le mois UTC directement depuis la chaîne start_time
            const monthKey = booking.start_time.substring(0, 7); // "2026-03"
            if (!monthlyMap.has(monthKey)) {
                monthlyMap.set(monthKey, { lessons: 0, students: new Set() });
            }
            const monthData = monthlyMap.get(monthKey);
            monthData.lessons++;
            monthData.students.add(student.id);
        }
    }

    const result = {};
    for (const [month, data] of monthlyMap.entries()) {
        result[month] = { lessons: data.lessons, students: data.students.size };
        console.log(`[DEBUG] ${month} → ${data.lessons} leçons, ${data.students.size} étudiants`);
    }
    return result;
}

function updateLessonsStudentsChart() {
    const canvas = document.getElementById('lessonsStudentsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const months = Object.keys(allMonthlyLessons).sort();
    if (months.length === 0) {
        if (lessonsStudentsChart) lessonsStudentsChart.destroy();
        canvas.style.display = 'none';
        const parent = canvas.parentElement;
        let msg = parent.querySelector('.no-data-msg');
        if (!msg) {
            msg = document.createElement('div');
            msg.className = 'no-data-msg';
            msg.innerText = 'Aucune leçon effectuée pour le moment.';
            msg.style.textAlign = 'center';
            msg.style.padding = '50px';
            parent.appendChild(msg);
        }
        const labelElem = document.getElementById('lessonsMonthRangeLabel');
        if (labelElem) labelElem.innerText = '6 derniers mois';
        return;
    }
    canvas.style.display = 'block';
    const existingMsg = canvas.parentElement.querySelector('.no-data-msg');
    if (existingMsg) existingMsg.remove();

    let startIndex = 0, endIndex = months.length - 1;
    if (currentLessonsMonthOffset === 0) {
        startIndex = Math.max(0, months.length - 6);
        endIndex = months.length - 1;
    } else {
        startIndex = Math.max(0, months.length - 12 + currentLessonsMonthOffset);
        endIndex = Math.min(months.length - 1, startIndex + 11);
        if (startIndex >= months.length) {
            startIndex = Math.max(0, months.length - 6);
            endIndex = months.length - 1;
            currentLessonsMonthOffset = 0;
        }
    }
    const visibleMonths = months.slice(startIndex, endIndex + 1);
    const labels = visibleMonths.map(m => {
        const [y, mo] = m.split('-');
        return new Date(parseInt(y), parseInt(mo)-1, 1).toLocaleDateString('fr', { month:'short', year:'numeric' });
    });
    const lessonsData = visibleMonths.map(m => allMonthlyLessons[m]?.lessons || 0);
    const studentsData = visibleMonths.map(m => allMonthlyLessons[m]?.students || 0);

    if (lessonsStudentsChart) lessonsStudentsChart.destroy();
    lessonsStudentsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Leçons effectuées', data: lessonsData, borderColor: '#3c84f6', backgroundColor: 'rgba(60,132,246,0.1)', tension: 0.3, fill: true },
                { label: 'Étudiants uniques', data: studentsData, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', tension: 0.3, fill: true }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}` } },
                legend: { position: 'top' }
            },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, title: { display: true, text: 'Nombre' } } }
        }
    });

    const labelElem = document.getElementById('lessonsMonthRangeLabel');
    if (labelElem) labelElem.innerText = currentLessonsMonthOffset === 0 ? '6 derniers mois' : `${labels[0]} - ${labels[labels.length-1]}`;
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
        const monthlyStats = computeMonthlyLessonsAndStudents(data.students);
        allMonthlyLessons = monthlyStats;
        updateLessonsStudentsChart();
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
        await loadDashboard();
        document.body.classList.add('loaded');
        document.getElementById('refreshAdminBtn')?.addEventListener('click', () => loadDashboard());
        document.getElementById('logoutAdminBtn')?.addEventListener('click', async () => {
            if (window.authManager) await window.authManager.signOut();
            window.location.href = 'index.html';
        });
        document.getElementById('monthSliderPrev')?.addEventListener('click', () => { currentMonthOffset--; updateRevenueChart(); });
        document.getElementById('monthSliderNext')?.addEventListener('click', () => { currentMonthOffset++; updateRevenueChart(); });
        document.getElementById('lessonsMonthSliderPrev')?.addEventListener('click', () => { currentLessonsMonthOffset--; updateLessonsStudentsChart(); });
        document.getElementById('lessonsMonthSliderNext')?.addEventListener('click', () => { currentLessonsMonthOffset++; updateLessonsStudentsChart(); });
        console.log('✅ [ADMIN.JS] Initialisation terminée');
    } catch (err) {
        console.error('❌ [ADMIN.JS] Erreur initialisation:', err);
        alert('Erreur initialisation: ' + err.message);
    }
});