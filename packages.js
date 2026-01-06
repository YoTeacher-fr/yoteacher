// packages.js - Gestionnaire de forfaits de cours
class PackagesManager {
    constructor() {
        this.currentUser = null;
        this.userPackages = [];
        this.availablePackages = [
            {
                id: 'pack_1_conversation',
                name: '1 Cours Conversation',
                type: 'conversation',
                lessons: 1,
                price: 20,
                duration: 60,
                discount: 0
            },
            {
                id: 'pack_5_conversation',
                name: '5 Cours Conversation',
                type: 'conversation',
                lessons: 5,
                price: 95,
                duration: 60,
                discount: 5,
                savings: 5
            },
            {
                id: 'pack_10_conversation',
                name: '10 Cours Conversation',
                type: 'conversation',
                lessons: 10,
                price: 180,
                duration: 60,
                discount: 10,
                savings: 20
            },
            {
                id: 'pack_1_curriculum',
                name: '1 Cours Curriculum',
                type: 'curriculum',
                lessons: 1,
                price: 35,
                duration: 60,
                discount: 0
            },
            {
                id: 'pack_5_curriculum',
                name: '5 Cours Curriculum',
                type: 'curriculum',
                lessons: 5,
                price: 166.25,
                duration: 60,
                discount: 5,
                savings: 8.75
            },
            {
                id: 'pack_10_curriculum',
                name: '10 Cours Curriculum',
                type: 'curriculum',
                lessons: 10,
                price: 315,
                duration: 60,
                discount: 10,
                savings: 35
            }
        ];
    }
    
    async init() {
        // Écouter les changements d'authentification
        window.addEventListener('auth:login', (e) => {
            this.currentUser = e.detail.user;
            this.loadUserPackages();
        });
        
        window.addEventListener('auth:logout', () => {
            this.currentUser = null;
            this.userPackages = [];
        });
        
        // Charger si déjà connecté
        if (window.authManager && window.authManager.isAuthenticated()) {
            this.currentUser = window.authManager.getCurrentUser();
            await this.loadUserPackages();
        }
    }
    
    async loadUserPackages() {
        if (!this.currentUser || !window.supabase) {
            console.warn('⚠️ Impossible de charger les forfaits');
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from('user_packages')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .gt('remaining_lessons', 0)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            this.userPackages = data || [];
            console.log('📦 Forfaits chargés:', this.userPackages);
            
            // Émettre un événement
            window.dispatchEvent(new CustomEvent('packagesLoaded', {
                detail: { packages: this.userPackages }
            }));
            
        } catch (error) {
            console.error('❌ Erreur chargement forfaits:', error);
        }
    }
    
    getAvailablePackages(courseType = null) {
        if (!courseType) {
            return this.availablePackages;
        }
        return this.availablePackages.filter(p => p.type === courseType);
    }
    
    getUserPackages(courseType = null) {
        if (!courseType) {
            return this.userPackages;
        }
        return this.userPackages.filter(p => p.course_type === courseType);
    }
    
    hasAvailableLessons(courseType) {
        const packages = this.getUserPackages(courseType);
        return packages.some(p => p.remaining_lessons > 0);
    }
    
    getTotalRemainingLessons(courseType = null) {
        const packages = courseType ? this.getUserPackages(courseType) : this.userPackages;
        return packages.reduce((total, p) => total + p.remaining_lessons, 0);
    }
    
    async useLesson(courseType, bookingId) {
        if (!this.currentUser || !window.supabase) {
            throw new Error('Utilisateur non connecté');
        }
        
        // Trouver un forfait avec des leçons disponibles
        const availablePackage = this.userPackages.find(
            p => p.course_type === courseType && p.remaining_lessons > 0
        );
        
        if (!availablePackage) {
            throw new Error('Aucun cours disponible dans vos forfaits');
        }
        
        try {
            // Décrémenter le nombre de cours restants
            const { data, error } = await supabase
                .from('user_packages')
                .update({ 
                    remaining_lessons: availablePackage.remaining_lessons - 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', availablePackage.id)
                .select();
            
            if (error) throw error;
            
            // Enregistrer l'utilisation
            await supabase
                .from('package_usage')
                .insert([{
                    user_id: this.currentUser.id,
                    package_id: availablePackage.id,
                    booking_id: bookingId,
                    used_at: new Date().toISOString()
                }]);
            
            // Mettre à jour localement
            await this.loadUserPackages();
            
            console.log('✅ Cours utilisé du forfait:', availablePackage.id);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur utilisation cours:', error);
            throw error;
        }
    }
    
    async purchasePackage(packageId, paymentData) {
        if (!this.currentUser || !window.supabase) {
            throw new Error('Utilisateur non connecté');
        }
        
        const package = this.availablePackages.find(p => p.id === packageId);
        if (!package) {
            throw new Error('Forfait introuvable');
        }
        
        try {
            // Créer le forfait
            const { data, error } = await supabase
                .from('user_packages')
                .insert([{
                    user_id: this.currentUser.id,
                    package_id: packageId,
                    course_type: package.type,
                    total_lessons: package.lessons,
                    remaining_lessons: package.lessons,
                    price_paid: paymentData.amount,
                    currency: paymentData.currency,
                    payment_method: paymentData.method,
                    transaction_id: paymentData.transactionId,
                    created_at: new Date().toISOString()
                }])
                .select();
            
            if (error) throw error;
            
            console.log('✅ Forfait acheté:', data[0]);
            
            // Recharger les forfaits
            await this.loadUserPackages();
            
            return { success: true, package: data[0] };
            
        } catch (error) {
            console.error('❌ Erreur achat forfait:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Créer le sélecteur de forfaits pour la page booking
    createPackageSelector(containerId, courseType) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const packages = this.getAvailablePackages(courseType);
        const userPackages = this.getUserPackages(courseType);
        const hasLessons = userPackages.some(p => p.remaining_lessons > 0);
        
        const selector = document.createElement('div');
        selector.className = 'package-selector';
        selector.style.cssText = `
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border: 2px solid #e0e0e0;
        `;
        
        let html = '<h3 style="margin-bottom: 15px;">Nombre de cours</h3>';
        
        // Si l'utilisateur a des cours disponibles
        if (hasLessons) {
            const totalLessons = this.getTotalRemainingLessons(courseType);
            html += `
                <div style="padding: 15px; background: #e8f5e9; border-radius: 8px; margin-bottom: 15px; border: 2px solid #4CAF50;">
                    <i class="fas fa-check-circle" style="color: #4CAF50;"></i>
                    <strong>Vous avez ${totalLessons} cours disponible${totalLessons > 1 ? 's' : ''}</strong>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #2e7d32;">
                        Ce cours sera prélevé de votre forfait (pas de paiement)
                    </p>
                </div>
            `;
        }
        
        // Options d'achat
        html += '<div class="package-options" style="display: flex; gap: 10px; flex-wrap: wrap;">';
        
        packages.forEach(pack => {
            const currency = window.currencyManager ? window.currencyManager.getCurrentCurrency() : 'EUR';
            const convertedPrice = window.currencyManager 
                ? window.currencyManager.convert(pack.price, 'EUR', currency)
                : pack.price;
            const formattedPrice = window.currencyManager
                ? window.currencyManager.format(convertedPrice, currency)
                : `${pack.price}€`;
            
            html += `
                <button class="package-option" data-package="${pack.id}" style="
                    flex: 1;
                    min-width: 120px;
                    padding: 15px;
                    background: white;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-align: center;
                ">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #3c84f6;">
                        ${pack.lessons}
                    </div>
                    <div style="font-size: 0.85rem; color: #666; margin: 5px 0;">
                        cours
                    </div>
                    <div style="font-weight: 600; color: #333;">
                        ${formattedPrice}
                    </div>
                    ${pack.discount > 0 ? `
                        <div style="font-size: 0.8rem; color: #4CAF50; margin-top: 5px;">
                            -${pack.discount}% (économisez ${pack.savings}€)
                        </div>
                    ` : ''}
                </button>
            `;
        });
        
        html += '</div>';
        
        selector.innerHTML = html;
        container.appendChild(selector);
        
        // Gestion des clics
        selector.querySelectorAll('.package-option').forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                this.style.borderColor = '#3c84f6';
                this.style.background = '#f0f7ff';
                this.style.transform = 'translateY(-2px)';
            });
            
            btn.addEventListener('mouseleave', function() {
                if (!this.classList.contains('selected')) {
                    this.style.borderColor = '#e0e0e0';
                    this.style.background = 'white';
                    this.style.transform = 'translateY(0)';
                }
            });
            
            btn.addEventListener('click', function() {
                // Retirer sélection précédente
                selector.querySelectorAll('.package-option').forEach(b => {
                    b.classList.remove('selected');
                    b.style.borderColor = '#e0e0e0';
                    b.style.background = 'white';
                });
                
                // Ajouter sélection
                this.classList.add('selected');
                this.style.borderColor = '#3c84f6';
                this.style.background = '#f0f7ff';
                
                const packageId = this.getAttribute('data-package');
                window.dispatchEvent(new CustomEvent('packageSelected', {
                    detail: { packageId }
                }));
            });
        });
    }
}

// Initialiser
window.packagesManager = new PackagesManager();
window.packagesManager.init();

console.log('📦 PackagesManager prêt');
