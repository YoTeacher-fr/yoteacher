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

    async getUserCredits(userId) {
        if (!window.supabase || !userId) return 0;
        
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('credits, active_packages')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Erreur récupération crédits:', error);
                return 0;
            }

            return data?.credits || 0;
        } catch (error) {
            console.error('Exception crédits:', error);
            return 0;
        }
    }

    async useCredit(userId, courseType, bookingData) {
        if (!window.supabase || !userId) return false;
        
        try {
            // Vérifier les crédits
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            if (fetchError || !profile || profile.credits < 1) {
                throw new Error('Crédits insuffisants');
            }

            // Décrémenter les crédits
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ credits: profile.credits - 1 })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Enregistrer l'utilisation du crédit
            const { error: logError } = await supabase
                .from('credit_usage')
                .insert({
                    user_id: userId,
                    course_type: courseType,
                    booking_data: bookingData,
                    used_at: new Date().toISOString()
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