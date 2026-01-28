// packages.js - VERSION DB-DRIVEN (Logique métier dans Supabase)
// ✅ Calcul prix : SUPPRIMÉ → géré par create_booking_intent()
// ✅ Utilisation crédit : DÉLÉGUÉE → create_booking_with_credit()
// ✅ Ajout crédits : DÉLÉGUÉE → create_package_from_payment()
// ✅ Remboursement : DÉLÉGUÉ → trigger refund_credit_on_cancellation

class PackagesManager {
    constructor() {
        this.isInitialized = false;
        this.packageValidityDays = 90; // 90 jours (géré par triggers)
        console.log('📦 PackagesManager initialisé (version DB-driven)');
    }

    async initialize() {
        if (this.isInitialized) return true;
        
        this.isInitialized = true;
        console.log('✅ PackagesManager initialisé (mode lecture seule)');
        return true;
    }

    // ============================================================================
    // VÉRIFICATION CRÉDIT PAR DURÉE (lecture seule - pas de calcul)
    // ============================================================================
    async hasCreditForDuration(userId, courseType, duration) {
        if (!window.supabase || !userId) return false;
        
        try {
            const { data, error } = await supabase
                .from('packages')
                .select('id, remaining_credits, expires_at')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('duration_minutes', duration)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .limit(1);

            if (error) {
                console.warn('Erreur vérification crédit:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('Exception vérification crédit:', error);
            return false;
        }
    }

    // ============================================================================
    // RÉCUPÉRATION CRÉDITS (lecture seule)
    // ============================================================================
    async getUserCredits(userId) {
        if (!window.supabase || !userId) {
            return { conversation: 0, curriculum: 0, examen: 0 };
        }
        
        try {
            const { data: packages, error } = await supabase
                .from('packages')
                .select('course_type, remaining_credits, expires_at, duration_minutes')
                .eq('user_id', userId)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString());

            if (error) {
                console.warn('Erreur récupération crédits:', error);
                return { conversation: 0, curriculum: 0, examen: 0 };
            }

            const credits = { conversation: 0, curriculum: 0, examen: 0 };
            
            packages?.forEach(pkg => {
                if (credits[pkg.course_type] !== undefined) {
                    credits[pkg.course_type] += pkg.remaining_credits || 0;
                }
            });

            return credits;
        } catch (error) {
            console.error('Exception crédits:', error);
            return { conversation: 0, curriculum: 0, examen: 0 };
        }
    }

   

    // ============================================================================
    // AJOUT CRÉDITS - APPELLE create_package_from_payment()
    // ============================================================================
    async addCredits(userId, courseType, quantity, price, currency, paymentMethod, transactionId, bookingData = null) {
        if (!window.supabase || !userId) {
            return { success: false, error: 'Supabase ou utilisateur non disponible' };
        }
        
        try {
            console.log('📦 Ajout crédits via RPC create_package_from_payment');
            console.log('   User:', userId);
            console.log('   Type:', courseType);
            console.log('   Quantité:', quantity);
            console.log('   Prix:', price, currency);
            console.log('   Méthode:', paymentMethod);
            
            const duration = courseType === 'essai' ? 15 : 60;
            
            // ✅ APPEL RPC : create_package_from_payment()
            // Les triggers set_package_expiration et autres se déclencheront automatiquement
            const { data, error } = await supabase.rpc('create_package_from_payment', {
                p_user_id: userId,
                p_course_type: courseType,
                p_duration: duration,
                p_quantity: quantity,
                p_price_paid: price,
                p_currency: currency,
                p_stripe_payment_id: transactionId,
                p_booking_id: bookingData?.id || null
            });
            
            if (error) {
                console.error('❌ Erreur RPC create_package_from_payment:', error);
                throw new Error('Erreur création package: ' + error.message);
            }
            
            if (!data || !data.success) {
                throw new Error(data?.error || 'Échec création package');
            }
            
            console.log('✅ Package créé avec succès via RPC');
            console.log('   Package ID:', data.package_id);
            console.log('   Crédits totaux:', data.total_credits);
            console.log('   Crédits restants:', data.remaining_credits);
            console.log('   Expire le:', data.expires_at);
            
            return { 
                success: true, 
                package: {
                    id: data.package_id,
                    total_credits: data.total_credits,
                    remaining_credits: data.remaining_credits,
                    expires_at: data.expires_at
                }
            };
            
        } catch (error) {
            console.error('❌ Erreur ajout crédits:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // REMBOURSEMENT CRÉDIT - Délégué au trigger refund_credit_on_cancellation
    // ============================================================================
    async refundCredit(packageId, userId, bookingId) {
        // ✅ CETTE FONCTION N'EST PLUS NÉCESSAIRE
        // Le trigger refund_credit_on_cancellation() fait tout automatiquement
        // quand le statut passe à 'cancelled'
        
        console.log('ℹ️ refundCredit() appelé mais DÉLÉGUÉ au trigger DB');
        console.log('   Le trigger refund_credit_on_cancellation se charge du remboursement');
        
        return { 
            success: true, 
            message: 'Remboursement géré automatiquement par trigger DB' 
        };
    }

    // ============================================================================
    // RÉCUPÉRATION PACKAGES ACTIFS (lecture seule)
    // ============================================================================
    async getUserActivePackages(userId) {
        if (!window.supabase || !userId) return [];
        
        try {
            const { data: packages, error } = await supabase
                .from('packages')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true });

            if (error) {
                console.warn('Erreur récupération packages actifs:', error);
                return [];
            }

            return packages || [];
        } catch (error) {
            console.error('Exception packages actifs:', error);
            return [];
        }
    }

    // ============================================================================
    // ORGANISATION PACKAGES PAR TYPE (lecture seule)
    // ============================================================================
    async getUserPackagesByType(userId) {
        if (!window.supabase || !userId) {
            return {
                conversation: { 30: 0, 45: 0, 60: 0, expiry: null },
                curriculum: { 30: 0, 45: 0, 60: 0, expiry: null },
                examen: { 30: 0, 45: 0, 60: 0, expiry: null }
            };
        }
        
        try {
            const packages = await this.getUserActivePackages(userId);
            
            const packagesByType = {
                conversation: { 30: 0, 45: 0, 60: 0, expiry: null },
                curriculum: { 30: 0, 45: 0, 60: 0, expiry: null },
                examen: { 30: 0, 45: 0, 60: 0, expiry: null }
            };
            
            packages.forEach(pkg => {
                const type = pkg.course_type;
                const duration = pkg.duration_minutes || 60;
                const remainingCredits = pkg.remaining_credits || 0;
                
                if (packagesByType[type]) {
                    if (duration === 30) {
                        packagesByType[type][30] += remainingCredits;
                    } else if (duration === 45) {
                        packagesByType[type][45] += remainingCredits;
                    } else {
                        packagesByType[type][60] += remainingCredits;
                    }
                    
                    const expiryDate = new Date(pkg.expires_at);
                    if (!packagesByType[type].expiry || expiryDate < new Date(packagesByType[type].expiry)) {
                        packagesByType[type].expiry = pkg.expires_at;
                    }
                }
            });
            
            return packagesByType;
        } catch (error) {
            console.error('Erreur organisation packages:', error);
            return {
                conversation: { 30: 0, 45: 0, 60: 0, expiry: null },
                curriculum: { 30: 0, 45: 0, 60: 0, expiry: null },
                examen: { 30: 0, 45: 0, 60: 0, expiry: null }
            };
        }
    }

    // ============================================================================
    // UTILITAIRES (conservés - lecture seule)
    // ============================================================================
    
    async getDashboardPackagesData(userId) {
        try {
            const packagesByType = await this.getUserPackagesByType(userId);
            
            return {
                conversation: packagesByType.conversation,
                curriculum: packagesByType.curriculum,
                examen: packagesByType.examen
            };
        } catch (error) {
            console.error('Erreur préparation données dashboard:', error);
            return {
                conversation: { 30: 0, 45: 0, 60: 0, expiry: null },
                curriculum: { 30: 0, 45: 0, 60: 0, expiry: null },
                examen: { 30: 0, 45: 0, 60: 0, expiry: null }
            };
        }
    }
    
    calculateDaysRemaining(expiresAt) {
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const timeDiff = expiryDate.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    
    isPackageExpiringSoon(expiresAt, thresholdDays = 7) {
        const daysRemaining = this.calculateDaysRemaining(expiresAt);
        return daysRemaining > 0 && daysRemaining <= thresholdDays;
    }

    // ============================================================================
    // FONCTIONS HÉRITÉES VIDES (pour compatibilité)
    // ============================================================================
    
    async loadBasePrices() {
        console.log('ℹ️ loadBasePrices() est obsolète (prix calculés par RPC)');
        return true;
    }
    
    loadDefaultPrices() {
        console.log('ℹ️ loadDefaultPrices() est obsolète (prix calculés par RPC)');
    }
    
    calculatePackagePrices() {
        console.log('ℹ️ calculatePackagePrices() est obsolète (prix calculés par RPC)');
    }
    
    async getBasePrice(courseType, duration = 60) {
        console.warn('⚠️ getBasePrice() est obsolète - utiliser create_booking_intent() à la place');
        return 0;
    }
    
    calculatePrice(courseType, quantity = 1, duration = 60) {
        console.warn('⚠️ calculatePrice() est obsolète - utiliser create_booking_intent() à la place');
        return 0;
    }
    
    async getPackageInfo(courseType, quantity) {
        console.warn('⚠️ getPackageInfo() est obsolète - utiliser create_booking_intent() à la place');
        return null;
    }
    
    formatPackageDisplay(courseType, quantity, currency = 'EUR') {
        console.warn('⚠️ formatPackageDisplay() est obsolète - afficher prix depuis RPC');
        return 'Prix non disponible';
    }
    
    getPackageDisplayInfo(courseType) {
        console.warn('⚠️ getPackageDisplayInfo() est obsolète - utiliser create_booking_intent() à la place');
        return null;
    }
    
    isPackageQuantity(quantity) {
        return quantity === 5 || quantity === 10;
    }
    
    calculateSavings(courseType, quantity) {
        console.warn('⚠️ calculateSavings() est obsolète - utiliser create_booking_intent() à la place');
        return 0;
    }
}

// ============================================================================
// INITIALISATION
// ============================================================================
window.packagesManager = new PackagesManager();

document.addEventListener('DOMContentLoaded', async () => {
    if (window.packagesManager && !window.packagesManager.isInitialized) {
        await window.packagesManager.initialize();
    }
});

console.log('✅ PackagesManager chargé - Version DB-driven (calculs supprimés, appels RPC uniquement)');