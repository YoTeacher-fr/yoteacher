// packages.js - Gestion des forfaits et crédits avec votre schéma Supabase
class PackagesManager {
    constructor() {
        this.packages = {
            'conversation': {
                single: { price: 20, duration: 60 },
                package5: { price: 98, discount_percent: 2, total_credits: 5 },
                package10: { price: 190, discount_percent: 10, total_credits: 10 }
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
        
        return packageType.single.price * quantity;
    }

    getPackageInfo(courseType, quantity) {
        const packageType = this.packages[courseType];
        if (!packageType) return null;

        if (quantity === 5 && packageType.package5) {
            return {
                total_credits: packageType.package5.total_credits,
                discount_percent: packageType.package5.discount_percent,
                pricePerCourse: packageType.package5.price / quantity
            };
        } else if (quantity === 10 && packageType.package10) {
            return {
                total_credits: packageType.package10.total_credits,
                discount_percent: packageType.package10.discount_percent,
                pricePerCourse: packageType.package10.price / quantity
            };
        }

        return { 
            total_credits: 1, 
            discount_percent: null, 
            pricePerCourse: this.calculatePrice(courseType, 1, 60) 
        };
    }

    async getUserCredits(userId) {
        if (!window.supabase || !userId) return { conversation: 0, curriculum: 0, examen: 0 };
        
        try {
            // Récupérer les packages actifs de l'utilisateur
            const { data: packages, error } = await supabase
                .from('user_active_packages')
                .select('course_type, remaining_credits')
                .eq('user_id', userId)
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
            // Trouver un package actif avec des crédits restants
            const { data: activePackage, error: findError } = await supabase
                .from('user_active_packages')
                .select('id, remaining_credits')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .gt('remaining_credits', 0)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true })
                .limit(1)
                .single();

            if (findError || !activePackage) {
                throw new Error('Aucun forfait actif avec des crédits disponibles');
            }

            // Décrémenter les crédits restants
            const newRemainingCredits = activePackage.remaining_credits - 1;
            const { error: updateError } = await supabase
                .from('user_active_packages')
                .update({ 
                    remaining_credits: newRemainingCredits,
                    updated_at: new Date().toISOString()
                })
                .eq('id', activePackage.id);

            if (updateError) throw updateError;

            // Créer une transaction de crédit
            const { error: transactionError } = await supabase
                .from('credit_transactions')
                .insert({
                    user_id: userId,
                    package_id: activePackage.id,
                    booking_id: bookingData.id,
                    credits_before: activePackage.remaining_credits,
                    credits_change: -1,
                    credits_after: newRemainingCredits,
                    transaction_type: 'usage',
                    reason: `Réservation de cours ${courseType}`,
                    created_at: new Date().toISOString()
                });

            if (transactionError) console.warn('Erreur transaction crédit:', transactionError);

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
                    discount_percent: packageInfo.discount_percent || 0,
                    currency: currency,
                    status: 'active',
                    purchased_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString(),
                    expiration_alert_sent: false
                })
                .select()
                .single();

            if (packageError) throw packageError;

            // Créer une transaction de crédit
            const { error: transactionError } = await supabase
                .from('credit_transactions')
                .insert({
                    user_id: userId,
                    package_id: newPackage.id,
                    credits_before: 0,
                    credits_change: packageInfo.total_credits,
                    credits_after: packageInfo.total_credits,
                    transaction_type: 'purchase',
                    reason: `Achat forfait ${quantity} ${courseType}`,
                    created_at: new Date().toISOString()
                });

            if (transactionError) console.warn('Erreur transaction crédit:', transactionError);

            // NE PAS modifier le statut VIP automatiquement - GÉRÉ UNIQUEMENT MANUELLEMENT
            // Le statut VIP doit être géré manuellement via codes d'invitation ou par l'admin
            
            // Récupérer l'email de l'utilisateur
            let userEmail = '';
            try {
                if (window.authManager?.user?.email) {
                    userEmail = window.authManager.user.email;
                } else if (bookingData?.email) {
                    userEmail = bookingData.email;
                }
                
                // Si on n'a toujours pas d'email, essayer de récupérer le profil
                if (!userEmail && window.supabase) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('id', userId)
                        .single();
                    
                    if (profile?.email) {
                        userEmail = profile.email;
                    }
                }
            } catch (emailError) {
                console.warn('Erreur récupération email:', emailError);
            }
	    /*
            // Créer une notification d'email (seulement si on a un email)
            if (userEmail) {
                try {
                    const { error: emailError } = await supabase
                        .from('email_notifications')
                        .insert({
                            user_id: userId,
                            email_to: userEmail,
                            notification_type: 'booking_purchase',
                            subject: `Confirmation d'achat - Forfait ${courseType}`,
                            body: `Vous avez acheté un forfait de ${quantity} cours ${courseType}. Les crédits ont été ajoutés à votre compte.`,
                            scheduled_for: new Date().toISOString(),
                            status: 'pending',
                            booking_id: null,
                            created_at: new Date().toISOString()
                        });

                    if (emailError) {
                        console.warn('⚠️ Erreur création notification email:', emailError);
                        // Continuer même si l'email échoue - ce n'est pas critique
                    } else {
                        console.log('📧 Notification d\'email créée avec succès');
                    }
                } catch (emailErr) {
                    console.warn('Exception création notification email:', emailErr);
                    // Continuer même si l'email échoue
                }
            }
*/
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
                .from('user_active_packages')
                .select('*')
                .eq('user_id', userId)
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
        if (packageInfo?.discount_percent) {
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
                pricePerCourse: packageInfo.package5.price / packageInfo.package5.total_credits
            };
        }
        
        if (packageInfo.package10) {
            info.package10 = {
                price: packageInfo.package10.price,
                discount_percent: packageInfo.package10.discount_percent,
                total_credits: packageInfo.package10.total_credits,
                pricePerCourse: packageInfo.package10.price / packageInfo.package10.total_credits
            };
        }
        
        return info;
    }

    isPackageQuantity(quantity) {
        return quantity === 5 || quantity === 10;
    }
}

window.packagesManager = new PackagesManager();