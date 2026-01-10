// packages.js - Gestion des forfaits et crédits AVEC support VIP
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
            'examen': {
                single: { price: 30, duration: 60 },
                package5: { price: 142.5, discount: '5%', credits: 5 },
                package10: { price: 270, discount: '10%', credits: 10 }
            },
            'essai': {
                single: { price: 5, duration: 15 }
            }
        };
    }

    // ===== GESTION DES PRIX VIP =====
    getVipPrice(courseType, duration = 60) {
        // Vérifier si l'utilisateur a des prix VIP via authManager
        if (window.authManager?.isUserVip()) {
            return window.authManager.getVipPrice(courseType, duration);
        }
        return null;
    }

    calculatePrice(courseType, quantity = 1, duration = 60) {
        // Vérifier d'abord les prix VIP
        const vipPrice = this.getVipPrice(courseType, duration);
        
        if (vipPrice) {
            let basePrice = vipPrice.price;
            
            // Convertir dans la devise courante si nécessaire
            if (window.currencyManager && vipPrice.currency !== window.currencyManager.currentCurrency) {
                basePrice = window.currencyManager.convert(
                    vipPrice.price,
                    vipPrice.currency,
                    window.currencyManager.currentCurrency
                );
            }
            
            // Calcul pour différentes quantités
            if (quantity === 1) {
                // Ajuster selon la durée pour les cours à l'unité
                if (courseType === 'conversation' || courseType === 'curriculum' || courseType === 'examen') {
                    if (duration === 30) basePrice = basePrice / 2;
                    else if (duration === 45) basePrice = basePrice * 0.75;
                }
                return basePrice;
            } else if (quantity === 5) {
                return basePrice * 5 * 0.95; // 5% de réduction
            } else if (quantity === 10) {
                return basePrice * 10 * 0.90; // 10% de réduction
            } else {
                return basePrice * quantity; // Pas de réduction
            }
        }
        
        // Prix normaux (par défaut)
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
        
        return packageType.single.price * quantity;
    }

    getPackageInfo(courseType, quantity) {
        const vipPrice = this.getVipPrice(courseType, 60);
        
        if (vipPrice) {
            let basePrice = vipPrice.price;
            
            // Convertir si nécessaire
            if (window.currencyManager && vipPrice.currency !== window.currencyManager.currentCurrency) {
                basePrice = window.currencyManager.convert(
                    vipPrice.price,
                    vipPrice.currency,
                    window.currencyManager.currentCurrency
                );
            }
            
            if (quantity === 5) {
                const price = basePrice * 5 * 0.95;
                return {
                    credits: 5,
                    discount: '5%',
                    pricePerCourse: price / 5,
                    isVip: true
                };
            } else if (quantity === 10) {
                const price = basePrice * 10 * 0.90;
                return {
                    credits: 10,
                    discount: '10%',
                    pricePerCourse: price / 10,
                    isVip: true
                };
            } else {
                return {
                    credits: 1,
                    discount: null,
                    pricePerCourse: basePrice,
                    isVip: true
                };
            }
        }
        
        // Package normal
        const packageType = this.packages[courseType];
        if (!packageType) return null;

        if (quantity === 5 && packageType.package5) {
            return {
                credits: packageType.package5.credits,
                discount: packageType.package5.discount,
                pricePerCourse: packageType.package5.price / quantity,
                isVip: false
            };
        } else if (quantity === 10 && packageType.package10) {
            return {
                credits: packageType.package10.credits,
                discount: packageType.package10.discount,
                pricePerCourse: packageType.package10.price / quantity,
                isVip: false
            };
        }

        return { 
            credits: 1, 
            discount: null, 
            pricePerCourse: this.calculatePrice(courseType, 1, 60),
            isVip: false
        };
    }

    formatPackageDisplay(courseType, quantity, currency = null) {
        const price = this.calculatePrice(courseType, quantity);
        const packageInfo = this.getPackageInfo(courseType, quantity);
        
        // Utiliser la devise de l'utilisateur ou celle spécifiée
        const displayCurrency = currency || window.currencyManager?.currentCurrency || 'EUR';
        
        let display = `${quantity} cours`;
        
        // Ajouter le badge VIP si applicable
        if (packageInfo?.isVip) {
            display += ' <span class="vip-badge" style="background: gold; color: #000; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 5px;">VIP</span>';
        }
        
        if (packageInfo?.discount) {
            display += ` (${packageInfo.discount} de réduction)`;
        }
        
        if (window.currencyManager) {
            display += ` - ${window.currencyManager.formatPrice(price)}`;
        } else {
            display += ` - ${price}€`;
        }
        
        if (quantity > 1) {
            const pricePerCourse = price / quantity;
            if (window.currencyManager) {
                display += ` (${window.currencyManager.formatPrice(pricePerCourse)}/cours)`;
            } else {
                display += ` (${pricePerCourse.toFixed(2)}€/cours)`;
            }
        }
        
        return display;
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
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            if (fetchError || !profile || profile.credits < 1) {
                throw new Error('Crédits insuffisants');
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ credits: profile.credits - 1 })
                .eq('id', userId);

            if (updateError) throw updateError;

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
}

window.packagesManager = new PackagesManager();