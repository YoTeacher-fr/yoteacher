// packages.js - Gestion des forfaits et crédits avec 90 jours de validité - VERSION CORRIGÉE (sans created_at)
class PackagesManager {
    constructor() {
        this.packages = null;
        this.basePrices = null;
        this.isInitialized = false;
        this.packageValidityDays = 90; // 90 jours de validité
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
                    console.log('✅ Prix de base chargés depuis Supabase:', this.basePrices);
                    return;
                }
            }
            
            const savedPrices = localStorage.getItem('base_course_prices');
            if (savedPrices) {
                this.basePrices = JSON.parse(savedPrices);
                console.log('✅ Prix de base chargés depuis localStorage:', this.basePrices);
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
        console.log('📋 Prix par défaut chargés:', this.basePrices);
    }

    calculatePackagePrices() {
        if (!this.basePrices) {
            console.error('❌ Impossible de calculer les prix sans prix de base');
            return;
        }

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
        
        console.log('🧮 Prix des forfaits calculés:', this.packages);
    }

    async getBasePrice(courseType, duration = 60) {
        await this.initialize();
        
        if (!this.basePrices || !this.basePrices[courseType]) {
            console.warn(`⚠️ Prix non trouvé pour ${courseType}, retour au prix par défaut`);
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
            console.warn('⚠️ Packages non initialisés, utilisation des prix par défaut');
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

    async getPackageInfo(courseType, quantity, duration = 60) {
        await this.initialize();
        
        const packageType = this.packages[courseType];
        if (!packageType) return null;

        if (quantity === 5 && packageType.package5) {
            const basePrice = await this.getBasePrice(courseType, duration);
            return {
                total_credits: packageType.package5.total_credits,
                discount_percent: packageType.package5.discount_percent,
                pricePerCourse: packageType.package5.price / quantity,
                basePricePerCourse: basePrice,
                duration: duration
            };
        } else if (quantity === 10 && packageType.package10) {
            const basePrice = await this.getBasePrice(courseType, duration);
            return {
                total_credits: packageType.package10.total_credits,
                discount_percent: packageType.package10.discount_percent,
                pricePerCourse: packageType.package10.price / quantity,
                basePricePerCourse: basePrice,
                duration: duration
            };
        }

        const basePrice = await this.getBasePrice(courseType, duration);
        return { 
            total_credits: 1, 
            discount_percent: 0, 
            pricePerCourse: this.calculatePrice(courseType, 1, duration),
            basePricePerCourse: basePrice,
            duration: duration
        };
    }

    async hasCreditForDuration(userId, courseType, duration) {
        if (!window.supabase || !userId) return false;
        
        try {
            const { data, error } = await supabase
                .from('packages')
                .select('id, remaining_credits, expires_at, course_type, duration_minutes')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('duration_minutes', duration)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .limit(1);

            if (error) {
                console.warn('Erreur vérification crédit par durée:', error);
                return false;
            }

            const hasCredit = data && data.length > 0;
            console.log(`🔍 Vérification crédit ${courseType} ${duration}min:`, hasCredit ? 'OUI' : 'NON');
            
            return hasCredit;
        } catch (error) {
            console.error('Exception vérification crédit par durée:', error);
            return false;
        }
    }

    async getUserCredits(userId) {
        if (!window.supabase || !userId) return { conversation: 0, curriculum: 0, examen: 0 };
        
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

            // Structure améliorée avec durée
            const credits = { 
                conversation: { 30: 0, 45: 0, 60: 0 },
                curriculum: { 30: 0, 45: 0, 60: 0 },
                examen: { 30: 0, 45: 0, 60: 0 }
            };
            
            packages?.forEach(pkg => {
                const type = pkg.course_type;
                const duration = pkg.duration_minutes || 60;
                const remaining = pkg.remaining_credits || 0;
                
                if (credits[type]) {
                    // Regrouper par durée standard
                    if (duration === 30) {
                        credits[type][30] += remaining;
                    } else if (duration === 45) {
                        credits[type][45] += remaining;
                    } else {
                        credits[type][60] += remaining;
                    }
                }
            });

            console.log('📊 Crédits par type et durée:', credits);
            return credits;
        } catch (error) {
            console.error('Exception crédits:', error);
            return { conversation: 0, curriculum: 0, examen: 0 };
        }
    }

    async useCredit(userId, courseType, bookingData) {
        if (!window.supabase || !userId) return { success: false, error: 'Supabase ou utilisateur non disponible' };
        
        try {
            console.log(`💰 APPEL useCredit`);
            console.log(`   User: ${userId}, Type: ${courseType}, BookingID: ${bookingData?.id}, Durée: ${bookingData?.duration || 60}`);
            
            // VÉRIFICATION CONTRE DOUBLE DÉDUCTION
            if (bookingData?.id) {
                const bookingKey = `used_credit_${bookingData.id}`;
                if (localStorage.getItem(bookingKey)) {
                    console.error(`❌ ERREUR: Cette réservation a déjà utilisé un crédit!`);
                    return { 
                        success: false, 
                        error: 'Crédit déjà utilisé pour cette réservation' 
                    };
                }
            }
            
            // Récupérer la durée depuis bookingData (par défaut 60)
            const duration = bookingData?.duration || 60;
            
            console.log(`💰 Recherche package pour utilisation crédit: userId=${userId}, courseType=${courseType}, durée=${duration}`);
            
            // RECHERCHE EXACTE: cours type + durée
            const { data: activePackages, error: findError } = await supabase
                .from('packages')
                .select('id, remaining_credits, expires_at, total_credits, purchased_at, duration_minutes, course_type')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('duration_minutes', duration)  // CORRIGÉ: durée exacte
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true }); // Utiliser d'abord ceux qui expirent bientôt

            if (findError) {
                console.error('Erreur recherche package actif:', findError);
                throw new Error('Erreur lors de la recherche de forfait actif');
            }

            if (!activePackages || activePackages.length === 0) {
                console.log(`❌ Aucun package actif trouvé pour ${courseType} (${duration}min)`);
                
                // AFFICHER TOUS LES PACKAGES DISPONIBLES POUR LE DEBUG
                const { data: allPackages } = await supabase
                    .from('packages')
                    .select('id, course_type, duration_minutes, remaining_credits, expires_at, status')
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .gt('remaining_credits', 0);
                    
                console.log(`📋 Tous les packages disponibles pour ${userId}:`, allPackages);
                
                throw new Error(`Aucun forfait actif avec des crédits disponibles pour un cours de ${duration} minutes. Veuillez choisir une durée correspondant à vos forfaits.`);
            }

            console.log(`📦 Package(s) actif(s) trouvé(s) pour ${courseType} ${duration}min:`, activePackages);
            const activePackage = activePackages[0];
            
            console.log('✅ Package sélectionné pour utilisation de crédit:', {
                id: activePackage.id,
                cours: activePackage.course_type,
                durée: activePackage.duration_minutes,
                credits_avant: activePackage.remaining_credits,
                expires_at: activePackage.expires_at,
                purchased_at: activePackage.purchased_at
            });

            const newRemainingCredits = (activePackage.remaining_credits || 0) - 1;
            const { error: updateError } = await supabase
                .from('packages')
                .update({ 
                    remaining_credits: newRemainingCredits,
                    status: newRemainingCredits === 0 ? 'depleted' : 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', activePackage.id);

            if (updateError) {
                console.error('Erreur mise à jour crédits:', updateError);
                throw updateError;
            }

            console.log('✅ Crédits mis à jour:', {
                id: activePackage.id,
                cours: activePackage.course_type,
                durée: activePackage.duration_minutes,
                credits_apres: newRemainingCredits
            });

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
                    reason: `Réservation de cours ${courseType} (${duration}min)`,
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('Erreur création transaction crédit:', transactionError);
                } else {
                    console.log('✅ Transaction crédit créée');
                }
            } catch (transactionErr) {
                console.warn('Exception création transaction crédit:', transactionErr);
            }

            // MARQUER COMME CRÉDIT UTILISÉ (protection double déduction)
            if (bookingData?.id) {
                const bookingKey = `used_credit_${bookingData.id}`;
                localStorage.setItem(bookingKey, 'true');
                console.log(`✅ Réservation ${bookingData.id} marquée comme ayant utilisé un crédit`);
            }
            
            return { 
                success: true, 
                package_id: activePackage.id,
                course_type: activePackage.course_type,
                duration: activePackage.duration_minutes
            };
            
        } catch (error) {
            console.error('❌ Erreur utilisation crédit:', error);
            return { success: false, error: error.message };
        }
    }

    // Ajouter des crédits avec 90 jours de validité - VERSION CORRIGÉE (sans created_at)
    async addCredits(userId, courseType, quantity, price, currency, paymentMethod, transactionId, bookingData = null) {
        if (!window.supabase || !userId) {
            console.error('❌ Conditions non remplies pour addCredits');
            return { success: false, error: 'Supabase ou utilisateur non disponible' };
        }
        
        try {
            console.log(`📦 Début addCredits - User: ${userId}, Type: ${courseType}, Quantité: ${quantity}, Prix: ${price} ${currency}`);
            
            // MODIFICATION : 90 jours au lieu d'1 an
            const purchasedDate = new Date();
            const expiresAt = new Date(purchasedDate);
            expiresAt.setDate(expiresAt.getDate() + this.packageValidityDays); // 90 jours

            // CORRECTION : PARSER CORRECTEMENT LA DURÉE
            let duration = 60; // valeur par défaut
            
            // Extraire la durée de différentes sources possibles
            if (bookingData) {
                let rawDuration = bookingData.duration || bookingData.duration_minutes;
                
                if (rawDuration) {
                    const parsedDuration = parseInt(rawDuration);
                    if (!isNaN(parsedDuration) && parsedDuration > 0) {
                        duration = parsedDuration;
                        console.log(`✅ Durée extraite de bookingData: ${duration} minutes`);
                    }
                }
            } else if (courseType === 'essai') {
                duration = 15;
            }
            
            // VÉRIFICATION DE SÉCURITÉ : s'assurer que la durée est valide
            const validDurations = [15, 30, 45, 60];
            if (!validDurations.includes(duration)) {
                const closestDuration = validDurations.reduce((prev, curr) => {
                    return Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev;
                });
                duration = closestDuration;
                console.log(`✅ Durée ajustée à: ${duration} minutes`);
            }
            
            // Récupérer le pourcentage de réduction
            let discountPercent = bookingData?.discountPercent || 0;
            if (discountPercent === 0) {
                if (quantity === 5) discountPercent = 2;
                else if (quantity === 10) discountPercent = 5;
            }
            
            console.log(`💰 Données finales pour création package:`, {
                userId, courseType, quantity, price, currency, duration, discountPercent
            });
            
            // STRUCTURE CORRECTE POUR LA TABLE packages - SANS created_at
            const packageData = {
                user_id: userId,
                course_type: courseType,
                duration_minutes: duration,
                total_credits: quantity,
                remaining_credits: quantity,
                price_paid: price,
                discount_percent: discountPercent,
                currency: currency,
                status: 'active',
                purchased_at: purchasedDate.toISOString(),
                expires_at: expiresAt.toISOString(),
                expiration_alert_sent: false
                // NOTE: Ne pas inclure created_at ou updated_at si la table ne les a pas
            };

            console.log('📤 Tentative d\'insertion dans packages avec données:', packageData);
            
            const { data: newPackage, error: packageError } = await supabase
                .from('packages')
                .insert(packageData)
                .select()
                .single();

            if (packageError) {
                console.error('❌ ERREUR lors de l\'insertion du package:', packageError);
                console.error('❌ Détails de l\'erreur:', packageError);
                
                // Tentative alternative avec moins de champs
                console.log('🔄 Tentative alternative avec structure minimale...');
                const minimalPackageData = {
                    user_id: userId,
                    course_type: courseType,
                    duration_minutes: duration,
                    total_credits: quantity,
                    remaining_credits: quantity,
                    price_paid: price,
                    currency: currency,
                    status: 'active',
                    purchased_at: purchasedDate.toISOString(),
                    expires_at: expiresAt.toISOString()
                };
                
                const { data: minimalPackage, error: minimalError } = await supabase
                    .from('packages')
                    .insert(minimalPackageData)
                    .select()
                    .single();
                    
                if (minimalError) {
                    console.error('❌ Échec même avec structure minimale:', minimalError);
                    throw new Error(`Impossible de créer le package: ${minimalError.message}`);
                }
                
                console.log('✅ Package créé avec structure minimale:', minimalPackage);
                return { 
                    success: true, 
                    package: minimalPackage,
                    course_type: courseType,
                    duration: duration
                };
            }

            console.log('✅ NOUVEAU PACKAGE CRÉÉ AVEC SUCCÈS:', {
                id: newPackage.id,
                user_id: newPackage.user_id,
                course_type: newPackage.course_type,
                duration_minutes: newPackage.duration_minutes,
                total_credits: newPackage.total_credits,
                remaining_credits: newPackage.remaining_credits,
                discount_percent: newPackage.discount_percent,
                purchased_at: newPackage.purchased_at,
                expires_at: newPackage.expires_at,
                prix_total: newPackage.price_paid,
                devise: newPackage.currency
            });

            // Créer une transaction de crédit
            try {
                const transactionData = {
                    user_id: userId,
                    package_id: newPackage.id,
                    booking_id: bookingData?.id || null,
                    credits_before: 0,
                    credits_change: quantity,
                    credits_after: quantity,
                    transaction_type: 'purchase',
                    reason: `Achat forfait ${quantity} ${courseType} (${duration}min) (${discountPercent}% de réduction)`,
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('⚠️ Erreur création transaction crédit:', transactionError);
                } else {
                    console.log('✅ Transaction d\'achat créée');
                }
            } catch (transactionErr) {
                console.warn('⚠️ Exception création transaction crédit:', transactionErr);
            }

            return { 
                success: true, 
                package: newPackage,
                course_type: courseType,
                duration: duration,
                message: `Forfait de ${quantity} crédits ${courseType} (${duration}min) créé avec succès`
            };
        } catch (error) {
            console.error('❌ ERREUR dans addCredits:', error);
            return { 
                success: false, 
                error: error.message,
                details: 'Veuillez contacter le support technique'
            };
        }
    }

    async getUserActivePackages(userId) {
        if (!window.supabase || !userId) {
            console.warn('⚠️ Supabase non disponible pour getUserActivePackages');
            return [];
        }
        
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

            console.log(`📦 Packages actifs pour ${userId}:`, packages?.length || 0);
            return packages || [];
        } catch (error) {
            console.error('Exception packages actifs:', error);
            return [];
        }
    }

    async getUserPackagesByType(userId) {
        if (!window.supabase || !userId) {
            console.warn('⚠️ Supabase non disponible pour getUserPackagesByType');
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
            
            console.log('📊 Packages organisés par type et durée:', packagesByType);
            return packagesByType;
        } catch (error) {
            console.error('Erreur organisation packages par type:', error);
            return {
                conversation: { 30: 0, 45: 0, 60: 0, expiry: null },
                curriculum: { 30: 0, 45: 0, 60: 0, expiry: null },
                examen: { 30: 0, 45: 0, 60: 0, expiry: null }
            };
        }
    }

    formatPackageDisplay(courseType, quantity, duration = 60, currency = 'EUR') {
        const price = this.calculatePrice(courseType, quantity, duration);
        
        let display = `Forfait ${quantity} cours de ${duration}min`;
        
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

    getPackageDisplayInfo(courseType, duration = 60) {
        const packageInfo = this.packages[courseType];
        if (!packageInfo) return null;
        
        const info = {
            single: {
                price: this.calculatePrice(courseType, 1, duration),
                duration: duration
            }
        };
        
        if (packageInfo.package5) {
            const basePrice = this.calculatePrice(courseType, 1, duration);
            info.package5 = {
                price: packageInfo.package5.price * (duration / 60),
                discount_percent: packageInfo.package5.discount_percent,
                total_credits: packageInfo.package5.total_credits,
                pricePerCourse: (packageInfo.package5.price * (duration / 60)) / packageInfo.package5.total_credits,
                savings: (basePrice * 5) - (packageInfo.package5.price * (duration / 60)),
                duration: duration
            };
        }
        
        if (packageInfo.package10) {
            const basePrice = this.calculatePrice(courseType, 1, duration);
            info.package10 = {
                price: packageInfo.package10.price * (duration / 60),
                discount_percent: packageInfo.package10.discount_percent,
                total_credits: packageInfo.package10.total_credits,
                pricePerCourse: (packageInfo.package10.price * (duration / 60)) / packageInfo.package10.total_credits,
                savings: (basePrice * 10) - (packageInfo.package10.price * (duration / 60)),
                duration: duration
            };
        }
        
        return info;
    }

    isPackageQuantity(quantity) {
        return quantity === 5 || quantity === 10;
    }
    
    calculateSavings(courseType, quantity, duration = 60) {
        if (quantity === 1) return 0;
        
        const singlePrice = this.calculatePrice(courseType, 1, duration);
        const packagePrice = this.calculatePrice(courseType, quantity, duration);
        
        return (singlePrice * quantity) - packagePrice;
    }
    
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
        if (!expiresAt) return null;
        
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        
        if (expiryDate < now) return 0;
        
        const timeDiff = expiryDate.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    
    isPackageExpiringSoon(expiresAt, thresholdDays = 7) {
        const daysRemaining = this.calculateDaysRemaining(expiresAt);
        return daysRemaining > 0 && daysRemaining <= thresholdDays;
    }
    
    async debugUserPackages(userId) {
        if (!window.supabase || !userId) {
            console.error('❌ Supabase non disponible pour debugUserPackages');
            return;
        }
        
        try {
            console.group('🔍 DEBUG PACKAGES UTILISATEUR');
            
            const { data: packages, error } = await supabase
                .from('packages')
                .select('*')
                .eq('user_id', userId)
                .order('purchased_at', { ascending: false });
                
            if (error) {
                console.error('Erreur récupération packages:', error);
                console.groupEnd();
                return;
            }
            
            console.log(`📦 Total packages: ${packages?.length || 0}`);
            
            if (packages && packages.length > 0) {
                packages.forEach((pkg, index) => {
                    console.log(`--- Package ${index + 1} ---`);
                    console.log(`ID: ${pkg.id}`);
                    console.log(`Type: ${pkg.course_type}`);
                    console.log(`Durée: ${pkg.duration_minutes}min`);
                    console.log(`Crédits totaux: ${pkg.total_credits}`);
                    console.log(`Crédits restants: ${pkg.remaining_credits}`);
                    console.log(`Statut: ${pkg.status}`);
                    console.log(`Acheté: ${pkg.purchased_at}`);
                    console.log(`Expire: ${pkg.expires_at}`);
                    console.log(`Jours restants: ${this.calculateDaysRemaining(pkg.expires_at)}`);
                    console.log(`Prix payé: ${pkg.price_paid} ${pkg.currency}`);
                    console.log(`Réduction: ${pkg.discount_percent || 0}%`);
                    console.log('');
                });
            } else {
                console.log('ℹ️ Aucun package trouvé pour cet utilisateur');
            }
            
            console.groupEnd();
            
        } catch (error) {
            console.error('Erreur debug packages:', error);
        }
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

console.log('✅ PackagesManager chargé - Version CORRIGÉE (sans created_at)');