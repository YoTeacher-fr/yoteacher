// packages.js - Gestion des forfaits et crédits avec votre schéma Supabase - LOGIQUE RÉDUCTION CORRECTE

class PackagesManager {
    constructor() {
        this.packages = {
            'conversation': {
                single: { price: 20, duration: 60 },
                package5: { price: 98, discount_percent: 2, total_credits: 5 },
                package10: { price: 190, discount_percent: 5, total_credits: 10 }
            },
            'curriculum': {
                single: { price: 35, duration: 60 },
                package5: { price: 171.50, discount_percent: 2, total_credits: 5 },
                package10: { price: 332.50, discount_percent: 5, total_credits: 10 }
            },
            'examen': {
                single: { price: 30, duration: 60 },
                package5: { price: 147, discount_percent: 2, total_credits: 5 },
                package10: { price: 285, discount_percent: 5, total_credits: 10 }
            },
            'essai': {
                single: { price: 5, duration: 15 }
            }
        };
        
        console.log('📦 PackagesManager initialisé avec réductions: 5 cours (-2%), 10 cours (-5%)');
    }

    calculatePrice(courseType, quantity = 1, duration = 60) {
        const packageType = this.packages[courseType];
        if (!packageType) return 0;

        if (quantity === 1) {
            // Cours unique - ajuster selon la durée
            let basePrice = packageType.single.price;
            if (courseType === 'conversation') {
                if (duration === 30) basePrice = 10;
                else if (duration === 45) basePrice = 15;
            } else if (courseType === 'curriculum') {
                if (duration === 30) basePrice = 17.5;
                else if (duration === 45) basePrice = 26.25;
            } else if (courseType === 'examen') {
                if (duration === 30) basePrice = 15;
                else if (duration === 45) basePrice = 22.5;
            }
            return basePrice;
        } else if (quantity === 5 && packageType.package5) {
            return packageType.package5.price;
        } else if (quantity === 10 && packageType.package10) {
            return packageType.package10.price;
        }
        
        // Fallback : prix normal sans réduction
        return packageType.single.price * quantity;
    }

    getPackageInfo(courseType, quantity) {
        const packageType = this.packages[courseType];
        if (!packageType) return null;

        if (quantity === 5 && packageType.package5) {
            return {
                total_credits: packageType.package5.total_credits,
                discount_percent: packageType.package5.discount_percent,
                pricePerCourse: packageType.package5.price / quantity,
                basePricePerCourse: packageType.single.price
            };
        } else if (quantity === 10 && packageType.package10) {
            return {
                total_credits: packageType.package10.total_credits,
                discount_percent: packageType.package10.discount_percent,
                pricePerCourse: packageType.package10.price / quantity,
                basePricePerCourse: packageType.single.price
            };
        }

        return { 
            total_credits: 1, 
            discount_percent: 0, 
            pricePerCourse: this.calculatePrice(courseType, 1, 60),
            basePricePerCourse: this.calculatePrice(courseType, 1, 60)
        };
    }

    async getUserCredits(userId) {
        if (!window.supabase || !userId) return { conversation: 0, curriculum: 0, examen: 0 };
        
        try {
            // Récupérer les packages actifs de l'utilisateur depuis la table packages
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

            // Compter les crédits par type de cours
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
        if (!window.supabase || !userId) return { success: false, error: 'Supabase ou utilisateur non disponible' };
        
        try {
            console.log(`💰 Recherche package pour utilisation crédit: userId=${userId}, courseType=${courseType}`);
            
            // Trouver TOUS les packages actifs avec des crédits restants dans la table packages
            // Trier par date d'expiration (les plus anciens d'abord) pour utiliser les crédits qui expirent d'abord
            const { data: activePackages, error: findError } = await supabase
                .from('packages')
                .select('id, remaining_credits, expires_at, total_credits, purchased_at')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('status', 'active')
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true }); // Utiliser d'abord les crédits qui expirent en premier

            if (findError) {
                console.error('Erreur recherche package actif:', findError);
                throw new Error('Erreur lors de la recherche de forfait actif');
            }

            if (!activePackages || activePackages.length === 0) {
                console.log(`❌ Aucun package actif trouvé pour ${courseType}`);
                // Vérifier si l'utilisateur a des packages (même inactifs)
                const { data: allPackages } = await supabase
                    .from('packages')
                    .select('id, remaining_credits, status, expires_at')
                    .eq('user_id', userId)
                    .eq('course_type', courseType);
                
                console.log(`📦 Tous les packages de l'utilisateur:`, allPackages);
                throw new Error('Aucun forfait actif avec des crédits disponibles');
            }

            console.log(`📦 Packages actifs trouvés:`, activePackages);

            // Utiliser le package le plus ancien (qui expire en premier)
            const activePackage = activePackages[0];
            
            console.log('✅ Package sélectionné pour utilisation de crédit:', {
                id: activePackage.id,
                credits_avant: activePackage.remaining_credits,
                expires_at: activePackage.expires_at,
                purchased_at: activePackage.purchased_at
            });

            // Décrémenter les crédits restants
            const newRemainingCredits = (activePackage.remaining_credits || 0) - 1;
            const { error: updateError } = await supabase
                .from('packages')
                .update({ 
                    remaining_credits: newRemainingCredits
                    // NOTE: Pas de colonne 'updated_at' dans la table
                })
                .eq('id', activePackage.id);

            if (updateError) {
                console.error('Erreur mise à jour crédits:', updateError);
                throw updateError;
            }

            console.log('✅ Crédits mis à jour:', {
                id: activePackage.id,
                credits_apres: newRemainingCredits
            });

            // Créer une transaction de crédit si la table existe
            try {
                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert({
                        user_id: userId,
                        package_id: activePackage.id,
                        booking_id: bookingData.id || `temp_${Date.now()}`,
                        credits_before: activePackage.remaining_credits || 0,
                        credits_change: -1,
                        credits_after: newRemainingCredits,
                        transaction_type: 'usage',
                        reason: `Réservation de cours ${courseType}`,
                        created_at: new Date().toISOString()
                    });

                if (transactionError) {
                    console.warn('Erreur création transaction crédit:', transactionError);
                    // Ne pas arrêter le processus si l'insertion de transaction échoue
                } else {
                    console.log('✅ Transaction crédit créée');
                }
            } catch (transactionErr) {
                console.warn('Exception création transaction crédit:', transactionErr);
                // Continuer même si la transaction échoue
            }

            return { success: true, package_id: activePackage.id };
        } catch (error) {
            console.error('❌ Erreur utilisation crédit:', error);
            return { success: false, error: error.message };
        }
    }

    async addCredits(userId, courseType, quantity, price, currency, paymentMethod, transactionId, bookingData = null) {
        if (!window.supabase || !userId) return { success: false, error: 'Supabase ou utilisateur non disponible' };
        
        try {
            // Calculer la date d'expiration (1 an)
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            // Obtenir les informations du forfait
            const packageInfo = this.getPackageInfo(courseType, quantity);
            if (!packageInfo) {
                throw new Error('Type de forfait non valide');
            }

            // Calculer le prix par cours pour le forfait
            const pricePerCourse = price / quantity;
            
            console.log('📦 Création package avec détails:', {
                user_id: userId,
                course_type: courseType,
                quantity: quantity,
                total_price: price,
                currency: currency,
                price_per_course: pricePerCourse,
                discount_percent: packageInfo.discount_percent || 0,
                base_price_per_course: packageInfo.basePricePerCourse || 0
            });

            // Créer un nouveau package
            const { data: newPackage, error: packageError } = await supabase
                .from('packages')
                .insert({
                    user_id: userId,
                    course_type: courseType,
                    duration_minutes: 60,
                    total_credits: packageInfo.total_credits,
                    remaining_credits: packageInfo.total_credits,
                    price_paid: price,
                    price_per_course: pricePerCourse,
                    base_price_per_course: packageInfo.basePricePerCourse || 0,
                    discount_percent: packageInfo.discount_percent || 0,
                    currency: currency,
                    status: 'active',
                    purchased_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString(),
                    expiration_alert_sent: false,
                    payment_method: paymentMethod,
                    transaction_id: transactionId
                })
                .select()
                .single();

            if (packageError) throw packageError;

            console.log('✅ Nouveau package créé:', {
                id: newPackage.id,
                user_id: newPackage.user_id,
                course_type: newPackage.course_type,
                total_credits: newPackage.total_credits,
                remaining_credits: newPackage.remaining_credits,
                price_per_course: newPackage.price_per_course,
                discount_percent: newPackage.discount_percent,
                expires_at: newPackage.expires_at
            });

            // Créer une transaction de crédit si la table existe
            try {
                const { error: transactionError } = await supabase
                    .from('credit_transactions')
                    .insert({
                        user_id: userId,
                        package_id: newPackage.id,
                        credits_before: 0,
                        credits_change: packageInfo.total_credits,
                        credits_after: packageInfo.total_credits,
                        transaction_type: 'purchase',
                        reason: `Achat forfait ${quantity} ${courseType} (${packageInfo.discount_percent || 0}% de réduction)`,
                        created_at: new Date().toISOString()
                    });

                if (transactionError) {
                    console.warn('⚠️ Erreur transaction crédit:', transactionError);
                } else {
                    console.log('✅ Transaction d\'achat créée');
                }
            } catch (transactionErr) {
                console.warn('⚠️ Exception création transaction crédit:', transactionErr);
                // Continuer même si la transaction échoue
            }

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
        const packageInfo = this.getPackageInfo(courseType, quantity);
        
        let display = `Forfait ${quantity} cours`;
        if (packageInfo?.discount_percent && packageInfo.discount_percent > 0) {
            display += ` (${packageInfo.discount_percent}% de réduction)`;
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

    getPackageDisplayInfo(courseType) {
        const packageInfo = this.packages[courseType];
        if (!packageInfo) return null;
        
        const info = {
            single: {
                price: packageInfo.single.price,
                duration: packageInfo.single.duration
            }
        };
        
        if (packageInfo.package5) {
            info.package5 = {
                price: packageInfo.package5.price,
                discount_percent: packageInfo.package5.discount_percent,
                total_credits: packageInfo.package5.total_credits,
                pricePerCourse: packageInfo.package5.price / packageInfo.package5.total_credits,
                savings: (packageInfo.single.price * 5) - packageInfo.package5.price
            };
        }
        
        if (packageInfo.package10) {
            info.package10 = {
                price: packageInfo.package10.price,
                discount_percent: packageInfo.package10.discount_percent,
                total_credits: packageInfo.package10.total_credits,
                pricePerCourse: packageInfo.package10.price / packageInfo.package10.total_credits,
                savings: (packageInfo.single.price * 10) - packageInfo.package10.price
            };
        }
        
        return info;
    }

    isPackageQuantity(quantity) {
        return quantity === 5 || quantity === 10;
    }
    
    // MÉTHODE : Calculer l'économie pour un forfait
    calculateSavings(courseType, quantity) {
        const packageInfo = this.getPackageInfo(courseType, quantity);
        if (!packageInfo || quantity === 1) return 0;
        
        const singlePrice = this.calculatePrice(courseType, 1, 60);
        const packagePrice = this.calculatePrice(courseType, quantity, 60);
        
        return (singlePrice * quantity) - packagePrice;
    }
}

// Fonctions de test
window.testPackagePrices = function() {
    console.group('🧪 TEST PRIX FORFAITS');
    
    const manager = window.packagesManager || new PackagesManager();
    const courseTypes = ['conversation', 'curriculum', 'examen'];
    
    for (const courseType of courseTypes) {
        console.log(`\n📚 ${courseType.toUpperCase()}:`);
        
        for (const quantity of [1, 5, 10]) {
            const price = manager.calculatePrice(courseType, quantity);
            const packageInfo = manager.getPackageInfo(courseType, quantity);
            
            console.log(`  ${quantity} cours: ${price}€ (réduction: ${packageInfo?.discount_percent || 0}%)`);
            
            if (quantity > 1) {
                const pricePerCourse = price / quantity;
                const singlePrice = manager.calculatePrice(courseType, 1);
                const savings = (singlePrice * quantity) - price;
                
                console.log(`    → ${pricePerCourse.toFixed(2)}€/cours (économie: ${savings.toFixed(2)}€)`);
            }
        }
    }
    
    console.groupEnd();
};

window.packagesManager = new PackagesManager();

// Test automatique au chargement
if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    setTimeout(() => {
        console.log('🧪 Test automatique des prix de forfaits');
        window.testPackagePrices();
    }, 2000);
}