// debug-credits.js - Pour détecter les doubles déductions
window.debugCredits = {
    log: [],
    
    track: function(action, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            action: action,
            details: details,
            stack: new Error().stack
        };
        
        this.log.push(entry);
        
        console.group(`🔍 ${action}`);
        console.log('Timestamp:', entry.timestamp);
        console.log('Details:', details);
        console.groupEnd();
        
        // Vérifier les doublons immédiatement
        this.checkDuplicates();
    },
    
    checkDuplicates: function() {
        // Vérifier les doubles déductions pour la même réservation
        const useCreditEntries = this.log.filter(e => e.action === 'useCredit');
        const bookingIds = useCreditEntries.map(e => e.details?.bookingId).filter(Boolean);
        
        const duplicates = {};
        bookingIds.forEach(id => {
            duplicates[id] = (duplicates[id] || 0) + 1;
        });
        
        const doubleDeductions = Object.entries(duplicates).filter(([id, count]) => count > 1);
        
        if (doubleDeductions.length > 0) {
            console.error('❌ DOUBLES DÉDUCTIONS DÉTECTÉES:');
            doubleDeductions.forEach(([id, count]) => {
                console.error(`   Booking ${id}: ${count} déductions`);
            });
        }
    },
    
    showReport: function() {
        console.group('📊 RAPPORT DEBUG CRÉDITS');
        console.log('Total entrées:', this.log.length);
        
        const actions = {};
        this.log.forEach(entry => {
            actions[entry.action] = (actions[entry.action] || 0) + 1;
        });
        
        console.log('Par action:', actions);
        
        // Afficher les 10 dernières entrées
        console.log('10 dernières entrées:');
        this.log.slice(-10).forEach((entry, i) => {
            console.log(`${i+1}. ${entry.timestamp} - ${entry.action}:`, entry.details);
        });
        
        this.checkDuplicates();
        console.groupEnd();
    },
    
    clear: function() {
        this.log = [];
        console.log('✅ Logs de debug effacés');
    }
};

// Intercepter useCredit
if (window.packagesManager && window.packagesManager.useCredit) {
    const originalUseCredit = window.packagesManager.useCredit;
    window.packagesManager.useCredit = async function(userId, courseType, bookingData) {
        window.debugCredits.track('useCredit', {
            userId: userId,
            courseType: courseType,
            bookingId: bookingData?.id,
            source: bookingData?.source || 'unknown'
        });
        
        return originalUseCredit.call(this, userId, courseType, bookingData);
    };
    console.log('✅ Debug useCredit installé');
}

console.log('✅ debug-credits.js chargé');