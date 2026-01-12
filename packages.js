// packages.js - Gestion des forfaits et crédits - VERSION CORRIGÉE
class PackagesManager {
    constructor() {
        this.packages = null;
        this.basePrices = null;
        this.isInitialized = false;
        this.creditUsageTracking = {}; // Pour suivre les crédits utilisés
        console.log('📦 PackagesManager initialisé');
    }

    async initialize() {
        if (this.isInitialized) return true;
        
        try {
            await this.loadBasePrices();
            this.calculatePackagePrices();
            this.isInitialized = true;
            console.log('✅ PackagesManager initialisé avec succès');
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation PackagesManager:', error);
            this.loadDefaultPrices();
            this.calculatePackagePrices();
            this.isInitialized = true;
            return false;
        }
    }

    async loadBasePrices() {
        try {
            if (window.supabase) {
                const { data, error } = await supabase
                    .from('vip_pricing')
                    .select('course_type, duration_minutes, price, currency')
                    .is('user_id', null)
                    .eq('duration_minutes', 60)
                    .eq('currency', 'USD');

                if (data && data.length > 0) {
                    this.basePrices = {};
                    data.forEach(price => {
                        if (!this.basePrices[price.course_type]) {
                            this.basePrices[price.course_type] = price.price;
                        }
                    });
                    console.log('✅ Prix de base chargés depuis Supabase');
                    return;
                }
            }
            
            const savedPrices = localStorage.getItem('base_course_prices');
            if (savedPrices) {
                this.basePrices = JSON.parse(savedPrices);
                console.log('✅ Prix de base chargés depuis localStorage');
            } else {
                throw new Error('Aucun prix de base trouvé');
            }
        } catch (error) {
            console.warn('⚠️ Impossible de charger les prix:', error);
            throw error;
        }
    }

    loadDefaultPrices() {
        this.basePrices = {
            'conversation': 20,
            'curriculum': 35,
            'examen': 30,
            'essai': 5
        };
        console.log('📋 Prix par défaut chargés');
    }

    calculatePackagePrices() {
        if (!this.basePrices) return;

        this.packages = {};
        
        for (const [courseType, basePrice] of Object.entries(this.basePrices)) {
            this.packages[courseType] = {
                single: { 
                    price: basePrice, 
                    duration: courseType === 'essai' ? 15 : 60 
                }
            };

            if (courseType !== 'essai') {
                const package5Price = basePrice * 5 * 0.98;
                this.packages[courseType].package5 = {
                    price: package5Price,
                    discount_percent: 2,
                    total_credits: 5
                };

                const package10Price = basePrice * 10 * 0.95;
                this.packages[courseType].package10 = {
                    price: package10Price,
                    discount_percent: 5,
                    total_credits: 10
                };
            }
        }
        
        console.log('🧮 Prix des forfaits calculés');
    }

    async getBasePrice(courseType, duration = 60) {
        await this.initialize();
        
        if (!this.basePrices || !this.basePrices[courseType]) {
            const defaultPrices = {
                'conversation': 20,
                'curriculum': 35,
                'examen': 30,
                'essai': 5
            };
            return defaultPrices[courseType] || 20;
        }

        let basePrice = this.basePrices[courseType];
        
        if (courseType !== 'essai' && duration !== 60) {
            basePrice = basePrice * (duration / 60);
        }
        
        return basePrice;
    }

    calculatePrice(courseType, quantity = 1, duration = 60) {
        if (!this.packages) {
            this.loadDefaultPrices();
            this.calculatePackagePrices();
        }

        const packageType = this.packages[courseType];
        if (!packageType) return 0;

        if (quantity === 1) {
            let basePrice = packageType.single.price;
            if (courseType !== 'essai' && duration !== 60) {
                basePrice = basePrice * (duration / 60);
            }
            return basePrice;
        } else if (quantity === 5 && packageType.package5) {
            return packageType.package5.price;
        } else if (quantity === 10 && packageType.package10) {
            return packageType.package10.price;
        }
        
        return packageType.single.price * quantity;
    }

    async getPackageInfo(courseType, quantity) {
        await this.initialize();
        
        const packageType = this.packages[courseType];
        if (!packageType) return null;

        if (quantity === 5 && packageType.package5) {
            const basePrice = await this.getBasePrice(courseType);
            return {
                total_credits: packageType.package5.total_credits,
                discount_percent: packageType.package5.discount_percent,
                pricePerCourse: packageType.package5.price / quantity,
                basePricePerCourse: basePrice
            };
        } else if (quantity === 10 && packageType.package10) {
            const basePrice = await this.getBasePrice(courseType);
            return {
                total_credits: packageType.package10.total_credits,
                discount_percent: packageType.package10.discount_percent,
                pricePerCourse: packageType.package10.price / quantity,
                basePricePerCourse: basePrice
            };
        }

        const basePrice = await this.getBasePrice(courseType);
        return { 
            total_credits: 1, 
            discount_percent: 0, 
            pricePerCourse: this.calculatePrice(courseType, 1, 60),
            basePricePerCourse: basePrice
        };
    }

    async getUserCredits(userId) {
        if (!window.supabase || !userId) return { conversation: 0, curriculum: 0, examen: 0 };
        
        try {
            const { data: packages, error } = await supabase
                .from('packages')
                .select('course_type, remaining_credits, expires_at')
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

    async useCredit(userId, courseType, bookingData) {
        console.group(`💰 APPEL useCredit - PROTECTION DOUBLE DÉDUCTION`);
        console.log(`User: ${userId}, Course: ${courseType}, Booking:`, bookingData);
        
        // TRACKING LOCAL pour éviter double déduction
        const trackingKey = `credit_${userId}_${courseType}_${bookingData?.id || 'temp'}`;
        
        // Vérifier si cette transaction est déjà en cours
        if (this.creditUsageTracking[trackingKey]) {
            console.error(`❌ DOUBLE DÉDUCTION BLOQUÉE: Transaction déjà en cours pour cette clé`);
            console.groupEnd();
            return { 
                success: false, 
                error: 'Transaction déjà en cours',
                alreadyUsed: true 
            };
        }
        
        // Marquer comme en cours
        this.creditUsageTracking[trackingKey] = true;
        
        if (!window.supabase || !userId) {
            console.error('❌ Supabase ou utilisateur non disponible');
            delete this.creditUsageTracking[trackingKey];
            console.groupEnd();
            return { success: false, error: 'Supabase ou utilisateur non disponible' };
        }
        
        try {
            // VÉRIFICATION DANS localStorage
            if (bookingData?.id) {
                const bookingKey = `used_credit_${bookingData.id}`;
                if (localStorage.getItem(bookingKey)) {
                    console.error(`❌ BLOQUÉ: Crédit déjà utilisé pour booking ${bookingData.id}`);
                    delete this.creditUsageTracking[trackingKey];
                    console.groupEnd();
                    return { 
                        success: false, 
                        error: 'Crédit déjà utilisé pour cette réservation',
                        alreadyUsed: true 
                    };
                }
            }
            
            console.log(`🔍 Recherche package pour ${courseType}...`);
            
            const { data: activePackages, error: findError } = await supabase
                .from('packages')
                .select('id, remaining_credits, expires_at, total_credits, purchased_at')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true });

            if (findError) {
                console.error('Erreur recherche package:', findError);
                throw new Error('Erreur lors de la recherche de forfait actif');
            }

            if (!activePackages || activePackages.length === 0) {
                console.log(`❌ Aucun package actif pour ${courseType}`);
                throw new Error('Aucun forfait actif avec des crédits disponibles');
            }

            const activePackage = activePackages[0];
            console.log('✅ Package sélectionné:', activePackage.id);
            
            const newRemainingCredits = (activePackage.remaining_credits || 0) - 1;
            const { error: updateError } = await supabase
                .from('packages')
                .update({ 
                    remaining_credits: newRemainingCredits,
                    status: newRemainingCredits === 0 ? 'depleted' : 'active'
                })
                .eq('id', activePackage.id);

            if (updateError) {
                console.error('Erreur mise à jour crédits:', updateError);
                throw updateError;
            }

            console.log('✅ Crédits mis à jour:', newRemainingCredits);

            // Créer une transaction de crédit
            try {
                const transactionData = {
                    user_id: userId,
                    package_id: activePackage.id,
                    booking_id: bookingData?.id || null,
                    credits_before: activePackage.remaining_credits || 0,
                    credits_change: -1,
                    credits_after: newRemainingCredits,
                    transaction_type: 'use',
                    reason: `Réservation de cours ${courseType}`,
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('⚠️ Erreur création transaction:', transactionError);
                } else {
                    console.log('✅ Transaction crédit créée');
                }
            } catch (transactionErr) {
                console.warn('⚠️ Exception création transaction:', transactionErr);
            }

            // MARQUER COMME UTILISÉ
            if (bookingData?.id) {
                const bookingKey = `used_credit_${bookingData.id}`;
                localStorage.setItem(bookingKey, 'true');
                console.log(`✅ Marqué booking ${bookingData.id} comme crédit utilisé`);
            }
            
            // Nettoyer le tracking
            delete this.creditUsageTracking[trackingKey];
            
            console.log('✅ useCredit terminé avec succès');
            console.groupEnd();
            
            return { success: true, package_id: activePackage.id };
            
        } catch (error) {
            console.error('❌ Erreur utilisation crédit:', error);
            // Nettoyer le tracking en cas d'erreur
            delete this.creditUsageTracking[trackingKey];
            console.groupEnd();
            return { success: false, error: error.message };
        }
    }

    async addCredits(userId, courseType, quantity, price, currency, paymentMethod, transactionId, bookingData = null) {
        if (!window.supabase || !userId) return { success: false, error: 'Supabase ou utilisateur non disponible' };
        
        try {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const packageInfo = await this.getPackageInfo(courseType, quantity);
            if (!packageInfo) {
                throw new Error('Type de forfait non valide');
            }

            console.group(`📦 AJOUT CRÉDITS ${quantity} ${courseType}`);
            
            const packageData = {
                user_id: userId,
                course_type: courseType,
                duration_minutes: courseType === 'essai' ? 15 : 60,
                total_credits: packageInfo.total_credits,
                remaining_credits: packageInfo.total_credits,
                price_paid: price,
                discount_percent: packageInfo.discount_percent || 0,
                currency: currency,
                status: 'active',
                purchased_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
                expiration_alert_sent: false
            };

            console.log('📤 Insertion package:', packageData);
            
            const { data: newPackage, error: packageError } = await supabase
                .from('packages')
                .insert(packageData)
                .select()
                .single();

            if (packageError) {
                console.error('❌ Erreur création package:', packageError);
                throw packageError;
            }

            console.log('✅ Nouveau package créé:', newPackage.id);

            // Créer une transaction
            try {
                const transactionData = {
                    user_id: userId,
                    package_id: newPackage.id,
                    booking_id: bookingData?.id || null,
                    credits_before: 0,
                    credits_change: packageInfo.total_credits,
                    credits_after: packageInfo.total_credits,
                    transaction_type: 'purchase',
                    reason: `Achat forfait ${quantity} ${courseType} (${packageInfo.discount_percent || 0}% de réduction)`,
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('⚠️ Erreur transaction:', transactionError);
                } else {
                    console.log('✅ Transaction d\'achat créée');
                }
            } catch (transactionErr) {
                console.warn('⚠️ Exception transaction:', transactionErr);
            }

            console.log(`✅ ${quantity} crédits ajoutés pour ${courseType}`);
            console.groupEnd();
            
            return { success: true, package: newPackage };
        } catch (error) {
            console.error('❌ Erreur ajout crédits:', error);
            return { success: false, error: error.message };
        }
    }

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

    formatPackageDisplay(courseType, quantity, currency = 'EUR') {
        const price = this.calculatePrice(courseType, quantity);
        
        let display = `Forfait ${quantity} cours`;
        
        if (quantity > 1) {
            const packageInfo = this.packages[courseType];
            if (quantity === 5 && packageInfo?.package5?.discount_percent) {
                display += ` (${packageInfo.package5.discount_percent}% de réduction)`;
            } else if (quantity === 10 && packageInfo?.package10?.discount_percent) {
                display += ` (${packageInfo.package10.discount_percent}% de réduction)`;
            }
        }
        
        if (window.currencyManager) {
            display += ` - ${window.currencyManager.formatPrice(price)}`;
        } else {
            display += ` - ${price} ${currency}`;
        }
        
        if (quantity > 1) {
            const pricePerCourse = price / quantity;
            if (window.currencyManager) {
                display += ` (${window.currencyManager.formatPrice(pricePerCourse)}/cours)`;
            } else {
                display += ` (${pricePerCourse.toFixed(2)} ${currency}/cours)`;
            }
        }
        
        return display;
    }
}

// Initialisation
window.packagesManager = new PackagesManager();

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    if (window.packagesManager && !window.packagesManager.isInitialized) {
        await window.packagesManager.initialize();
    }
});

console.log('✅ PackagesManager chargé - Version corrigée avec protection double déduction');