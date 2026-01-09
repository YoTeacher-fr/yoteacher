// packages.js - Gestion des forfaits et crédits
class PackagesManager {
    constructor() {
        this.packages = {
            'conversation': {
                single: { price: 20, duration: 60 },
                package5: { price: 95, discount: '5%', credits: 5 },
                package10: { price: 180, discount: '10%', credits: 10 }
            },
            'curriculum': {
                single: { price: 35, duration: 60 },
                package5: { price: 166.25, discount: '5%', credits: 5 },
                package10: { price: 315, discount: '10%', credits: 10 }
            },
            'examen': { // NOUVEAU
                single: { price: 30, duration: 60 },
                package5: { price: 142.5, discount: '5%', credits: 5 }, // 30 * 5 * 0.95
                package10: { price: 270, discount: '10%', credits: 10 } // 30 * 10 * 0.90
            },
            'essai': {
                single: { price: 5, duration: 15 }
            }
        };
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
            } else if (courseType === 'examen') { // NOUVEAU
                if (duration === 30) basePrice = 15;
                else if (duration === 45) basePrice = 22.5;
            }
            return basePrice;
        } else if (quantity === 5 && packageType.package5) {
            return packageType.package5.price;
        } else if (quantity === 10 && packageType.package10) {
            return packageType.package10.price;
        }
        
        return packageType.single.price * quantity;
    }

    getPackageInfo(courseType, quantity) {
        const packageType = this.packages[courseType];
        if (!packageType) return null;

        if (quantity === 5 && packageType.package5) {
            return {
                credits: packageType.package5.credits,
                discount: packageType.package5.discount,
                pricePerCourse: packageType.package5.price / quantity
            };
        } else if (quantity === 10 && packageType.package10) {
            return {
                credits: packageType.package10.credits,
                discount: packageType.package10.discount,
                pricePerCourse: packageType.package10.price / quantity
            };
        }

        return { credits: 1, discount: null, pricePerCourse: this.calculatePrice(courseType, 1, 60) };
    }

    // Dans packages.js, modifiez getUserCredits :

async getUserCredits(userId) {
    if (!window.supabase || !userId) return 0;
    
    try {
        // Votre schéma a les crédits dans la table packages
        const { data, error } = await supabase
            .from('packages')
            .select('remaining_credits')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString());

        if (error) {
            console.warn('Erreur récupération crédits:', error);
            return 0;
        }

        // Calculer la somme des crédits restants
        const totalCredits = data.reduce((sum, pkg) => sum + (pkg.remaining_credits || 0), 0);
        return totalCredits;
    } catch (error) {
        console.error('Exception crédits:', error);
        return 0;
    }
}

// Mettre à jour useCredit pour votre schéma
async useCredit(userId, courseType, bookingData) {
    if (!window.supabase || !userId) return false;
    
    try {
        // Trouver un package actif non expiré pour ce type de cours
        const { data: packages, error: fetchError } = await supabase
            .from('packages')
            .select('id, remaining_credits')
            .eq('user_id', userId)
            .eq('course_type', courseType)
            .eq('status', 'active')
            .gt('remaining_credits', 0)
            .gt('expires_at', new Date().toISOString())
            .order('expires_at', { ascending: true }) // Utiliser le plus vieux d'abord
            .limit(1);

        if (fetchError || !packages || packages.length === 0) {
            throw new Error('Aucun crédit disponible pour ce type de cours');
        }

        const pkg = packages[0];
        const creditsBefore = pkg.remaining_credits;

        // Décrémenter le crédit
        const { error: updateError } = await supabase
            .from('packages')
            .update({ 
                remaining_credits: creditsBefore - 1,
                status: (creditsBefore - 1) === 0 ? 'depleted' : 'active'
            })
            .eq('id', pkg.id);

        if (updateError) throw updateError;

        // Enregistrer la transaction dans credit_transactions
        const { error: logError } = await supabase
            .from('credit_transactions')
            .insert({
                user_id: userId,
                package_id: pkg.id,
                booking_id: bookingData.id, // À fournir si disponible
                transaction_type: 'use',
                credits_change: -1,
                credits_before: creditsBefore,
                credits_after: creditsBefore - 1,
                reason: `Crédit utilisé pour un cours de type ${courseType}`
            });

        if (logError) console.warn('Erreur log crédit:', logError);

        return true;
    } catch (error) {
        console.error('❌ Erreur utilisation crédit:', error);
        return false;
    }
}

    async addCredits(userId, packageType, quantity) {
        if (!window.supabase || !userId) return false;
        
        try {
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            if (fetchError) {
                // Créer le profil si inexistant
                const { error: createError } = await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        credits: quantity,
                        active_packages: [{
                            type: packageType,
                            quantity: quantity,
                            purchased_at: new Date().toISOString(),
                            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                        }]
                    });

                return !createError;
            }

            // Ajouter les crédits
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    credits: (profile.credits || 0) + quantity,
                    active_packages: [...(profile.active_packages || []), {
                        type: packageType,
                        quantity: quantity,
                        purchased_at: new Date().toISOString(),
                        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                    }]
                })
                .eq('id', userId);

            return !updateError;
        } catch (error) {
            console.error('❌ Erreur ajout crédits:', error);
            return false;
        }
    }

    formatPackageDisplay(courseType, quantity, currency = 'EUR') {
        const price = this.calculatePrice(courseType, quantity);
        const packageInfo = this.getPackageInfo(courseType, quantity);
        
        let display = `${quantity} cours`;
        if (packageInfo?.discount) {
            display += ` (${packageInfo.discount} de réduction)`;
        }
        
        if (window.currencyManager) {
            display += ` - ${window.currencyManager.format(price, currency)}`;
        } else {
            display += ` - ${price}€`;
        }
        
        if (quantity > 1) {
            const pricePerCourse = price / quantity;
            if (window.currencyManager) {
                display += ` (${window.currencyManager.format(pricePerCourse, currency)}/cours)`;
            } else {
                display += ` (${pricePerCourse.toFixed(2)}€/cours)`;
            }
        }
        
        return display;
    }
}

window.packagesManager = new PackagesManager();