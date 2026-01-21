// packages.js - Gestion des forfaits et crédits avec protection contre la double déduction
class PackagesManager {
    constructor() {
        this.packages = null;
        this.basePrices = null;
        this.isInitialized = false;
        this.packageValidityDays = 90;
        
        // Système de verrouillage pour éviter les opérations concurrentes
        this.userLocks = new Map();
        this.transactionRegistry = new Map(); // Registre des transactions déjà traitées
        this.processingTransactions = new Set(); // Transactions en cours
        
        console.log('📦 PackagesManager initialisé avec système de verrouillage');
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
                // CORRECTION : Requête ajustée pour correspondre au schéma
                const { data, error } = await supabase
                    .from('vip_pricing')
                    .select('course_type, price, currency')
                    .is('user_id', null)
                    .eq('duration_minutes', 60)
                    .maybeSingle();

                if (!error && data) {
                    this.basePrices = {};
                    this.basePrices[data.course_type] = data.price;
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

    // NOUVEAU : Méthode pour acquérir un verrou utilisateur
    async acquireUserLock(userId, operationType, timeoutMs = 5000) {
        const lockKey = `${userId}_${operationType}_${Date.now()}`;
        
        // Vérifier si l'utilisateur a déjà un verrou pour cette opération
        if (this.userLocks.has(userId)) {
            const existingLock = this.userLocks.get(userId);
            if (Date.now() - existingLock.timestamp < timeoutMs) {
                throw new Error(`Opération ${operationType} déjà en cours pour cet utilisateur`);
            }
        }
        
        // Créer un nouveau verrou
        const lock = {
            id: lockKey,
            userId: userId,
            operationType: operationType,
            timestamp: Date.now()
        };
        
        this.userLocks.set(userId, lock);
        console.log(`🔒 Verrou acquis: ${lockKey}`);
        
        return {
            release: () => {
                this.userLocks.delete(userId);
                console.log(`🔓 Verrou libéré: ${lockKey}`);
            },
            key: lockKey
        };
    }

    // NOUVEAU : Vérifier si une transaction a déjà été traitée
    isTransactionProcessed(transactionId) {
        return this.transactionRegistry.has(transactionId) || 
               this.processingTransactions.has(transactionId);
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

    // VERSION CORRIGÉE : Méthode sécurisée pour utiliser un crédit
    async useCredit(userId, courseType, bookingData, transactionId = null) {
        // Générer un ID de transaction unique si non fourni
        const trxId = transactionId || `use_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Vérifier si cette transaction est déjà en cours ou terminée
        if (this.isTransactionProcessed(trxId)) {
            console.log(`⏭️ Transaction déjà traitée: ${trxId}`);
            return { 
                success: false, 
                error: 'Transaction déjà traitée',
                transactionId: trxId
            };
        }
        
        // Marquer la transaction comme en cours
        this.processingTransactions.add(trxId);
        
        // Acquérir un verrou pour cet utilisateur
        let lock;
        try {
            lock = await this.acquireUserLock(userId, 'use_credit');
        } catch (lockError) {
            this.processingTransactions.delete(trxId);
            return { 
                success: false, 
                error: lockError.message,
                transactionId: trxId
            };
        }
        
        try {
            console.log(`💰 APPEL useCredit sécurisé - Transaction: ${trxId}`);
            console.log(`   User: ${userId}, Type: ${courseType}, BookingID: ${bookingData?.id}, Durée: ${bookingData?.duration || 60}`);
            
            if (!window.supabase || !userId) {
                throw new Error('Supabase ou utilisateur non disponible');
            }
            
            // VÉRIFICATION AVANCÉE : Vérifier dans la base de données si cette réservation a déjà utilisé un crédit
            if (bookingData?.id) {
                const { data: existingTransactions, error: checkError } = await supabase
                    .from('credit_transactions')
                    .select('id, transaction_type, booking_id, package_id')
                    .eq('booking_id', bookingData.id)
                    .eq('transaction_type', 'use')
                    .limit(1);
                
                if (!checkError && existingTransactions && existingTransactions.length > 0) {
                    console.log(`⚠️ Crédit déjà utilisé pour cette réservation: ${bookingData.id}`);
                    return { 
                        success: false, 
                        error: 'Crédit déjà utilisé pour cette réservation',
                        transactionId: trxId
                    };
                }
            }
            
            const duration = bookingData?.duration || 60;
            
            console.log(`💰 Recherche package pour utilisation crédit: userId=${userId}, courseType=${courseType}, durée=${duration}, transaction=${trxId}`);
            
            // RECHERCHE EXACTE: cours type + durée
            const { data: activePackages, error: findError } = await supabase
                .from('packages')
                .select('id, remaining_credits, expires_at, total_credits, purchased_at, duration_minutes, course_type')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('duration_minutes', duration)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true });

            if (findError) {
                console.error('Erreur recherche package actif:', findError);
                throw new Error('Erreur lors de la recherche de forfait actif');
            }

            if (!activePackages || activePackages.length === 0) {
                console.log(`❌ Aucun package actif trouvé pour ${courseType} (${duration}min)`);
                
                throw new Error(`Aucun forfait actif avec des crédits disponibles pour un cours de ${duration} minutes.`);
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
            
            // MISE À JOUR ATOMIQUE avec vérification de version
            const { error: updateError } = await supabase
                .from('packages')
                .update({ 
                    remaining_credits: newRemainingCredits,
                    status: newRemainingCredits === 0 ? 'depleted' : 'active'
                })
                .eq('id', activePackage.id)
                .eq('remaining_credits', activePackage.remaining_credits); // Optimistic locking

            if (updateError) {
                console.error('Erreur mise à jour crédits:', updateError);
                
                // Vérifier si le crédit a déjà été déduit
                const { data: currentPackage } = await supabase
                    .from('packages')
                    .select('remaining_credits')
                    .eq('id', activePackage.id)
                    .single();
                
                if (currentPackage && currentPackage.remaining_credits < activePackage.remaining_credits) {
                    console.log('ℹ️ Crédit déjà déduit par une autre transaction');
                    return { 
                        success: true, 
                        package_id: activePackage.id,
                        course_type: activePackage.course_type,
                        duration: activePackage.duration_minutes,
                        transactionId: trxId
                    };
                }
                
                throw updateError;
            }

            console.log('✅ Crédits mis à jour:', {
                id: activePackage.id,
                cours: activePackage.course_type,
                durée: activePackage.duration_minutes,
                credits_apres: newRemainingCredits
            });

            // Créer une transaction de crédit avec l'ID de transaction
            try {
                const transactionData = {
                    user_id: userId,
                    package_id: activePackage.id,
                    booking_id: bookingData?.id || null,
                    credits_before: activePackage.remaining_credits || 0,
                    credits_change: -1,
                    credits_after: newRemainingCredits,
                    transaction_type: 'use',
                    reason: `Réservation de cours ${courseType} (${duration}min) - Transaction: ${trxId}`,
                    transaction_reference: trxId, // Stocker la référence de transaction
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('Erreur création transaction crédit:', transactionError);
                } else {
                    console.log('✅ Transaction crédit créée:', trxId);
                }
            } catch (transactionErr) {
                console.warn('Exception création transaction crédit:', transactionErr);
            }

            // Enregistrer la transaction comme traitée
            this.transactionRegistry.set(trxId, {
                userId: userId,
                packageId: activePackage.id,
                timestamp: Date.now(),
                type: 'use'
            });
            
            return { 
                success: true, 
                package_id: activePackage.id,
                course_type: activePackage.course_type,
                duration: activePackage.duration_minutes,
                transactionId: trxId
            };
            
        } catch (error) {
            console.error('❌ Erreur utilisation crédit:', error);
            return { 
                success: false, 
                error: error.message,
                transactionId: trxId
            };
        } finally {
            // Libérer les ressources
            this.processingTransactions.delete(trxId);
            if (lock && lock.release) {
                lock.release();
            }
        }
    }

    // NOUVEAU : Méthode pour rembourser un crédit
    async refundCredit(packageId, userId, transactionId) {
        const refundTrxId = transactionId || `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (this.isTransactionProcessed(refundTrxId)) {
            return { success: false, error: 'Transaction de remboursement déjà traitée' };
        }
        
        this.processingTransactions.add(refundTrxId);
        
        try {
            console.log(`💸 Remboursement crédit - Package: ${packageId}, Transaction: ${refundTrxId}`);
            
            // Récupérer le package
            const { data: packageData, error: fetchError } = await supabase
                .from('packages')
                .select('remaining_credits, total_credits, status')
                .eq('id', packageId)
                .eq('user_id', userId)
                .single();
            
            if (fetchError) {
                throw new Error('Package non trouvé');
            }
            
            const newRemainingCredits = (packageData.remaining_credits || 0) + 1;
            const newStatus = newRemainingCredits > 0 ? 'active' : packageData.status;
            
            // Mettre à jour le package
            const { error: updateError } = await supabase
                .from('packages')
                .update({ 
                    remaining_credits: newRemainingCredits,
                    status: newStatus
                })
                .eq('id', packageId);
            
            if (updateError) {
                throw updateError;
            }
            
            // Créer une transaction de remboursement
            const transactionData = {
                user_id: userId,
                package_id: packageId,
                booking_id: null,
                credits_before: packageData.remaining_credits || 0,
                credits_change: 1,
                credits_after: newRemainingCredits,
                transaction_type: 'refund',
                reason: `Remboursement crédit - Transaction: ${refundTrxId}`,
                transaction_reference: refundTrxId,
                created_at: new Date().toISOString()
            };
            
            await supabase
                .from('credit_transactions')
                .insert(transactionData);
            
            console.log('✅ Crédit remboursé avec succès');
            
            this.transactionRegistry.set(refundTrxId, {
                userId: userId,
                packageId: packageId,
                timestamp: Date.now(),
                type: 'refund'
            });
            
            return { 
                success: true, 
                transactionId: refundTrxId,
                remaining_credits: newRemainingCredits
            };
            
        } catch (error) {
            console.error('❌ Erreur remboursement crédit:', error);
            return { success: false, error: error.message };
        } finally {
            this.processingTransactions.delete(refundTrxId);
        }
    }

    // VERSION CORRIGÉE : Ajouter des crédits avec 90 jours de validité
    async addCredits(userId, courseType, quantity, price, currency, paymentMethod, transactionId, bookingData = null) {
        const addTrxId = transactionId || `add_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Vérifier si cette transaction d'ajout est déjà traitée
        if (this.isTransactionProcessed(addTrxId)) {
            console.log(`⏭️ Transaction d'ajout déjà traitée: ${addTrxId}`);
            return { 
                success: true, 
                message: 'Crédits déjà ajoutés',
                transactionId: addTrxId
            };
        }
        
        this.processingTransactions.add(addTrxId);
        
        let lock;
        try {
            lock = await this.acquireUserLock(userId, 'add_credits');
        } catch (lockError) {
            this.processingTransactions.delete(addTrxId);
            return { 
                success: false, 
                error: lockError.message,
                transactionId: addTrxId
            };
        }
        
        try {
            console.log(`📦 Début addCredits sécurisé - Transaction: ${addTrxId}`);
            console.log(`   User: ${userId}, Type: ${courseType}, Quantité: ${quantity}, Prix: ${price} ${currency}`);
            
            if (!window.supabase || !userId) {
                throw new Error('Supabase ou utilisateur non disponible');
            }
            
            const purchasedDate = new Date();
            const expiresAt = new Date(purchasedDate);
            expiresAt.setDate(expiresAt.getDate() + this.packageValidityDays);

            let duration = 60;
            
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
            
            const validDurations = [15, 30, 45, 60];
            if (!validDurations.includes(duration)) {
                const closestDuration = validDurations.reduce((prev, curr) => {
                    return Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev;
                });
                duration = closestDuration;
                console.log(`✅ Durée ajustée à: ${duration} minutes`);
            }
            
            let discountPercent = bookingData?.discountPercent || 0;
            if (discountPercent === 0) {
                if (quantity === 5) discountPercent = 2;
                else if (quantity === 10) discountPercent = 5;
            }
            
            console.log(`💰 Données finales pour création package:`, {
                userId, courseType, quantity, price, currency, duration, discountPercent, transactionId: addTrxId
            });
            
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
                expiration_alert_sent: false,
                transaction_reference: addTrxId // Stocker la référence de transaction
            };

            console.log('📤 Tentative d\'insertion dans packages avec données:', packageData);
            
            const { data: newPackage, error: packageError } = await supabase
                .from('packages')
                .insert(packageData)
                .select()
                .single();

            if (packageError) {
                console.error('❌ ERREUR lors de l\'insertion du package:', packageError);
                
                // Vérifier si un package avec cette référence existe déjà
                const { data: existingPackage } = await supabase
                    .from('packages')
                    .select('*')
                    .eq('transaction_reference', addTrxId)
                    .single();
                
                if (existingPackage) {
                    console.log('✅ Package déjà créé avec cette transaction');
                    return { 
                        success: true, 
                        package: existingPackage,
                        course_type: courseType,
                        duration: duration,
                        transactionId: addTrxId
                    };
                }
                
                throw new Error(`Impossible de créer le package: ${packageError.message}`);
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
                    reason: `Achat forfait ${quantity} ${courseType} (${duration}min) (${discountPercent}% de réduction) - Transaction: ${addTrxId}`,
                    transaction_reference: addTrxId,
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('⚠️ Erreur création transaction crédit:', transactionError);
                } else {
                    console.log('✅ Transaction d\'achat créée:', addTrxId);
                }
            } catch (transactionErr) {
                console.warn('⚠️ Exception création transaction crédit:', transactionErr);
            }

            // CORRECTION : Ne PAS déduire immédiatement un crédit ici
            // La déduction se fera dans le flux de réservation principal
            console.log('⚠️ ATTENTION : La déduction du premier crédit se fera dans le flux de réservation principal');
            
            // Enregistrer la transaction
            this.transactionRegistry.set(addTrxId, {
                userId: userId,
                packageId: newPackage.id,
                timestamp: Date.now(),
                type: 'add'
            });
            
            return { 
                success: true, 
                package: newPackage,
                course_type: courseType,
                duration: duration,
                transactionId: addTrxId,
                message: `Forfait de ${quantity} crédits ${courseType} (${duration}min) créé avec succès`
            };
        } catch (error) {
            console.error('❌ ERREUR dans addCredits:', error);
            return { 
                success: false, 
                error: error.message,
                transactionId: addTrxId,
                details: 'Veuillez contacter le support technique'
            };
        } finally {
            this.processingTransactions.delete(addTrxId);
            if (lock && lock.release) {
                lock.release();
            }
        }
    }

    async deductCreditFromPackage(packageId, userId, courseType, duration, bookingId, transactionId = null) {
        const deductTrxId = transactionId || `deduct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (this.isTransactionProcessed(deductTrxId)) {
            return { 
                success: false, 
                error: 'Transaction de déduction déjà traitée',
                transactionId: deductTrxId
            };
        }
        
        this.processingTransactions.add(deductTrxId);
        
        try {
            console.log(`🔽 Déduction de crédit du package ${packageId} - Transaction: ${deductTrxId}`);
            
            if (!window.supabase || !packageId || !userId) {
                throw new Error('Paramètres manquants');
            }
            
            // 1. Récupérer le package spécifique
            const { data: packageData, error: fetchError } = await supabase
                .from('packages')
                .select('remaining_credits, course_type, duration_minutes')
                .eq('id', packageId)
                .eq('user_id', userId)
                .single();
            
            if (fetchError) {
                console.error('❌ Erreur récupération package:', fetchError);
                return { success: false, error: 'Package non trouvé' };
            }
            
            const currentCredits = packageData.remaining_credits || 0;
            
            if (currentCredits <= 0) {
                return { success: false, error: 'Pas de crédits disponibles dans ce package' };
            }
            
            // Vérifier que le package correspond au type de cours et durée
            if (packageData.course_type !== courseType || packageData.duration_minutes !== duration) {
                return { 
                    success: false, 
                    error: `Le package ne correspond pas au cours ${courseType} de ${duration}min` 
                };
            }
            
            const newRemainingCredits = currentCredits - 1;
            
            // 2. Mettre à jour le package avec vérification optimiste
            const { error: updateError } = await supabase
                .from('packages')
                .update({ 
                    remaining_credits: newRemainingCredits,
                    status: newRemainingCredits === 0 ? 'depleted' : 'active'
                })
                .eq('id', packageId)
                .eq('remaining_credits', currentCredits);
            
            if (updateError) {
                console.error('❌ Erreur mise à jour package:', updateError);
                
                // Vérifier si la déduction a déjà eu lieu
                const { data: currentPackage } = await supabase
                    .from('packages')
                    .select('remaining_credits')
                    .eq('id', packageId)
                    .single();
                    
                if (currentPackage && currentPackage.remaining_credits < currentCredits) {
                    console.log('ℹ️ Déduction déjà effectuée par une autre transaction');
                    return { 
                        success: true, 
                        package_id: packageId,
                        remaining_credits: currentPackage.remaining_credits,
                        transactionId: deductTrxId
                    };
                }
                
                return { success: false, error: 'Erreur lors de la déduction' };
            }
            
            console.log(`✅ Crédit déduit: ${currentCredits} → ${newRemainingCredits}`);
            
            // 3. Créer une transaction de crédit
            try {
                const transactionData = {
                    user_id: userId,
                    package_id: packageId,
                    booking_id: bookingId || null,
                    credits_before: currentCredits,
                    credits_change: -1,
                    credits_after: newRemainingCredits,
                    transaction_type: 'use',
                    reason: `Déduction automatique après achat de forfait ${courseType} (${duration}min) - Transaction: ${deductTrxId}`,
                    transaction_reference: deductTrxId,
                    created_at: new Date().toISOString()
                };

                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert(transactionData);

                if (transactionError) {
                    console.warn('⚠️ Erreur création transaction crédit:', transactionError);
                } else {
                    console.log('✅ Transaction de déduction créée:', deductTrxId);
                }
            } catch (transactionErr) {
                console.warn('⚠️ Exception création transaction crédit:', transactionErr);
            }
            
            // Enregistrer la transaction
            this.transactionRegistry.set(deductTrxId, {
                userId: userId,
                packageId: packageId,
                timestamp: Date.now(),
                type: 'deduct'
            });
            
            return { 
                success: true, 
                package_id: packageId,
                remaining_credits: newRemainingCredits,
                transactionId: deductTrxId
            };
            
        } catch (error) {
            console.error('❌ Erreur dans deductCreditFromPackage:', error);
            return { 
                success: false, 
                error: error.message,
                transactionId: deductTrxId
            };
        } finally {
            this.processingTransactions.delete(deductTrxId);
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
                console.log('🔄 Aucun package trouvé pour cet utilisateur');
            }
            
            console.groupEnd();
            
        } catch (error) {
            console.error('Erreur debug packages:', error);
        }
    }
    
    // NOUVEAU : Méthode pour nettoyer les verrous expirés
    cleanupExpiredLocks() {
        const now = Date.now();
        const timeout = 30000; // 30 secondes
        
        for (const [userId, lock] of this.userLocks.entries()) {
            if (now - lock.timestamp > timeout) {
                this.userLocks.delete(userId);
                console.log(`🧹 Verrou expiré nettoyé: ${userId}`);
            }
        }
        
        // Nettoyer aussi le registre des transactions (garder 24h)
        const dayInMs = 24 * 60 * 60 * 1000;
        for (const [trxId, data] of this.transactionRegistry.entries()) {
            if (now - data.timestamp > dayInMs) {
                this.transactionRegistry.delete(trxId);
            }
        }
    }
}

// Initialisation avec nettoyage périodique
window.packagesManager = new PackagesManager();

// Nettoyer les verrous toutes les minutes
setInterval(() => {
    if (window.packagesManager && window.packagesManager.cleanupExpiredLocks) {
        window.packagesManager.cleanupExpiredLocks();
    }
}, 60000);

document.addEventListener('DOMContentLoaded', async () => {
    if (window.packagesManager && !window.packagesManager.isInitialized) {
        await window.packagesManager.initialize();
    }
});

console.log('✅ PackagesManager chargé - Version sécurisée contre la double déduction');